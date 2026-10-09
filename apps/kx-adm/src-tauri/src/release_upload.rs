use crate::session::{Desktop, Session, SessionEvents};

#[cfg(test)]
mod tests;
use anyhow::{Context, Result, ensure};
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::{
    path::Path,
    sync::Arc,
    time::{Duration, Instant},
};
use tauri::{AppHandle, Emitter, State, WebviewWindow};
use tauri_plugin_dialog::DialogExt;
use tokio::io::{AsyncReadExt, AsyncSeekExt};

#[derive(Deserialize)]
struct Metadata {
    version: String,
    notes: String,
    target: String,
    name: String,
    signature: String,
    size: u64,
}
struct Bundle {
    file: tokio::fs::File,
    metadata: Metadata,
    offset: u64,
    modified: std::time::SystemTime,
}
#[derive(Serialize)]
pub struct Release {
    version: String,
    notes: String,
    artifacts: Vec<Artifact>,
}
#[derive(Serialize)]
struct Artifact {
    target: String,
    signature: String,
    file_id: String,
    url: String,
}
#[derive(Clone, Serialize)]
struct Progress {
    id: String,
    stage: String,
    bytes: u64,
    total: u64,
}

impl Bundle {
    async fn open(path: &Path) -> Result<Self> {
        let mut file = tokio::fs::File::open(path).await?;
        let info = file.metadata().await?;
        ensure!(info.is_file(), "请选择发行包文件");
        let mut header = [0; 12];
        file.read_exact(&mut header)
            .await
            .context("发行包头不完整")?;
        ensure!(&header[..8] == b"KXUPDATE", "请选择 .kx-update 发行包");
        let len = u32::from_le_bytes(header[8..].try_into().unwrap()) as usize;
        ensure!((1..=65536).contains(&len), "发行包元信息大小无效");
        let mut metadata = vec![0; len];
        file.read_exact(&mut metadata).await?;
        let metadata: Metadata = serde_json::from_slice(&metadata).context("发行包元信息无效")?;
        let offset = 12 + len as u64;
        ensure!(
            metadata.size > 0
                && metadata.size <= i64::MAX as u64
                && metadata.size.checked_add(offset) == Some(info.len()),
            "发行包长度不完整"
        );
        ensure!(
            regex::Regex::new(r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$")?
                .is_match(&metadata.version),
            "发行包版本号无效"
        );
        ensure!(
            metadata.notes.chars().count() <= 10000
                && !metadata.signature.trim().is_empty()
                && metadata.signature.len() <= 4096,
            "发行说明或签名无效"
        );
        ensure!(
            !metadata.name.is_empty()
                && !metadata.name.contains(['/', '\\'])
                && metadata.name.len() <= 255,
            "安装包文件名无效"
        );
        let valid = match metadata.target.as_str() {
            "darwin-aarch64" | "darwin-x86_64" => metadata.name.ends_with(".app.tar.gz"),
            "windows-x86_64" | "windows-aarch64" | "windows-i686" => {
                metadata.name.ends_with(".exe") || metadata.name.ends_with(".msi")
            }
            "linux-x86_64" | "linux-aarch64" | "linux-armv7" => {
                metadata.name.ends_with(".AppImage")
            }
            _ => false,
        };
        ensure!(valid, "安装包格式与平台不匹配");
        Ok(Self {
            file,
            metadata,
            offset,
            modified: info.modified()?,
        })
    }
    async fn unchanged(&self) -> Result<()> {
        let info = self.file.metadata().await?;
        ensure!(
            info.len() == self.offset + self.metadata.size && info.modified()? == self.modified,
            "上传期间发行包发生变化，请重新选择"
        );
        Ok(())
    }
}

async fn same_identity(desktop: &Desktop, identity: &Session) -> Result<()> {
    let current = desktop.identity().await?;
    ensure!(
        current.uid == identity.uid && current.api_base == identity.api_base,
        "登录身份已变化，发行包上传已取消"
    );
    Ok(())
}

async fn upload<E, P>(
    desktop: &Arc<Desktop>,
    events: &E,
    identity: &Session,
    code: &str,
    mut bundle: Bundle,
    progress: P,
) -> Result<Release>
where
    E: SessionEvents,
    P: Fn(&str, u64, u64) + Clone + Send + Sync + 'static,
{
    let total = bundle.metadata.size;
    progress("hashing", 0, total);
    let mut hash = md5::Context::new();
    let mut buffer = vec![0; 1024 * 1024];
    let mut bytes = 0;
    let mut last = Instant::now();
    loop {
        let n = bundle.file.read(&mut buffer).await?;
        if n == 0 {
            break;
        }
        bytes += n as u64;
        ensure!(bytes <= total, "发行包长度已变化");
        hash.consume(&buffer[..n]);
        if last.elapsed() >= Duration::from_millis(200) {
            same_identity(desktop, identity).await?;
            progress("hashing", bytes, total);
            last = Instant::now();
        }
    }
    ensure!(bytes == total, "发行包不完整");
    bundle.unchanged().await?;
    let md5 = format!("{:x}", hash.finalize());
    let path = Path::new(&bundle.metadata.name);
    let mut body = json!({ "file_name": path.file_stem().context("安装包名无效")?.to_string_lossy(), "file_ext": path.extension().context("安装包扩展名无效")?.to_string_lossy(), "md5_hash": md5, "size": total, "group_id": null });
    let code: String = url::form_urlencoded::byte_serialize(code.as_bytes())
        .collect::<String>()
        .replace('+', "%20");
    let base = format!("/adm/client-releases/uploads/{code}");
    progress("preparing", total, total);
    let prepared = desktop
        .api(
            events,
            identity,
            reqwest::Method::POST,
            &format!("{base}/prepare"),
            Some(&body),
        )
        .await?;
    let file = if prepared["upload_required"] == false {
        prepared["file"].clone()
    } else {
        let url = prepared["upload_url"].as_str().context("直传地址缺失")?;
        // 对象存储只接收签名请求头；不携带 KX token、Cookie 或设备证明。
        let destination = url::Url::parse(url).context("直传地址无效")?;
        ensure!(
            matches!(destination.scheme(), "https" | "http")
                && destination.host_str().is_some()
                && destination.username().is_empty()
                && destination.password().is_none()
                && destination.fragment().is_none(),
            "对象存储直传地址无效"
        );
        ensure!(prepared["method"] == "PUT", "对象存储直传方式不受支持");
        let client = reqwest::Client::builder()
            .redirect(reqwest::redirect::Policy::none())
            .connect_timeout(Duration::from_secs(20))
            .timeout(Duration::from_secs(7200))
            .build()?;
        let mut request = client
            .put(url)
            .header(reqwest::header::CONTENT_LENGTH, total);
        let headers = prepared["headers"].as_object().context("直传请求头无效")?;
        for (name, value) in headers {
            ensure!(
                !matches!(
                    name.to_ascii_lowercase().as_str(),
                    "authorization" | "cookie" | "proxy-authorization"
                ) && !name.to_ascii_lowercase().starts_with("x-kx-"),
                "直传请求头包含不允许的认证信息"
            );
            request = request.header(name, value.as_str().context("直传请求头无效")?);
        }
        bundle
            .file
            .seek(std::io::SeekFrom::Start(bundle.offset))
            .await?;
        let source = bundle.file.try_clone().await?;
        let owner = desktop.clone();
        let identity_copy = identity.clone();
        let notify = progress.clone();
        let mut sent = 0;
        let mut last = Instant::now();
        let stream = tokio_util::io::ReaderStream::new(source.take(total)).then(move |chunk| {
            let current = if let Ok(chunk) = &chunk {
                sent += chunk.len() as u64;
                sent
            } else {
                sent
            };
            let checkpoint = last.elapsed() >= Duration::from_millis(200) || current == total;
            if checkpoint {
                last = Instant::now();
            }
            let owner = owner.clone();
            let identity = identity_copy.clone();
            let notify = notify.clone();
            async move {
                if checkpoint {
                    same_identity(&owner, &identity)
                        .await
                        .map_err(|error| std::io::Error::other(error.to_string()))?;
                    notify("uploading", current, total);
                }
                chunk
            }
        });
        progress("uploading", 0, total);
        let response = request
            .body(reqwest::Body::wrap_stream(stream))
            .send()
            .await
            .map_err(|_| anyhow::anyhow!("对象存储上传失败，请检查网络或重新登录后重试"))?;
        ensure!(
            response.status().is_success(),
            "对象存储拒绝上传（HTTP {}），请检查存储配置",
            response.status().as_u16()
        );
        bundle.unchanged().await?;
        same_identity(desktop, identity).await?;
        body["key"] = prepared["key"].clone();
        body["etag"] = serde_json::Value::Null;
        progress("registering", total, total);
        desktop
            .api(
                events,
                identity,
                reqwest::Method::POST,
                &format!("{base}/complete"),
                Some(&body),
            )
            .await?
    };
    same_identity(desktop, identity).await?;
    let file_id = file["file"]["file_id"]
        .as_i64()
        .map(|id| id.to_string())
        .or_else(|| file["file"]["file_id"].as_str().map(str::to_owned))
        .context("登记文件未返回 ID")?;
    ensure!(
        file_id.parse::<i64>().is_ok_and(|id| id > 0),
        "登记文件 ID 无效"
    );
    progress("completed", total, total);
    Ok(Release {
        version: bundle.metadata.version,
        notes: bundle.metadata.notes,
        artifacts: vec![Artifact {
            target: bundle.metadata.target,
            signature: bundle.metadata.signature.trim().into(),
            file_id,
            url: String::new(),
        }],
    })
}

#[tauri::command]
pub async fn desktop_release_upload(
    window: WebviewWindow,
    app: AppHandle,
    desktop: State<'_, Arc<Desktop>>,
    storage_code: String,
    id: String,
    expected_version: Option<String>,
    existing_targets: Vec<String>,
) -> Result<Option<Release>, String> {
    async {
        crate::tiktok::local_caller(&window)?;
        let _guard = desktop
            .release_upload
            .try_lock()
            .context("发行包正在上传或客户端正在更新")?;
        let identity = desktop.identity().await?;
        let dialog = app.dialog().file().add_filter("发行包", &["kx-update"]);
        let chosen =
            tauri::async_runtime::spawn_blocking(move || dialog.blocking_pick_file()).await?;
        let Some(chosen) = chosen else {
            return Ok(None);
        };
        let bundle = Bundle::open(
            &chosen
                .into_path()
                .map_err(|_| anyhow::anyhow!("请选择本地发行包"))?,
        )
        .await?;
        if let Some(version) = expected_version {
            ensure!(
                version == bundle.metadata.version,
                "发行包版本与当前草稿不一致"
            );
        }
        ensure!(
            !existing_targets.contains(&bundle.metadata.target),
            "此平台已存在，请先移除后重新上传"
        );
        let events = app.clone();
        upload(
            &desktop,
            &app,
            &identity,
            &storage_code,
            bundle,
            move |stage, bytes, total| {
                let _ = events.emit_to(
                    "main",
                    "desktop-release-upload-progress",
                    Progress {
                        id: id.clone(),
                        stage: stage.into(),
                        bytes,
                        total,
                    },
                );
            },
        )
        .await
        .map(Some)
    }
    .await
    .map_err(|error: anyhow::Error| crate::protocol::safe_message(&error.to_string()))
}
