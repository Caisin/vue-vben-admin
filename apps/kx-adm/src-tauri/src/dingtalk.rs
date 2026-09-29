//! 钉钉使用系统浏览器登录；一次性交换码通过 loopback 返回并由 PKCE 保护。
use crate::session::{Desktop, Session};
use anyhow::{Context, Result, ensure};
use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
use ring::rand::{SecureRandom, SystemRandom};
use sha2::{Digest, Sha256};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::TcpListener,
    time::{Duration, timeout},
};

pub async fn login(
    desktop: &Desktop,
    app: &tauri::AppHandle,
    app_key: Option<String>,
) -> Result<Session> {
    let (base, generation) = {
        let a = desktop.auth.lock().await;
        (a.base.clone(), a.generation)
    };
    let listener = TcpListener::bind(("127.0.0.1", 0)).await?;
    let callback_path = format!("/dingtalk/{}", uuid::Uuid::new_v4());
    let callback = format!(
        "http://127.0.0.1:{}{callback_path}",
        listener.local_addr()?.port()
    );
    let mut random = [0_u8; 32];
    SystemRandom::new()
        .fill(&mut random)
        .map_err(|_| anyhow::anyhow!("无法生成登录校验码"))?;
    let verifier = URL_SAFE_NO_PAD.encode(random);
    let challenge = URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()));
    let mut url = url::Url::parse(&format!("{base}/auth/dt/login"))?;
    if let Some(key) = app_key.filter(|v| !v.is_empty()) {
        url.path_segments_mut()
            .map_err(|_| anyhow::anyhow!("登录地址无效"))?
            .push(&key);
    }
    url.query_pairs_mut()
        .append_pair("redirect_url", &callback)
        .append_pair("code_challenge", &challenge)
        .append_pair("code_challenge_method", "S256");
    open::that(url.as_str())?;
    let code = timeout(
        Duration::from_secs(180),
        receive_code(&listener, &callback_path),
    )
    .await
    .context("钉钉登录超时，请重试")??;
    let response = desktop
        .http
        .post(format!("{base}/auth/dt/exchange"))
        .header("security", "true")
        .header("content-type", "application/json")
        .body(
            kx_ed::KxEd::en(&serde_json::to_vec(
                &serde_json::json!({"exchange_code":code,"code_verifier":verifier}),
            )?)
            .await?,
        )
        .send()
        .await?;
    let result = crate::protocol::response(response, true).await?;
    let token = result["access_token"]
        .as_str()
        .context("钉钉登录响应无效")?
        .to_owned();
    desktop
        .import_at(app, token, Some((base, generation)))
        .await
}
async fn receive_code(listener: &TcpListener, path: &str) -> Result<String> {
    loop {
        let (mut stream, peer) = listener.accept().await?;
        if !peer.ip().is_loopback() {
            continue;
        }
        let request = timeout(Duration::from_secs(3), async {
            let mut request = Vec::new();
            loop {
                let mut bytes = [0_u8; 1024];
                let n = stream.read(&mut bytes).await?;
                ensure!(n > 0, "回调连接已关闭");
                request.extend_from_slice(&bytes[..n]);
                ensure!(request.len() <= 8192, "回调请求过长");
                if request.windows(4).any(|v| v == b"\r\n\r\n") {
                    break;
                }
            }
            Ok::<_, anyhow::Error>(request)
        })
        .await;
        let code = request
            .ok()
            .and_then(Result::ok)
            .and_then(|bytes| parse_callback(&bytes, path));
        let body = if code.is_some() {
            "登录结果已返回，请回到桌面客户端查看设备授权状态。"
        } else {
            "无效的登录回调。"
        };
        let response = format!(
            "HTTP/1.1 {}\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Length: {}\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n{}",
            if code.is_some() {
                "200 OK"
            } else {
                "400 Bad Request"
            },
            body.len(),
            body
        );
        let _ = timeout(
            Duration::from_secs(2),
            stream.write_all(response.as_bytes()),
        )
        .await;
        if let Some(code) = code {
            return Ok(code);
        }
    }
}
fn parse_callback(bytes: &[u8], path: &str) -> Option<String> {
    let text = std::str::from_utf8(bytes).ok()?;
    let mut parts = text.lines().next()?.split_whitespace();
    if parts.next()? != "GET" {
        return None;
    }
    let target = parts.next()?;
    if !target.starts_with('/') || target.starts_with("//") {
        return None;
    }
    let url = url::Url::parse(&format!("http://127.0.0.1{target}")).ok()?;
    if url.path() != path {
        return None;
    }
    let codes = url
        .query_pairs()
        .filter(|(k, _)| k == "exchange_code")
        .collect::<Vec<_>>();
    if codes.len() != 1 {
        return None;
    }
    let code = codes[0].1.to_string();
    (!code.is_empty() && code.len() <= 2048).then_some(code)
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn callback_rejects_wrong_path_method_and_duplicate_codes() {
        assert_eq!(
            parse_callback(
                b"GET /secret?exchange_code=once HTTP/1.1\r\n\r\n",
                "/secret"
            ),
            Some("once".into())
        );
        for value in [
            "GET /other?exchange_code=x HTTP/1.1",
            "POST /secret?exchange_code=x HTTP/1.1",
            "GET /secret?exchange_code=x&exchange_code=y HTTP/1.1",
            "GET /secret?exchange_code= HTTP/1.1",
        ] {
            assert!(parse_callback(value.as_bytes(), "/secret").is_none());
        }
    }
}
