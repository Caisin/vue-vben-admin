use super::*;
use api::{Api, WebContext};
use reqwest::{
    Method,
    header::{HeaderMap, HeaderName, HeaderValue},
};
use tokio::io::AsyncReadExt;
mod sign;
const PART_SIZE: usize = 8 * 1024 * 1024;

struct Credential {
    access_key: String,
    secret_key: String,
    session_token: String,
    server_time: chrono::DateTime<chrono::Utc>,
    received: std::time::Instant,
}
fn timestamp(value: &Value) -> Option<chrono::DateTime<chrono::Utc>> {
    if let Some(text) = value.as_str() {
        return chrono::DateTime::parse_from_rfc3339(text)
            .ok()
            .map(|v| v.with_timezone(&chrono::Utc));
    }
    value.as_i64().and_then(|v| {
        if v > 1_000_000_000_000 {
            chrono::DateTime::from_timestamp_millis(v)
        } else {
            chrono::DateTime::from_timestamp(v, 0)
        }
    })
}
impl Credential {
    fn from_auth(value: &Value) -> Result<Self> {
        let token = &value["video_token_v5"];
        let required = |key: &str| {
            token[key]
                .as_str()
                .filter(|v| !v.is_empty())
                .map(str::to_owned)
                .context("TikTok 未返回完整的视频上传临时授权")
        };
        let server_time = timestamp(&token["current_time"]).unwrap_or_else(chrono::Utc::now);
        if let Some(expires) = timestamp(&token["expired_time"]) {
            ensure!(expires > server_time, "TikTok 返回的上传授权已过期");
        }
        Ok(Self {
            access_key: required("access_key_id")?,
            secret_key: required("secret_acess_key")?,
            session_token: required("session_token")?,
            server_time,
            received: std::time::Instant::now(),
        })
    }
    fn time(&self) -> chrono::DateTime<chrono::Utc> {
        self.server_time + chrono::Duration::from_std(self.received.elapsed()).unwrap_or_default()
    }
}
struct UploadNode {
    base: Url,
    store_uri: String,
    authorization: String,
    session_key: String,
    upload_id: Option<String>,
    headers: HeaderMap,
}
fn upload_host(host: &str, api: &Api) -> Result<Url> {
    let url = Url::parse(&if host.contains("://") {
        host.to_owned()
    } else {
        format!("https://{host}")
    })
    .context("TikTok 上传节点地址无效")?;
    #[cfg(test)]
    if url.origin() == api.base.origin()
        && url.scheme() == "http"
        && url.host_str() == Some("127.0.0.1")
    {
        return Ok(url);
    }
    let _ = api;
    ensure!(
        url.scheme() == "https"
            && url.port_or_known_default() == Some(443)
            && url.username().is_empty()
            && url.password().is_none()
            && url.query().is_none()
            && url.fragment().is_none()
            && url.path() == "/",
        "TikTok 上传节点地址不合法"
    );
    let host = url.host_str().context("TikTok 上传节点没有域名")?;
    ensure!(
        [
            "tiktok.com",
            "tiktokv.com",
            "tiktokv.us",
            "tiktokd.org",
            "tiktokcdn.com",
            "tiktokcdn-us.com",
            "tiktokcdn-eu.com",
            "byteoversea.com",
            "ibytedtos.com",
            "bytevcloudapi.com"
        ]
        .iter()
        .any(|suffix| host == *suffix || host.ends_with(&format!(".{suffix}"))),
        "TikTok 返回了尚未支持的上传节点域名"
    );
    Ok(url)
}
impl UploadNode {
    fn parse(value: &Value, api: &Api) -> Result<Self> {
        let node = &value["Result"]["InnerUploadAddress"]["UploadNodes"][0];
        let store = &node["StoreInfos"][0];
        let field = |object: &Value, key: &str| {
            object[key]
                .as_str()
                .filter(|v| !v.is_empty())
                .map(str::to_owned)
                .context("TikTok 未返回完整的上传节点")
        };
        let store_uri = field(store, "StoreUri")?;
        ensure!(
            !store_uri.starts_with('/')
                && !store_uri.split('/').any(|part| matches!(part, "." | "..")),
            "上传对象路径无效"
        );
        let mut headers = HeaderMap::new();
        if let Some(extra) = node["UploadHeader"].as_object() {
            for (name, value) in extra {
                let lower = name.to_ascii_lowercase();
                ensure!(
                    lower.starts_with("x-")
                        && !lower.starts_with("x-amz-")
                        && lower != "x-storage-u",
                    "上传节点返回了不支持的请求头"
                );
                let value = value
                    .as_str()
                    .map(str::to_owned)
                    .or_else(|| value.as_i64().map(|n| n.to_string()))
                    .context("上传节点请求头格式变化")?;
                let name = HeaderName::from_bytes(name.as_bytes())
                    .map_err(|_| anyhow::anyhow!("上传节点请求头无效"))?;
                let mut value = HeaderValue::from_str(&value)
                    .map_err(|_| anyhow::anyhow!("上传节点请求头值无效"))?;
                value.set_sensitive(true);
                headers.insert(name, value);
            }
        }
        Ok(Self {
            base: upload_host(&field(node, "UploadHost")?, api)?,
            store_uri,
            authorization: field(store, "Auth")?,
            session_key: field(node, "SessionKey")?,
            upload_id: store["UploadID"]
                .as_str()
                .filter(|v| !v.is_empty())
                .map(str::to_owned),
            headers,
        })
    }
    fn url(&self) -> Url {
        let mut url = self.base.clone();
        url.set_path(&format!("/upload/v1/{}", self.store_uri));
        url
    }
    fn headers(&self, uid: &str) -> Result<HeaderMap> {
        let mut headers = self.headers.clone();
        let mut auth = HeaderValue::from_str(&self.authorization)
            .map_err(|_| anyhow::anyhow!("上传授权头无效"))?;
        auth.set_sensitive(true);
        headers.insert(reqwest::header::AUTHORIZATION, auth);
        headers.insert(
            "x-storage-u",
            HeaderValue::from_str(uid).map_err(|_| anyhow::anyhow!("上传账号无效"))?,
        );
        Ok(headers)
    }
}
async fn signed(
    api: &Api,
    context: &WebContext,
    credential: &Credential,
    action: &str,
    size: Option<u64>,
    body: Option<Value>,
) -> Result<Value> {
    let mut url = api.base.join("top/v1")?;
    {
        let mut query = url.query_pairs_mut();
        query
            .append_pair("Action", action)
            .append_pair("Version", "2020-11-19")
            .append_pair("SpaceName", "tiktok")
            .append_pair("X-Amz-Expires", "604800");
        if let Some(size) = size {
            query
                .append_pair("FileType", "video")
                .append_pair("IsInner", "1")
                .append_pair("FileSize", &size.to_string())
                .append_pair("device_platform", "web")
                .append_pair("business_tag", "tiktok_video_submission_web")
                .append_pair("s", &uuid::Uuid::new_v4().simple().to_string());
        }
    }
    let method = if body.is_some() {
        Method::POST
    } else {
        Method::GET
    };
    let body = body
        .map(|v| serde_json::to_vec(&v))
        .transpose()?
        .unwrap_or_default();
    let headers = sign::headers(
        method.as_str(),
        &url,
        &body,
        credential,
        &context.region,
        credential.time(),
    )?;
    let mut request = api
        .http
        .request(method, url)
        .headers(headers)
        .header(reqwest::header::COOKIE, &api.login.cookie)
        .header(reqwest::header::USER_AGENT, &api.login.user_agent)
        .header(
            reqwest::header::REFERER,
            api.base.join("tiktokstudio/upload")?.as_str(),
        );
    if !body.is_empty() {
        request = request
            .header(reqwest::header::CONTENT_TYPE, "application/json")
            .body(body);
    }
    let response = request
        .send()
        .await
        .map_err(|_| anyhow::anyhow!("VOD {action} 请求失败"))?;
    let result = api::read_json(response, action).await?;
    ensure!(
        result["ResponseMetadata"]["Error"].is_null(),
        "VOD {action} 返回错误 {}",
        result["ResponseMetadata"]["Error"]["Code"]
            .as_str()
            .unwrap_or("unknown")
    );
    Ok(result)
}
async fn accepted(response: reqwest::Response, stage: &str) -> Result<Value> {
    let value = api::read_json(response, stage).await?;
    ensure!(
        value["code"].as_i64() == Some(2000),
        "{stage}被 TikTok 上传服务拒绝，状态码 {}",
        value["code"]
            .as_i64()
            .map(|v| v.to_string())
            .unwrap_or_else(|| "未知".into())
    );
    Ok(value)
}
pub(super) async fn upload(
    state: &TikTok,
    api: &Api,
    context: &WebContext,
    root: &Path,
    file: &VideoFile,
) -> Result<model::Media> {
    let mut source = open_video(root, file).await?;
    ensure!(!state.pause.load(Ordering::SeqCst), "已暂停，尚未提交预约");
    state
        .update(&file.id, "uploading", "正在获取视频直传授权", 0)
        .await?;
    let credential = Credential::from_auth(&api.upload_auth().await?)?;
    let apply = signed(
        api,
        context,
        &credential,
        "ApplyUploadInner",
        Some(file.size),
        None,
    )
    .await?;
    let node = UploadNode::parse(&apply, api)?;
    let headers = node.headers(&api.login.account.uid)?;
    let upload_id = if let Some(id) = &node.upload_id {
        id.clone()
    } else {
        let response = api
            .http
            .post(node.url())
            .query(&[("uploadmode", "part"), ("phase", "init")])
            .headers(headers.clone())
            .send()
            .await
            .map_err(|_| anyhow::anyhow!("初始化分片上传失败"))?;
        let value = accepted(response, "初始化分片上传").await?;
        value["data"]["uploadid"]
            .as_str()
            .filter(|v| !v.is_empty())
            .context("TikTok 未返回分片上传编号")?
            .to_owned()
    };
    let mut uploaded = 0_u64;
    let mut number = 1_u32;
    let mut checksums = Vec::new();
    while uploaded < file.size {
        ensure!(
            !state.pause.load(Ordering::SeqCst),
            "上传已暂停，尚未提交预约"
        );
        let length = (file.size - uploaded).min(PART_SIZE as u64) as usize;
        let mut chunk = vec![0; length];
        source
            .read_exact(&mut chunk)
            .await
            .context("视频读取失败或扫描后发生变化")?;
        let checksum = format!("{:08x}", crc32fast::hash(&chunk));
        let response = api
            .http
            .post(node.url())
            .query(&[("uploadid", upload_id.as_str()), ("device_platform", "web")])
            .headers(headers.clone())
            .header("X-Phase", "transfer")
            .header("X-Part-Number", number)
            .header("X-Part-Offset", uploaded)
            .header("Content-CRC32", &checksum)
            .header(reqwest::header::CONTENT_TYPE, "application/octet-stream")
            .body(chunk)
            .send()
            .await
            .map_err(|_| anyhow::anyhow!("视频分片 {number} 上传失败，尚未提交预约"))?;
        let result = accepted(response, "视频分片上传").await?;
        if let Some(actual) = result["data"]["crc32"].as_str() {
            ensure!(
                actual.eq_ignore_ascii_case(&checksum),
                "视频分片校验和不一致"
            );
        }
        uploaded += length as u64;
        checksums.push(format!("{number}:{checksum}"));
        number += 1;
        state
            .change(&file.id, |f| {
                f.bytes = uploaded;
                f.upload_percent = (uploaded * 100 / file.size) as u8;
                f.message = "原生 API 分片上传中".into();
            })
            .await?;
    }
    ensure!(
        fingerprint(&source.metadata().await?)? == file.modified
            && source.metadata().await?.len() == file.size,
        "视频在上传期间发生变化，未提交预约"
    );
    ensure!(
        !state.pause.load(Ordering::SeqCst),
        "上传已暂停，尚未提交预约"
    );
    let response = api
        .http
        .post(node.url())
        .query(&[("uploadid", upload_id.as_str()), ("device_platform", "web")])
        .headers(headers)
        .header("X-Phase", "finish")
        .header("X-Enable-Upload-Mode", "part")
        .header("X-Size", file.size)
        .header(reqwest::header::CONTENT_TYPE, "text/plain")
        .body(checksums.join(","))
        .send()
        .await
        .map_err(|_| anyhow::anyhow!("视频分片合并失败"))?;
    accepted(response, "视频分片合并").await?;
    ensure!(
        !state.pause.load(Ordering::SeqCst),
        "上传已暂停，尚未提交预约"
    );
    let result = signed(
        api,
        context,
        &credential,
        "CommitUploadInner",
        None,
        Some(json!({"SessionKey":node.session_key,"Functions":[{"name":"GetMeta"}]})),
    )
    .await?;
    let value = &result["Result"]["Results"][0];
    let media = model::Media {
        vid: value["Vid"]
            .as_str()
            .filter(|v| !v.is_empty())
            .context("上传提交未返回视频 ID")?
            .into(),
        duration: value["VideoMeta"]["Duration"]
            .as_f64()
            .context("上传提交未返回视频时长")?,
        width: value["VideoMeta"]["Width"]
            .as_u64()
            .and_then(|v| u32::try_from(v).ok())
            .unwrap_or(0),
        height: value["VideoMeta"]["Height"]
            .as_u64()
            .and_then(|v| u32::try_from(v).ok())
            .unwrap_or(0),
    };
    ensure!(
        media.duration.is_finite() && media.duration > 0.0,
        "视频时长无效"
    );
    Ok(media)
}
#[cfg(test)]
mod tests;
