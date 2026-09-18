use anyhow::{Result, ensure};
use kx_ed::KxEd;
use serde_json::Value;

pub async fn response(mut response: reqwest::Response, encrypted: bool) -> Result<Value> {
    let status = response.status();
    if status.as_u16() == 401 {
        anyhow::bail!("unauthorized");
    }
    let mut bytes = Vec::new();
    while let Some(chunk) = response.chunk().await? {
        ensure!(bytes.len() + chunk.len() <= 8 * 1024 * 1024, "响应过大");
        bytes.extend(chunk);
    }
    parse_response(status.as_u16(), &bytes, encrypted).await
}
async fn parse_response(status: u16, bytes: &[u8], encrypted: bool) -> Result<Value> {
    if status == 401 {
        anyhow::bail!("unauthorized");
    }
    // 错误也遵循 KxEd 协议；网关/提取器可能提前返回明文 JSON。
    let value = if encrypted {
        KxEd::de(bytes)
            .await
            .ok()
            .and_then(|v| serde_json::from_slice::<Value>(&v).ok())
            .or_else(|| {
                if status >= 400 {
                    serde_json::from_slice(bytes).ok()
                } else {
                    None
                }
            })
    } else {
        serde_json::from_slice(bytes).ok()
    };
    let Some(value) = value else {
        if status == 404 {
            anyhow::bail!("接口不存在（404），请确认服务地址并更新后端");
        }
        anyhow::bail!("服务响应无法解析（HTTP {status}），请检查后端或网关状态");
    };
    if value["code"] == 401 {
        anyhow::bail!("unauthorized");
    }
    if !(200..300).contains(&status) || value["code"] != 200 {
        let message = value["msg"]
            .as_str()
            .filter(|s| !s.trim().is_empty())
            .map(safe_message)
            .unwrap_or_else(|| match status {
                403 => "无权访问此接口，请检查资源管理权限".into(),
                404 => "接口不存在，请确认服务地址并更新后端".into(),
                _ => "服务拒绝操作，请检查后端状态".into(),
            });
        anyhow::bail!("{message}（HTTP {status}）");
    }
    Ok(value["result"].clone())
}
pub(crate) fn safe_message(message: &str) -> String {
    // 只展示有界诊断信息，避免错误中的签名地址/访问凭证进入持久化队列。
    let urls = regex::Regex::new(r#"(?i)https?://[^\s<>"']+"#).unwrap();
    let message = urls.replace_all(message, "[地址已隐藏]");
    let auth =
        regex::Regex::new(r"(?i)(?:authorization\s*[:=]\s*(?:bearer\s+)?|bearer\s+)[^\s,;]+")
            .unwrap();
    let message = auth.replace_all(&message, "[认证信息已隐藏]");
    let secrets = regex::Regex::new(r#"(?i)(?:access[_-]?token|refresh[_-]?token|access[_-]?key(?:[_-]?id)?|secret(?:[_-]?access)?[_-]?key|security[_-]?token|session[_-]?token|credential|signature|password)["']?\s*[:=]\s*["']?[^\s,;"']+"#).unwrap();
    secrets
        .replace_all(&message, "[凭证已隐藏]")
        .chars()
        .filter(|c| !c.is_control())
        .take(1000)
        .collect()
}

pub fn server(value: &str) -> Result<String> {
    let u = url::Url::parse(value.trim())?;
    ensure!(
        u.scheme() == "https"
            || (u.scheme() == "http"
                && matches!(u.host_str(), Some("localhost" | "127.0.0.1" | "[::1]"))),
        "服务地址必须使用 HTTPS（本机开发可用 HTTP）"
    );
    ensure!(
        u.username().is_empty()
            && u.password().is_none()
            && u.query().is_none()
            && u.fragment().is_none(),
        "服务地址不可包含凭据、参数或片段"
    );
    Ok(u.to_string().trim_end_matches('/').to_owned())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[tokio::test]
    async fn shared_codec_handles_success_and_malformed_response() {
        let value =
            serde_json::json!({"code":200,"result":{"title":"剧视频","id":9007199254740999_i64}});
        let encrypted = KxEd::en(&serde_json::to_vec(&value).unwrap())
            .await
            .unwrap();
        assert_eq!(
            parse_response(200, &encrypted, true).await.unwrap(),
            value["result"]
        );
        for bytes in [b"".as_slice(), &[0], &[32, 1]] {
            assert!(parse_response(200, bytes, true).await.is_err());
        }
    }
    #[tokio::test]
    async fn error_response_preserves_actionable_message() {
        let missing =
            serde_json::json!({"code":500,"msg":"请先在存储设置中配置剧视频存储","result":null});
        let bytes = serde_json::to_vec(&missing).unwrap();
        for status in [200, 409, 500] {
            let error = parse_response(status, &KxEd::en(&bytes).await.unwrap(), true)
                .await
                .unwrap_err()
                .to_string();
            assert!(error.contains("请先在存储设置中配置剧视频存储"));
        }
        assert!(
            parse_response(500, &bytes, true)
                .await
                .unwrap_err()
                .to_string()
                .contains("配置剧视频存储")
        );
        assert!(
            parse_response(502, b"<html>secret upstream details</html>", true)
                .await
                .unwrap_err()
                .to_string()
                .contains("HTTP 502")
        );
        assert_eq!(
            parse_response(401, b"", true)
                .await
                .unwrap_err()
                .to_string(),
            "unauthorized"
        );
        assert_eq!(
            parse_response(200, &KxEd::en(br#"{"code":401}"#).await.unwrap(), true)
                .await
                .unwrap_err()
                .to_string(),
            "unauthorized"
        );
    }
    #[test]
    fn diagnostics_redact_credentials_and_signed_urls() {
        let message = safe_message(
            "upload failed https://example.test/video?signature=secret Bearer abc access_token=xyz secret_key=hidden session_token=sts-value Credential=access-id/date",
        );
        for secret in [
            "signature=secret",
            "example.test",
            "abc",
            "xyz",
            "hidden",
            "sts-value",
            "access-id",
        ] {
            assert!(!message.contains(secret));
        }
        assert!(message.contains("upload failed"));
    }
    #[test]
    fn server_boundary() {
        assert!(server("http://example.com").is_err());
        assert!(server("https://user:pass@example.com").is_err());
        assert_eq!(
            server("https://example.com/api/").unwrap(),
            "https://example.com/api"
        );
        assert!(server("http://127.0.0.1:8883").is_ok());
    }
}
