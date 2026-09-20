use super::*;
use hmac::{Hmac, Mac};
use sha2::{Digest, Sha256};

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}
fn hash(bytes: &[u8]) -> String {
    hex(&Sha256::digest(bytes))
}
fn hmac(key: &[u8], bytes: &[u8]) -> Vec<u8> {
    let mut mac = Hmac::<Sha256>::new_from_slice(key).expect("HMAC accepts arbitrary key length");
    mac.update(bytes);
    mac.finalize().into_bytes().to_vec()
}
fn encode(value: &str) -> String {
    value
        .as_bytes()
        .iter()
        .map(|&b| {
            if b.is_ascii_alphanumeric() || b"-._~".contains(&b) {
                char::from(b).to_string()
            } else {
                format!("%{b:02X}")
            }
        })
        .collect()
}
/// 对齐官网 VOD SigV4：仅签 X-Amz 头，Cookie/Host 不进入浏览器 SDK 的签名头集合。
pub(super) fn headers(
    method: &str,
    url: &Url,
    body: &[u8],
    credential: &Credential,
    region: &str,
    at: chrono::DateTime<chrono::Utc>,
) -> Result<reqwest::header::HeaderMap> {
    use reqwest::header::{AUTHORIZATION, HeaderMap, HeaderValue};
    let date = at.format("%Y%m%dT%H%M%SZ").to_string();
    let day = at.format("%Y%m%d").to_string();
    let mut headers = std::collections::BTreeMap::new();
    headers.insert("x-amz-date", date.clone());
    headers.insert("x-amz-security-token", credential.session_token.clone());
    let body_hash = hash(body);
    if !body.is_empty() {
        headers.insert("x-amz-content-sha256", body_hash.clone());
    }
    let names = headers.keys().copied().collect::<Vec<_>>().join(";");
    let canonical_headers = headers
        .iter()
        .map(|(name, value)| {
            format!(
                "{name}:{}",
                value.split_whitespace().collect::<Vec<_>>().join(" ")
            )
        })
        .collect::<Vec<_>>()
        .join("\n");
    let mut query: Vec<_> = url
        .query_pairs()
        .map(|(key, value)| (encode(&key), encode(&value)))
        .collect();
    query.sort();
    let query = query
        .iter()
        .map(|(key, value)| format!("{key}={value}"))
        .collect::<Vec<_>>()
        .join("&");
    let canonical = format!(
        "{}\n{}\n{}\n{}\n\n{}\n{}",
        method,
        url.path(),
        query,
        canonical_headers,
        names,
        body_hash
    );
    let scope = format!("{day}/{region}/vod/aws4_request");
    let to_sign = format!(
        "AWS4-HMAC-SHA256\n{date}\n{scope}\n{}",
        hash(canonical.as_bytes())
    );
    let key = hmac(
        format!("AWS4{}", credential.secret_key).as_bytes(),
        day.as_bytes(),
    );
    let key = hmac(&key, region.as_bytes());
    let key = hmac(&key, b"vod");
    let key = hmac(&key, b"aws4_request");
    let authorization = format!(
        "AWS4-HMAC-SHA256 Credential={}/{scope}, SignedHeaders={names}, Signature={}",
        credential.access_key,
        hex(&hmac(&key, to_sign.as_bytes()))
    );
    let mut result = HeaderMap::new();
    for (name, value) in headers {
        let mut value =
            HeaderValue::from_str(&value).map_err(|_| anyhow::anyhow!("VOD 签名头无效"))?;
        value.set_sensitive(true);
        result.insert(name, value);
    }
    let mut value =
        HeaderValue::from_str(&authorization).map_err(|_| anyhow::anyhow!("VOD 签名无效"))?;
    value.set_sensitive(true);
    result.insert(AUTHORIZATION, value);
    Ok(result)
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn signing_matches_independent_fixture_and_hashes_the_actual_body() -> Result<()> {
        let c = Credential {
            access_key: "test-key".into(),
            secret_key: "test-secret".into(),
            session_token: "test-session".into(),
            server_time: chrono::DateTime::parse_from_rfc3339("2026-09-19T12:00:00Z")?
                .with_timezone(&chrono::Utc),
            received: std::time::Instant::now(),
        };
        let url = Url::parse(
            "https://www.tiktok.com/top/v1?Version=2020-11-19&Action=CommitUploadInner&SpaceName=tiktok",
        )?;
        let body = br#"{"SessionKey":"fixture-session","Functions":[{"name":"GetMeta"}]}"#;
        let headers = headers("POST", &url, body, &c, "US-TTP", c.server_time)?;
        assert_eq!(
            headers["authorization"],
            "AWS4-HMAC-SHA256 Credential=test-key/20260919/US-TTP/vod/aws4_request, SignedHeaders=x-amz-content-sha256;x-amz-date;x-amz-security-token, Signature=250ff9125ade7677b04a2d10d0c90342c76decc4ac3391cbf3db2f12da89ba59"
        );
        assert_eq!(headers["x-amz-content-sha256"], hash(body));
        assert!(!headers.contains_key("cookie"));
        assert!(!headers.contains_key("host"));
        Ok(())
    }
}
