use crate::session::{Desktop, Session};
use anyhow::{Result, ensure};
use sha2::{Digest, Sha256};
use std::sync::Arc;
use tauri::{AppHandle, Manager, State, WebviewUrl, WebviewWindow, WebviewWindowBuilder};
use url::Url;

const PREFIX: &str = "cookie-proxy-";

fn owner_prefix(session: &Session) -> String {
    let digest = Sha256::digest(format!("{}\n{}", session.api_base, session.uid));
    let owner = digest
        .iter()
        .take(16)
        .map(|v| format!("{v:02x}"))
        .collect::<String>();
    format!("{PREFIX}{owner}-")
}

fn web_url(value: &str) -> Result<Url> {
    let url = Url::parse(value).map_err(|_| anyhow::anyhow!("网站代理地址无效"))?;
    let loopback = url.host_str().is_some_and(|host| {
        host == "localhost"
            || host.ends_with(".localhost")
            || host == "127.0.0.1"
            || host == "[::1]"
    });
    ensure!(
        url.scheme() == "https" || (url.scheme() == "http" && loopback),
        "网站代理必须使用HTTPS（本机开发可用HTTP）"
    );
    ensure!(
        url.host_str().is_some() && url.username().is_empty() && url.password().is_none(),
        "网站代理地址不可包含用户名或密码"
    );
    ensure!(
        !matches!(url.host_str(), Some("tauri.localhost")),
        "网站代理不能使用客户端内部地址"
    );
    Ok(url)
}

fn grant_url(value: &str, entry: &str, api_base: &str) -> Result<Url> {
    let entry = web_url(entry)?;
    let url = web_url(value)?;
    let backend = Url::parse(api_base)?;
    ensure!(
        url.origin() == entry.origin() && url.origin() != backend.origin(),
        "代理地址与授权网站不一致或未与后台隔离"
    );
    ensure!(
        url.path() == "/_kx/complete" && url.fragment().is_none(),
        "代理登录票据地址无效，请更新后端"
    );
    let query = url.query_pairs().collect::<Vec<_>>();
    ensure!(query.len() == 2, "代理登录票据参数无效");
    for key in ["ticket", "proof"] {
        let values = query
            .iter()
            .filter(|(name, _)| name == key)
            .collect::<Vec<_>>();
        ensure!(
            values.len() == 1
                && values[0].1.len() == 64
                && values[0].1.bytes().all(|v| v.is_ascii_hexdigit()),
            "代理登录票据参数无效"
        );
    }
    Ok(url)
}

fn allowed_navigation(url: &Url, origin: &url::Origin) -> bool {
    matches!(url.scheme(), "http" | "https")
        && url.origin() == *origin
        && url.username().is_empty()
        && url.password().is_none()
}

/// 会话退出和身份切换时销毁旧代理页面；远程窗口没有任何Tauri capability。
fn should_close(label: &str, owner: Option<&str>) -> bool {
    label.starts_with(PREFIX) && owner.is_none_or(|owner| !label.starts_with(owner))
}

pub(crate) fn close_other_owners(app: &AppHandle, session: Option<&Session>) {
    let owner = session.map(owner_prefix);
    for (label, window) in app.webview_windows() {
        if should_close(&label, owner.as_deref()) {
            let _ = window.destroy();
        }
    }
}

#[tauri::command]
pub async fn cookie_proxy_open(
    app: AppHandle,
    window: WebviewWindow,
    state: State<'_, Arc<Desktop>>,
    site_id: String,
) -> Result<(), String> {
    crate::tiktok::local_caller(&window)
        .map_err(|_| "网站代理仅供本地桌面主窗口打开".to_owned())?;
    open(&app, &state, &site_id)
        .await
        .map_err(|error| crate::protocol::safe_message(&error.to_string()))
}

async fn open(app: &AppHandle, desktop: &Desktop, site_id: &str) -> Result<()> {
    let site_id = site_id
        .parse::<i64>()
        .ok()
        .filter(|id| *id > 0)
        .ok_or_else(|| anyhow::anyhow!("网站账号无效"))?;
    let identity = desktop.identity().await?;
    let sites = desktop
        .api(
            app,
            &identity,
            reqwest::Method::GET,
            "/cookie-manager/my-sites",
            None,
        )
        .await?;
    let site = sites
        .as_array()
        .and_then(|sites| {
            sites.iter().find(|site| {
                site["id"].as_i64() == Some(site_id)
                    || site["id"].as_str() == Some(site_id.to_string().as_str())
            })
        })
        .ok_or_else(|| anyhow::anyhow!("网站账号已失效或未获授权，请刷新网站授权"))?;
    let entry = site["proxy_url"]
        .as_str()
        .ok_or_else(|| anyhow::anyhow!("网站代理尚未配置，请联系管理员"))?;
    let entry_url = web_url(entry)?;
    ensure!(
        entry_url.origin() != Url::parse(&identity.api_base)?.origin(),
        "网站代理必须与管理后台隔离"
    );
    let result = desktop
        .api(
            app,
            &identity,
            reqwest::Method::POST,
            "/cookie-manager/proxy/grant-direct",
            Some(&serde_json::json!({"site_id":site_id})),
        )
        .await?;
    let url = grant_url(
        result["url"].as_str().unwrap_or_default(),
        entry,
        &identity.api_base,
    )?;
    // 签发期间退出或换号时不再打开；持锁构建，避免退出通知漏掉刚创建的窗口。
    let auth = desktop.auth.lock().await;
    ensure!(
        auth.session
            .as_ref()
            .is_some_and(|s| s.uid == identity.uid && s.api_base == identity.api_base),
        "登录身份已变化，请重新进入代理"
    );
    let site_prefix = format!("{}{site_id}-", owner_prefix(&identity));
    let label = format!("{site_prefix}{}", uuid::Uuid::new_v4());
    let old_windows = app
        .webview_windows()
        .into_iter()
        .filter(|(label, _)| label.starts_with(&site_prefix))
        .map(|(_, window)| window)
        .collect::<Vec<_>>();
    let origin = url.origin();
    let new_window_origin = origin.clone();
    let popup_app = app.clone();
    let popup_label = label.clone();
    let name = site["name"]
        .as_str()
        .unwrap_or("网站代理")
        .chars()
        .filter(|c| !c.is_control())
        .take(80)
        .collect::<String>();
    WebviewWindowBuilder::new(app, &label, WebviewUrl::External(url))
        .title(format!("{name} · 网站代理"))
        .inner_size(1280.0, 900.0)
        .min_inner_size(600.0, 480.0)
        .incognito(true)
        .devtools(false)
        .on_navigation(move |url| allowed_navigation(url, &origin))
        .on_new_window(move |url, _| {
            if allowed_navigation(&url, &new_window_origin)
                && let Some(window) = popup_app.get_webview_window(&popup_label)
            {
                let _ = window.navigate(url);
            }
            tauri::webview::NewWindowResponse::Deny
        })
        .build()
        .map_err(|_| anyhow::anyhow!("无法创建代理窗口，请关闭旧代理窗口后重试"))?;
    for old in old_windows {
        let _ = old.destroy();
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    fn ticket(origin: &str) -> String {
        format!(
            "{origin}/_kx/complete?ticket={}&proof={}",
            "a".repeat(64),
            "b".repeat(64)
        )
    }
    #[test]
    fn grant_is_bound_to_authorized_proxy_origin_and_valid_single_use_fields() {
        let origin = "https://site-1.proxy.example.test";
        let entry = format!("{origin}/_kx/login");
        let valid = ticket(origin);
        assert!(grant_url(&valid, &entry, "https://admin.example.test").is_ok());
        for invalid in [
            ticket("https://evil.example.test"),
            format!("{valid}&ticket={}", "c".repeat(64)),
            format!("{origin}/?ticket=a&proof=b"),
            format!("{valid}#fragment"),
            format!("{origin}/_kx/complete?ticket=bad&proof=bad"),
        ] {
            assert!(grant_url(&invalid, &entry, "https://admin.example.test").is_err());
        }
        assert!(grant_url(&valid, &entry, origin).is_err());
    }
    #[test]
    fn remote_navigation_cannot_escape_proxy_or_reach_local_ipc() {
        let origin = Url::parse("https://proxy.example.test").unwrap().origin();
        assert!(allowed_navigation(
            &Url::parse("https://proxy.example.test/path?q=1").unwrap(),
            &origin
        ));
        for url in [
            "https://admin.example.test",
            "https://proxy.example.test.evil.test",
            "http://proxy.example.test",
            "tauri://localhost",
            "file:///tmp/test",
            "javascript:alert(1)",
            "https://user:pass@proxy.example.test",
        ] {
            assert!(!allowed_navigation(&Url::parse(url).unwrap(), &origin));
        }
        assert!(web_url("http://site-1.localhost:18890/_kx/login").is_ok());
        assert!(web_url("http://proxy.example.test").is_err());
        assert!(web_url("https://tauri.localhost").is_err());
    }
    #[test]
    fn window_owners_are_separated_by_server_and_user_not_token_refresh() {
        let session = Session {
            token: "not-real".into(),
            uid: "1".into(),
            api_base: "https://api.example.test".into(),
            expires_at: 0,
            generation: 1,
        };
        let current = format!("{}7", owner_prefix(&session));
        assert!(!should_close("main", None));
        assert!(should_close(&current, None));
        assert!(!should_close(&current, Some(&owner_prefix(&session))));
        assert!(should_close(&current, Some("cookie-proxy-other-")));
        let mut other = session.clone();
        other.token = "refreshed".into();
        other.generation = 2;
        assert_eq!(owner_prefix(&session), owner_prefix(&other));
        other.uid = "2".into();
        assert_ne!(owner_prefix(&session), owner_prefix(&other));
        other.uid = session.uid.clone();
        other.api_base = "https://other.example.test".into();
        assert_ne!(owner_prefix(&session), owner_prefix(&other));
    }
}

#[cfg(test)]
mod capability_tests {
    #[test]
    fn proxy_windows_are_not_granted_native_capabilities() {
        let capability: serde_json::Value =
            serde_json::from_str(include_str!("../capabilities/main.json")).unwrap();
        assert_eq!(capability["windows"], serde_json::json!(["main"]));
        assert!(capability.get("remote").is_none());
    }
}
