use super::*;
use reqwest::{Client, Method, RequestBuilder};

pub(super) const PROFILE: &str = "/api/v1/user/profile/upload/";
pub(super) const UPLOAD_AUTH: &str = "/api/v1/video/upload/auth/";
pub(super) const PUBLISH: &str = "/tiktok/web/project/post/v1/";
const CONTEXT: &str = "/node-webapp/api/common-app-context";

// 不实现 Debug，Cookie、CSRF 和临时上传密钥只保留在原生内存。
#[derive(Clone)]
pub(super) struct Api {
    pub http: Client,
    pub base: Url,
    pub login: Login,
}
pub(super) struct WebContext {
    pub region: String,
    pub csrf: String,
    pub device_id: Option<String>,
}
impl Api {
    pub fn new(login: Login) -> Result<Self> {
        Ok(Self {
            http: Client::builder()
                .redirect(reqwest::redirect::Policy::none())
                .connect_timeout(Duration::from_secs(20))
                .timeout(Duration::from_secs(120))
                .build()?,
            base: Url::parse("https://www.tiktok.com/")?,
            login,
        })
    }
    #[cfg(test)]
    pub fn for_test(login: Login, base: Url) -> Result<Self> {
        let mut api = Self::new(login)?;
        api.base = base;
        Ok(api)
    }
    pub fn cookie_value(&self, name: &str) -> Option<&str> {
        self.login
            .cookie
            .split(';')
            .filter_map(|part| part.trim().split_once('='))
            .find(|(key, _)| *key == name)
            .map(|(_, value)| value)
    }
    pub fn site_request(&self, method: Method, path: &str) -> Result<RequestBuilder> {
        // path 是原生固定 API 路径，不接收 renderer 传来的 URL。
        let url = self.base.join(path)?;
        ensure!(url.origin() == self.base.origin(), "TikTok API 来源无效");
        let mut request = self
            .http
            .request(method, url)
            .header(reqwest::header::COOKIE, &self.login.cookie)
            .header(reqwest::header::USER_AGENT, &self.login.user_agent)
            .header(
                reqwest::header::REFERER,
                self.base.join("tiktokstudio/upload")?.as_str(),
            )
            .header(
                reqwest::header::ORIGIN,
                self.base.origin().ascii_serialization(),
            )
            .query(&[
                ("aid", "1988"),
                ("app_name", "tiktok_web"),
                ("channel", "tiktok_web"),
                ("device_platform", "web"),
                ("tz_name", &self.login.account.timezone),
            ])
            .timeout(Duration::from_secs(45));
        if let Some(value) = self.cookie_value("msToken") {
            request = request.query(&[("msToken", value)]);
        }
        if let Some(value) = self.cookie_value("s_v_web_id") {
            request = request.query(&[("verifyFp", value)]);
        }
        Ok(request)
    }
    pub async fn get(&self, path: &str, stage: &str) -> Result<Value> {
        let response = self
            .site_request(Method::GET, path)?
            .send()
            .await
            .map_err(|_| anyhow::anyhow!("{stage}请求失败，请检查网络或 Cookie"))?;
        read_json(response, stage).await
    }
    pub async fn account(&self) -> Result<Account> {
        let value = self.get(PROFILE, "TikTok 用户信息").await?;
        let mut account = auth::parse_profile(&value)?;
        account.timezone = self.login.account.timezone.clone();
        Ok(account)
    }
    pub async fn context(&self) -> Result<WebContext> {
        let value = self.get(CONTEXT, "TikTok 上传环境").await?;
        ensure!(
            status_code(&value) == Some(0),
            "TikTok 上传环境接口未成功，请更新 Cookie 后重试"
        );
        let region = upload_region(
            value["clusterRegion"]
                .as_str()
                .context("TikTok 未返回上传地区")?,
        )?
        .into();
        let csrf = value["csrfToken"]
            .as_str()
            .filter(|s| !s.is_empty())
            .context("TikTok 未返回 CSRF 参数，请更新 Cookie")?
            .to_owned();
        Ok(WebContext {
            region,
            csrf,
            device_id: value["wid"].as_str().map(str::to_owned),
        })
    }
    pub async fn upload_auth(&self) -> Result<Value> {
        let value = self.get(UPLOAD_AUTH, "TikTok 上传授权").await?;
        ensure!(
            status_code(&value) == Some(0),
            "TikTok 上传授权被拒绝（{}）",
            status_code(&value)
                .map(|v| v.to_string())
                .unwrap_or_else(|| "未知状态".into())
        );
        Ok(value)
    }
    pub async fn post(&self, body: &Value, context: &WebContext) -> Result<Value> {
        let mut request = self
            .site_request(Method::POST, PUBLISH)?
            .header("tt-csrf-token", &context.csrf)
            .json(body);
        if let Some(id) = &context.device_id {
            request = request.query(&[("device_id", id)]);
        }
        // 绝不自动重试创建请求。HTTP/传输异常均由调用方保留为待核对。
        let response = request
            .send()
            .await
            .map_err(|_| anyhow::anyhow!("预约请求未收到回执，请核对结果后再重试"))?;
        let value = read_json(response, "TikTok 预约发布").await?;
        Ok(publish_receipt(&value))
    }
}
pub(super) fn status_code(value: &Value) -> Option<i64> {
    value["status_code"]
        .as_i64()
        .or_else(|| value["statusCode"].as_i64())
}
fn upload_region(region: &str) -> Result<&'static str> {
    // 对应官网 creator_center 1258.a29a297e.js 中的 VOD 地区配置。
    match region.to_ascii_lowercase().as_str() {
        "ttp" | "ttp2" | "us-ttp" | "us-ttp2" => Ok("US-TTP"),
        "ie" | "useastred" | "no1a" | "eu-ttp" | "eu-ttp2" | "gcp" => Ok("gcp"),
        "maliva" | "va" | "us-east-1" => Ok("us-east-1"),
        "sg" | "row" | "ap-singapore-1" => Ok("ap-singapore-1"),
        _ => anyhow::bail!("TikTok 返回了尚未适配的上传地区"),
    }
}
pub(super) async fn read_json(mut response: reqwest::Response, stage: &str) -> Result<Value> {
    ensure!(
        response.status().is_success(),
        "{stage}返回 HTTP {}；Cookie、签名或接口风控可能拒绝了请求",
        response.status().as_u16()
    );
    const LIMIT: usize = 2 * 1024 * 1024;
    ensure!(
        response.content_length().unwrap_or(0) <= LIMIT as u64,
        "{stage}响应过大"
    );
    let mut bytes = Vec::new();
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|_| anyhow::anyhow!("{stage}响应读取失败"))?
    {
        ensure!(bytes.len() + chunk.len() <= LIMIT, "{stage}响应过大");
        bytes.extend_from_slice(&chunk);
    }
    serde_json::from_slice(&bytes)
        .map_err(|_| anyhow::anyhow!("{stage}未返回 JSON，接口可能要求更新 Cookie 或额外验证"))
}
fn rejection(value: &Value, code: i64, log_id: &str) -> Value {
    let detail = value["status_msg"]
        .as_str()
        .or_else(|| value["statusMsg"].as_str())
        .or_else(|| value["message"].as_str())
        .unwrap_or("");
    let detail = crate::protocol::safe_message(detail)
        .chars()
        .take(240)
        .collect::<String>();
    let hint = if code == 5 { "（参数错误）" } else { "" };
    let mut message = format!("TikTok 拒绝预约，状态码 {code}{hint}");
    if !detail.is_empty() {
        message.push_str(&format!("：{detail}"));
    }
    if !log_id.is_empty() {
        message.push_str(&format!("，请求编号 {log_id}"));
    }
    json!({"disposition":"rejected","code":code,"message":message,"logId":log_id})
}
pub(super) fn publish_receipt(value: &Value) -> Value {
    let log_id = value["log_pb"]["impr_id"]
        .as_str()
        .or_else(|| value["extra"]["logid"].as_str())
        .unwrap_or("");
    let log_id = crate::protocol::safe_message(log_id)
        .chars()
        .take(100)
        .collect::<String>();
    if let Some(code) = status_code(value)
        && code != 0
    {
        return rejection(value, code, &log_id);
    }
    if status_code(value) != Some(0) {
        return json!({"disposition":"unknown","message":"发布回执缺少状态码，请核对预约"});
    }
    let item = value["single_post_resp_list"]
        .as_array()
        .and_then(|items| items.iter().find(|v| v["batch_index"].as_u64() == Some(0)));
    if let Some(item) = item {
        if let Some(code) = item["status_code"].as_i64()
            && code != 0
        {
            return rejection(item, code, &log_id);
        }
        let id = item["item_id"]
            .as_str()
            .map(str::to_owned)
            .or_else(|| item["item_id"].as_u64().map(|v| v.to_string()));
        if item["status_code"].as_i64() == Some(0)
            && let Some(id) = id
            && valid_item_id(&id)
        {
            return json!({"disposition":"scheduled","itemId":id,
                "projectId":value["project_id"].as_str().unwrap_or(""),"logId":value["log_pb"]["impr_id"].as_str().unwrap_or("")});
        }
    }
    json!({"disposition":"unknown","message":"发布回执缺少有效视频 ID，请核对预约"})
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn parameter_errors_preserve_provider_reason_and_request_id() {
        let receipt = publish_receipt(
            &json!({"status_code":5,"status_msg":"enter_post_page_from must be an integer","log_pb":{"impr_id":"fixture-request"}}),
        );
        assert_eq!(receipt["code"], 5);
        assert_eq!(receipt["logId"], "fixture-request");
        assert!(
            receipt["message"]
                .as_str()
                .unwrap()
                .contains("enter_post_page_from must be an integer")
        );
    }
    #[test]
    fn regions_follow_observed_official_configuration() {
        assert_eq!(upload_region("TTP").unwrap(), "US-TTP");
        assert_eq!(upload_region("IE").unwrap(), "gcp");
        assert_eq!(upload_region("MALIVA").unwrap(), "us-east-1");
        assert!(upload_region("unrecognized").is_err());
    }
    #[test]
    fn receipts_require_matching_successful_item_and_preserve_large_ids() {
        for value in [
            json!({}),
            json!({"status_code":0}),
            json!({"status_code":0,"single_post_resp_list":[{"batch_index":0,"status_code":0}]}),
            json!({"status_code":0,"single_post_resp_list":[{"batch_index":1,"status_code":0,"item_id":"7"}]}),
        ] {
            assert_eq!(publish_receipt(&value)["disposition"], "unknown");
        }
        assert_eq!(
            publish_receipt(
                &json!({"status_code":0,"single_post_resp_list":[{"batch_index":0,"status_code":0,"item_id":7000000000000000001_u64}]})
            )["itemId"],
            "7000000000000000001"
        );
        assert_eq!(
            publish_receipt(
                &json!({"status_code":0,"single_post_resp_list":[{"batch_index":0,"status_code":5}]})
            )["disposition"],
            "rejected"
        );
    }
}
