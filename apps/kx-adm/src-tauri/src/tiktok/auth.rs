use super::*;

const PROFILE_URL: &str = "https://www.tiktok.com/api/v1/user/profile/upload/";
const DEFAULT_USER_AGENT: &str = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CookieInput {
    pub cookie: String,
    pub user_agent: Option<String>,
    pub timezone: String,
    pub expected_account_id: Option<String>,
    pub activate: Option<bool>,
}

// 只回传给本地主窗口保存 localStorage，不实现 Debug，避免误把 Cookie 打进日志。
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Login {
    #[serde(skip_serializing)]
    pub(super) owner_key: Option<String>,
    pub account: Account,
    pub cookie: String,
    pub user_agent: String,
}
fn cookie_header(value: &str) -> String {
    let value = value.trim();
    let value = if value
        .get(..7)
        .is_some_and(|p| p.eq_ignore_ascii_case("cookie:"))
    {
        value[7..].trim()
    } else {
        value
    };
    // 仅适配文本域分行粘贴；不解析、校验或去重 Cookie，交给服务端判断。
    let mut header = String::new();
    for line in value.lines().map(str::trim).filter(|line| !line.is_empty()) {
        if !header.is_empty() {
            if !header.ends_with(';') {
                header.push(';');
            }
            header.push(' ');
        }
        header.push_str(line);
    }
    header
}
pub(super) fn parse_profile(value: &Value) -> Result<Account> {
    ensure!(
        value["status_code"]
            .as_i64()
            .or_else(|| value["statusCode"].as_i64())
            == Some(0),
        "TikTok 用户信息请求未成功，请更新 Cookie 后重试"
    );
    let uid = value["user"]["uid"]
        .as_str()
        .map(str::to_owned)
        .or_else(|| value["user"]["uid"].as_u64().map(|n| n.to_string()))
        .context("TikTok 未返回登录用户 UID，Cookie 可能已失效")?;
    ensure!(valid_item_id(&uid), "TikTok 未返回有效登录用户 UID");
    Ok(Account {
        nickname: value["user"]["nickname"]
            .as_str()
            .unwrap_or(&uid)
            .to_owned(),
        uid,
        // Cookie 接口不提供前端 A/B 时间范围，保守使用官网通用的 10 天上限。
        timezone: String::new(),
        min_delay_seconds: 900,
        max_delay_seconds: 10 * 86400,
        private_account: value["user"]["private_account"].as_bool().unwrap_or(false),
    })
}
async fn fetch_profile(
    cookie: &str,
    user_agent: &str,
    timezone: &str,
    url: &str,
) -> Result<Account> {
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(Duration::from_secs(30))
        .build()?;
    let response = client
        .get(url)
        .query(&[
            ("aid", "1988"),
            ("app_name", "tiktok_web"),
            ("channel", "tiktok_web"),
            ("device_platform", "web"),
        ])
        .header(reqwest::header::COOKIE, cookie)
        .header(reqwest::header::USER_AGENT, user_agent)
        .header(reqwest::header::REFERER, UPLOAD_URL)
        .send()
        .await
        .map_err(|_| anyhow::anyhow!("无法连接 TikTok 用户信息接口，请检查网络"))?;
    ensure!(
        response.status().is_success(),
        "TikTok 用户信息请求失败（HTTP {}），请检查 Cookie 和网络",
        response.status().as_u16()
    );
    ensure!(
        response.content_length().unwrap_or(0) <= 1024 * 1024,
        "TikTok 响应过大"
    );
    let mut response = response;
    let mut bytes = Vec::new();
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|_| anyhow::anyhow!("读取 TikTok 响应失败"))?
    {
        ensure!(bytes.len() + chunk.len() <= 1024 * 1024, "TikTok 响应过大");
        bytes.extend_from_slice(&chunk);
    }
    let value: Value = serde_json::from_slice(&bytes)
        .map_err(|_| anyhow::anyhow!("TikTok 未返回用户信息 JSON，请检查 Cookie 或接口风控状态"))?;
    let mut account = parse_profile(&value)?;
    account.timezone = timezone.to_owned();
    Ok(account)
}
impl TikTok {
    pub async fn ensure_owner(&self, key: &str) -> Result<()> {
        ensure!(
            self.auth
                .lock()
                .await
                .as_ref()
                .is_some_and(|login| login.owner_key.as_deref() == Some(key)),
            "请重新从当前KX账号选择TikTok账号"
        );
        Ok(())
    }
    pub async fn login_session(&self) -> Option<Login> {
        self.auth.lock().await.clone()
    }
    pub async fn import_cookie(
        &self,
        cookie: String,
        user_agent: Option<String>,
        timezone: String,
        expected_account_id: Option<String>,
        owner_key: String,
        activate: bool,
    ) -> Result<Login> {
        let _guard = self
            .gate
            .try_lock()
            .context("任务正在执行，不能切换 Cookie")?;
        ensure!(
            !timezone.is_empty()
                && timezone.len() <= 80
                && timezone
                    .bytes()
                    .all(|b| b.is_ascii_alphanumeric() || b"/_+-".contains(&b)),
            "时区无效"
        );
        let cookie = cookie_header(&cookie);
        let user_agent = user_agent
            .filter(|s| !s.trim().is_empty())
            .unwrap_or_else(|| DEFAULT_USER_AGENT.into());
        ensure!(
            user_agent.len() <= 2048
                && user_agent.is_ascii()
                && !user_agent.bytes().any(|b| b.is_ascii_control()),
            "User-Agent 无效"
        );
        let account = fetch_profile(&cookie, &user_agent, &timezone, PROFILE_URL).await?;
        ensure!(
            expected_account_id
                .as_ref()
                .is_none_or(|uid| uid == &account.uid),
            "Cookie 所属账号与目标账号不同，未切换登录"
        );
        if activate {
            self.activate_account(&account, &owner_key).await?;
        }
        let login = Login {
            owner_key: Some(owner_key),
            account,
            cookie,
            user_agent,
        };
        if activate {
            *self.auth.lock().await = Some(login.clone());
        }
        Ok(login)
    }
    pub async fn clear_login(&self) -> Result<()> {
        let _guard = self
            .gate
            .try_lock()
            .context("请先暂停并等待当前请求结束再退出 TikTok")?;
        *self.auth.lock().await = None;
        Ok(())
    }
    pub(super) async fn cookie_account(&self) -> Result<Account> {
        let login = self
            .auth
            .lock()
            .await
            .clone()
            .context("请先粘贴 Cookie 登录")?;
        fetch_profile(
            &login.cookie,
            &login.user_agent,
            &login.account.timezone,
            PROFILE_URL,
        )
        .await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn duplicated_cookie_names_are_forwarded_in_original_order() {
        let cookie = "sessionid=first; sessionid=second; token=abc==";
        assert_eq!(cookie_header(cookie), cookie);
    }
    #[test]
    fn cookie_input_is_opaque_and_only_multiline_paste_is_adapted() {
        assert_eq!(
            cookie_header("Cookie: sessionid=abc==;\n tt_csrf_token=xyz"),
            "sessionid=abc==; tt_csrf_token=xyz"
        );
        for raw in ["", "unparsed", "name=value; Path=/", r#"{"cookie":1}"#] {
            assert_eq!(cookie_header(raw), raw);
        }
    }
    #[test]
    fn only_valid_user_information_means_login_success() {
        assert!(parse_profile(&json!({"status_code":8,"user":{"uid":"7"}})).is_err());
        assert!(parse_profile(&json!({"status_code":0,"user":{}})).is_err());
        assert_eq!(
            parse_profile(
                &json!({"status_code":0,"user":{"uid":7000000000000000001_u64,"nickname":"test"}})
            )
            .unwrap()
            .uid,
            "7000000000000000001"
        );
    }
    #[tokio::test]
    async fn duplicate_cookie_values_reach_profile_api_unchanged() -> Result<()> {
        use tokio::{
            io::{AsyncReadExt, AsyncWriteExt},
            net::TcpListener,
        };
        let listener = TcpListener::bind("127.0.0.1:0").await?;
        let url = format!(
            "http://{}/api/v1/user/profile/upload/",
            listener.local_addr()?
        );
        let server = tokio::spawn(async move {
            let (mut stream, _) = listener.accept().await.unwrap();
            let mut bytes = vec![0; 8192];
            let n = stream.read(&mut bytes).await.unwrap();
            let request = String::from_utf8_lossy(&bytes[..n]);
            assert!(request.starts_with("GET /api/v1/user/profile/upload/?aid=1988"));
            assert!(
                request
                    .lines()
                    .any(|line| line == "cookie: sessionid=first; sessionid=second; token=abc==")
            );
            let body =
                r#"{"status_code":0,"user":{"uid":"7000000000000000001","nickname":"fixture"}}"#;
            stream
                .write_all(
                    format!(
                        "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                        body.len(),
                        body
                    )
                    .as_bytes(),
                )
                .await
                .unwrap();
        });
        let account = fetch_profile(
            &cookie_header("Cookie: sessionid=first; sessionid=second; token=abc=="),
            "fixture-agent",
            "Asia/Shanghai",
            &url,
        )
        .await?;
        assert_eq!(account.nickname, "fixture");
        assert_eq!(account.timezone, "Asia/Shanghai");
        server.await?;
        Ok(())
    }
}
