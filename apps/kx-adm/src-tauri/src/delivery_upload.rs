//! 交付文件原生流式传输。磁盘队列只保存选择路径与回执，不保存 token 或签名 URL。
use crate::session::{Desktop, Session};
use anyhow::{Context, Result, ensure};
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::{
    path::PathBuf,
    sync::Arc,
    time::{Duration, Instant},
};
use tauri::{AppHandle, Emitter, State, WebviewWindow};
use tauri_plugin_dialog::DialogExt;
use tokio::io::{AsyncReadExt, AsyncSeekExt};

#[derive(Clone, Serialize, Deserialize)]
pub struct File {
    path: PathBuf,
    pub name: String,
    #[serde(default)]
    pub relative_path: String,
    pub size: u64,
    modified: u64,
    pub file_id: Option<i64>,
    pub bytes: u64,
    pub status: String,
    pub error: String,
}
#[derive(Clone, Serialize, Deserialize)]
pub struct Job {
    pub id: String,
    api_base: String,
    uid: String,
    pub scope: i64,
    pub version: i64,
    pub kind: String,
    pub seq: i64,
    pub files: Vec<File>,
    pub status: String,
    #[serde(default = "default_concurrency")]
    pub concurrency: usize,
    #[serde(default)]
    pub revision: u64,
}
fn default_concurrency() -> usize {
    3
}
impl Job {
    pub fn view(&self) -> Value {
        let mut v = serde_json::to_value(self).expect("serializable job");
        v.as_object_mut().unwrap().remove("api_base");
        v.as_object_mut().unwrap().remove("uid");
        for f in v["files"].as_array_mut().unwrap() {
            f.as_object_mut().unwrap().remove("path");
        }
        v
    }
}
fn path(d: &Desktop) -> PathBuf {
    d.data.join("delivery-uploads.json")
}
fn load(d: &Desktop) -> Result<Vec<Job>> {
    let p = path(d);
    if p.exists() {
        Ok(serde_json::from_slice(&std::fs::read(p)?)?)
    } else {
        Ok(vec![])
    }
}
fn persist(d: &Desktop, rows: &[Job]) -> Result<()> {
    let target = path(d);
    let tmp = d.data.join("delivery-uploads.tmp");
    std::fs::write(&tmp, serde_json::to_vec(rows)?)?;
    std::fs::rename(tmp, target)?;
    Ok(())
}
fn store(d: &Desktop, job: &Job) -> Result<()> {
    let mut rows = load(d)?;
    if let Some(old) = rows.iter_mut().find(|j| j.id == job.id) {
        *old = job.clone();
    } else {
        rows.push(job.clone());
    }
    persist(d, &rows)
}
fn notify(app: &AppHandle, job: &Job) -> Result<()> {
    app.emit_to("main", "delivery-upload-updated", job.view())?;
    Ok(())
}
async fn checkpoint(d: &Desktop, owner: &Session) -> Result<()> {
    let s = d.identity().await?;
    ensure!(
        s.uid == owner.uid && s.api_base == owner.api_base,
        "登录会话已变化，请重新确认后重试"
    );
    ensure!(
        !d.delivery_cancel.load(std::sync::atomic::Ordering::Relaxed),
        "上传已暂停，可继续"
    );
    Ok(())
}
fn valid_kind(kind: &str) -> bool {
    [
        "film",
        "clean",
        "silent",
        "prompt",
        "project_image",
        "poster",
        "synopsis",
        "srt",
        "demo",
        "youtube",
    ]
    .contains(&kind)
}
fn extension_allowed(kind: &str, ext: &str) -> bool {
    match kind {
        "film" | "clean" | "silent" | "demo" | "youtube" => {
            ["mp4", "mov", "m4v", "webm"].contains(&ext)
        }
        "poster" | "project_image" => ["png", "jpg", "jpeg", "webp"].contains(&ext),
        "srt" => ext == "srt",
        _ => ["txt", "md", "pdf", "docx", "png", "jpg", "jpeg", "webp"].contains(&ext),
    }
}
fn selected_file(path: PathBuf, kind: &str) -> Result<File> {
    ensure!(!path.is_symlink(), "不接受符号链接，请选择实际文件");
    let path = path.canonicalize()?;
    let meta = std::fs::metadata(&path)?;
    ensure!(meta.is_file() && meta.len() > 0, "请选择非空普通文件");
    let name = path
        .file_name()
        .context("文件名缺失")?
        .to_string_lossy()
        .to_string();
    let ext = path
        .extension()
        .unwrap_or_default()
        .to_string_lossy()
        .to_ascii_lowercase();
    ensure!(extension_allowed(kind, &ext), "{name} 不符合当前材料类型");
    Ok(File {
        path,
        name,
        relative_path: String::new(),
        size: meta.len(),
        modified: crate::queue::modified(&meta),
        file_id: None,
        bytes: 0,
        status: "待上传".into(),
        error: String::new(),
    })
}
fn selected_directory(root: &std::path::Path, kind: &str) -> Result<Vec<File>> {
    ensure!(!root.is_symlink(), "不接受符号链接目录");
    let root = root.canonicalize()?;
    ensure!(root.is_dir(), "请选择目录");
    let mut directories = vec![root.clone()];
    let mut files = Vec::new();
    let mut scanned = 0;
    while let Some(dir) = directories.pop() {
        for entry in std::fs::read_dir(dir)? {
            let entry = entry?;
            scanned += 1;
            ensure!(scanned <= 20000, "目录项过多，请选择更具体的目录");
            let path = entry.path();
            if entry.file_name().to_string_lossy().starts_with('.') {
                continue;
            }
            ensure!(!path.is_symlink(), "目录包含符号链接，请移除后重试");
            if path.is_dir() {
                directories.push(path);
                continue;
            }
            let ext = path
                .extension()
                .unwrap_or_default()
                .to_string_lossy()
                .to_ascii_lowercase();
            if !extension_allowed(kind, &ext) {
                continue;
            }
            let mut file = selected_file(path, kind)?;
            file.relative_path = file
                .path
                .strip_prefix(&root)?
                .to_string_lossy()
                .replace('\\', "/");
            files.push(file);
            ensure!(files.len() <= 1000, "每个目录最多1000个受支持文件");
        }
    }
    ensure!(!files.is_empty(), "目录中没有当前类型支持的文件");
    files.sort_by(|a, b| a.relative_path.cmp(&b.relative_path));
    Ok(files)
}

fn unchanged(file: &File) -> Result<()> {
    ensure!(
        !file.path.is_symlink() && file.path.canonicalize()? == file.path,
        "文件路径已变化，请重新选择"
    );
    let meta = std::fs::metadata(&file.path)?;
    ensure!(
        meta.is_file() && meta.len() == file.size && crate::queue::modified(&meta) == file.modified,
        "文件大小或修改时间已变化，请重新选择"
    );
    Ok(())
}
#[tauri::command]
pub async fn delivery_upload_pick(
    app: AppHandle,
    window: WebviewWindow,
    state: State<'_, Arc<Desktop>>,
    scope: i64,
    version: i64,
    kind: String,
    seq: i64,
    multiple: bool,
    directory: Option<bool>,
) -> Result<Option<Value>, String> {
    async {
        crate::tiktok::local_caller(&window)?;
        ensure!(
            scope < 0 && version > 0 && seq >= 0 && valid_kind(&kind),
            "上传目标无效"
        );
        let _guard = state
            .release_upload
            .try_lock()
            .context("已有文件传输或应用更新正在进行")?;
        let owner = state.identity().await?;
        let picker = app.clone();
        let file_kind = kind.clone();
        let files = tauri::async_runtime::spawn_blocking(move || -> Result<Option<Vec<File>>> {
            if directory.unwrap_or(false) {
                ensure!(multiple, "单集替换不能选择目录");
                let Some(folder) = picker
                    .dialog()
                    .file()
                    .set_title("选择上传目录")
                    .blocking_pick_folder()
                else {
                    return Ok(None);
                };
                let root = folder
                    .into_path()
                    .map_err(|_| anyhow::anyhow!("目录路径无效"))?;
                Ok(Some(selected_directory(&root, &file_kind)?))
            } else {
                let Some(paths) = picker
                    .dialog()
                    .file()
                    .set_title("选择上传文件")
                    .blocking_pick_files()
                else {
                    return Ok(None);
                };
                ensure!(paths.len() <= 1000, "每次最多1000个文件");
                ensure!(multiple || paths.len() == 1, "替换单集请只选择一个视频");
                Ok(Some(
                    paths
                        .into_iter()
                        .map(|p| {
                            selected_file(
                                p.into_path().map_err(|_| anyhow::anyhow!("文件路径无效"))?,
                                &file_kind,
                            )
                        })
                        .collect::<Result<Vec<_>>>()?,
                ))
            }
        })
        .await??;
        let Some(files) = files else {
            return Ok(None);
        };
        let current = state.identity().await?;
        ensure!(
            current.uid == owner.uid
                && current.api_base == owner.api_base
                && current.generation == owner.generation,
            "选择期间账号发生变化"
        );
        let job = Job {
            id: uuid::Uuid::new_v4().to_string(),
            api_base: owner.api_base,
            uid: owner.uid,
            scope,
            version,
            kind,
            seq,
            files,
            status: "待确认".into(),
            concurrency: default_concurrency(),
            revision: 0,
        };
        store(&state, &job)?;
        Ok(Some(job.view()))
    }
    .await
    .map_err(|e: anyhow::Error| e.to_string())
}
mod execution;

fn configure_job(
    job: &mut Job,
    expected_revision: u64,
    indices: &[usize],
    concurrency: usize,
) -> Result<()> {
    ensure!(
        job.revision == expected_revision,
        "上传清单已变化，请刷新后重试"
    );
    ensure!((1..=8).contains(&concurrency), "同时上传文件数应为1至8");
    ensure!(!indices.is_empty(), "请至少保留一个文件");
    let selected = indices
        .iter()
        .copied()
        .collect::<std::collections::BTreeSet<_>>();
    ensure!(
        selected.len() == indices.len() && selected.iter().all(|i| *i < job.files.len()),
        "上传清单索引无效或重复"
    );
    let revision = job.revision.checked_add(1).context("上传清单修订无效")?;
    job.files = job
        .files
        .iter()
        .enumerate()
        .filter(|(index, _)| selected.contains(index))
        .map(|(_, file)| file.clone())
        .collect();
    job.concurrency = concurrency;
    job.revision = revision;
    job.status = if job.files.iter().all(|f| f.file_id.is_some()) {
        "上传完成，待提交材料"
    } else {
        "待确认"
    }
    .into();
    Ok(())
}

#[tauri::command]
pub async fn delivery_upload_update(
    window: WebviewWindow,
    state: State<'_, Arc<Desktop>>,
    id: String,
    expected_revision: u64,
    indices: Vec<usize>,
    concurrency: usize,
) -> Result<Value, String> {
    async {
        crate::tiktok::local_caller(&window)?;
        let _guard = state
            .release_upload
            .try_lock()
            .context("上传进行中，请暂停后编辑清单")?;
        let owner = state.identity().await?;
        let mut job = load(&state)?
            .into_iter()
            .find(|j| j.id == id && j.uid == owner.uid && j.api_base == owner.api_base)
            .context("上传任务不存在或属于其他账号")?;
        configure_job(&mut job, expected_revision, &indices, concurrency)?;
        store(&state, &job)?;
        Ok(job.view())
    }
    .await
    .map_err(|e: anyhow::Error| crate::protocol::safe_message(&e.to_string()))
}

#[tauri::command]
pub async fn delivery_upload_jobs(
    window: WebviewWindow,
    state: State<'_, Arc<Desktop>>,
) -> Result<Vec<Value>, String> {
    async {
        crate::tiktok::local_caller(&window)?;
        // 文件通过临时文件+rename 原子替换，读取列表无需等待整批传输结束。
        let active = state.release_upload.try_lock().is_err();
        let owner = state.identity().await?;
        Ok(load(&state)?
            .into_iter()
            .filter(|j| j.uid == owner.uid && j.api_base == owner.api_base)
            .map(|mut j| {
                if j.status == "上传中" && !active {
                    j.status = "已暂停".into();
                }
                j.view()
            })
            .collect())
    }
    .await
    .map_err(|e: anyhow::Error| e.to_string())
}
#[tauri::command]
pub fn delivery_upload_pause(
    window: WebviewWindow,
    state: State<'_, Arc<Desktop>>,
) -> Result<(), String> {
    crate::tiktok::local_caller(&window).map_err(|e| e.to_string())?;
    state
        .delivery_cancel
        .store(true, std::sync::atomic::Ordering::Relaxed);
    Ok(())
}
#[tauri::command]
pub async fn delivery_upload_run(
    app: AppHandle,
    window: WebviewWindow,
    state: State<'_, Arc<Desktop>>,
    id: String,
    expected_revision: u64,
) -> Result<Value, String> {
    async {
        crate::tiktok::local_caller(&window)?;
        let _guard = state
            .release_upload
            .try_lock()
            .context("已有文件传输或应用更新正在进行")?;
        state
            .delivery_cancel
            .store(false, std::sync::atomic::Ordering::Relaxed);
        let owner = state.identity().await?;
        let mut job = load(&state)?
            .into_iter()
            .find(|j| j.id == id && j.uid == owner.uid && j.api_base == owner.api_base)
            .context("上传任务不存在或属于其他账号")?;
        ensure!(
            job.revision == expected_revision,
            "上传清单已变化，请刷新后重试"
        );
        ensure!(
            !job.files.is_empty() && (1..=8).contains(&job.concurrency),
            "上传清单或并发设置无效"
        );
        job.revision = job.revision.checked_add(1).context("上传清单修订无效")?;
        job.status = "上传中".into();
        store(&state, &job)?;
        notify(&app, &job)?;
        let base = format!(
            "/adm/res/delivery/{}/{}/transfer/{}/{}",
            job.scope, job.version, job.kind, job.seq
        );
        let result = async {
            let ctx = state
                .api(&app, &owner, reqwest::Method::GET, &base, None)
                .await?;
            execution::run_files(
                &mut job,
                |index, file, progress| {
                    let state = &state;
                    let app = &app;
                    let owner = &owner;
                    let base = &base;
                    let local = ctx["local"] == true;
                    async move {
                        transfer(state, app, owner, base, &file, local, |stage, bytes| {
                            let _ = progress.try_send((index, stage.to_owned(), bytes));
                        })
                        .await
                    }
                },
                |current, persist| {
                    if persist {
                        store(&state, current)?;
                    }
                    notify(&app, current)
                },
            )
            .await?;
            Ok::<_, anyhow::Error>(())
        }
        .await;
        job.status = if result.is_ok() {
            "上传完成，待提交材料"
        } else {
            "已暂停"
        }
        .into();
        store(&state, &job)?;
        notify(&app, &job)?;
        result?;
        Ok(job.view())
    }
    .await
    .map_err(|e: anyhow::Error| crate::protocol::safe_message(&e.to_string()))
}
async fn transfer<F: FnMut(&str, u64)>(
    desktop: &Arc<Desktop>,
    app: &impl crate::session::SessionEvents,
    owner: &Session,
    base: &str,
    file: &File,
    local: bool,
    mut progress: F,
) -> Result<i64> {
    unchanged(file)?;
    let mut source = tokio::fs::File::open(&file.path).await?;
    let mut hash = md5::Context::new();
    let mut buffer = vec![0; 1024 * 1024];
    let mut count = 0;
    let mut last = Instant::now();
    loop {
        checkpoint(desktop, owner).await?;
        let n = source.read(&mut buffer).await?;
        if n == 0 {
            break;
        }
        hash.consume(&buffer[..n]);
        count += n as u64;
        if last.elapsed() >= Duration::from_millis(250) {
            progress("校验文件", count);
            last = Instant::now();
        }
    }
    ensure!(count == file.size, "文件长度变化");
    unchanged(file)?;
    let md5 = format!("{:x}", hash.finalize());
    source.seek(std::io::SeekFrom::Start(0)).await?;
    let ext = file
        .path
        .extension()
        .unwrap_or_default()
        .to_string_lossy()
        .to_ascii_lowercase();
    let mut body = json!({"file_name":file.name,"file_ext":ext,"size":file.size,"md5_hash":md5,"group_id":null});
    // 有界通道把流式进度交回调用栈，队列记录不持有文件全部字节。
    let (tx, mut rx) = tokio::sync::mpsc::channel::<u64>(8);
    let d = desktop.clone();
    let identity = owner.clone();
    let total = file.size;
    let mut bytes = 0;
    let mut last = Instant::now();
    let stream = tokio_util::io::ReaderStream::new(source).then(move |chunk| {
        let d = d.clone();
        let identity = identity.clone();
        let tx = tx.clone();
        if let Ok(c) = &chunk {
            bytes += c.len() as u64;
        }
        let current = bytes;
        let due = last.elapsed() >= Duration::from_millis(200) || current == total;
        if due {
            last = Instant::now();
        }
        async move {
            checkpoint(&d, &identity)
                .await
                .map_err(|e| std::io::Error::other(e.to_string()))?;
            if due {
                let _ = tx.try_send(current);
            }
            chunk
        }
    });
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .connect_timeout(Duration::from_secs(20))
        .timeout(Duration::from_secs(7200))
        .build()?;
    let request = if local {
        ensure!(
            file.size <= 512 * 1024 * 1024,
            "本地存储单文件最多512MB；大文件请配置对象存储"
        );
        desktop
            .api(app, owner, reqwest::Method::GET, base, None)
            .await?;
        let session = desktop.identity().await?;
        let mut request = client
            .post(format!("{}{base}/upload", session.api_base))
            .header("x-kx-client", "tauri")
            .bearer_auth(&session.token);
        for (k, v) in desktop.device.headers(&session.token) {
            request = request.header(k, v);
        }
        request.multipart(
            reqwest::multipart::Form::new().part(
                "file",
                reqwest::multipart::Part::stream_with_length(
                    reqwest::Body::wrap_stream(stream),
                    file.size,
                )
                .file_name(file.name.clone()),
            ),
        )
    } else {
        let prepared = desktop
            .api(
                app,
                owner,
                reqwest::Method::POST,
                &format!("{base}/prepare"),
                Some(&body),
            )
            .await?;
        if prepared["upload_required"] == false {
            return number(&prepared["file"]["file"]["file_id"]);
        }
        let url = prepared["upload_url"]
            .as_str()
            .context("缺少签名上传地址")?;
        validate_destination(url)?;
        ensure!(prepared["method"] == "PUT", "上传方式不受支持");
        let mut request = client
            .put(url)
            .header(reqwest::header::CONTENT_LENGTH, file.size);
        for (k, v) in prepared["headers"].as_object().context("上传请求头无效")? {
            let key = k.to_ascii_lowercase();
            ensure!(
                !["authorization", "cookie", "proxy-authorization"].contains(&key.as_str())
                    && !key.starts_with("x-kx-"),
                "不安全的直传请求头"
            );
            request = request.header(k, v.as_str().context("请求头无效")?);
        }
        body["key"] = prepared["key"].clone();
        body["etag"] = Value::Null;
        request.body(reqwest::Body::wrap_stream(stream))
    };
    progress("上传中", 0);
    let future = request.send();
    tokio::pin!(future);
    let mut cancellation = tokio::time::interval(Duration::from_millis(250));
    let response = loop {
        tokio::select! {_ = cancellation.tick()=>{checkpoint(desktop,owner).await?;},response=&mut future=>break response.map_err(|_|anyhow::anyhow!("传输失败，请重试"))?,Some(bytes)=rx.recv()=>progress("上传中",bytes)}
    };
    checkpoint(desktop, owner).await?;
    unchanged(file)?;
    if local {
        let result = crate::protocol::response(response, false).await?;
        number(&result["file_id"])
    } else {
        ensure!(
            response.status().is_success(),
            "对象存储拒绝上传（HTTP {}）",
            response.status().as_u16()
        );
        progress("登记文件", file.size);
        let result = desktop
            .api(
                app,
                owner,
                reqwest::Method::POST,
                &format!("{base}/complete"),
                Some(&body),
            )
            .await?;
        number(&result["file"]["file_id"])
    }
}
fn number(v: &Value) -> Result<i64> {
    v.as_i64()
        .or_else(|| v.as_str().and_then(|s| s.parse().ok()))
        .filter(|id| *id > 0)
        .context("文件登记未返回有效编号")
}
fn validate_destination(value: &str) -> Result<()> {
    let u = url::Url::parse(value)?;
    ensure!(
        matches!(u.scheme(), "http" | "https")
            && u.host_str().is_some()
            && u.username().is_empty()
            && u.password().is_none()
            && u.fragment().is_none(),
        "对象存储地址无效"
    );
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn file_types_paths_and_changed_files_are_checked() -> Result<()> {
        let dir = tempfile::tempdir()?;
        let p = dir.path().join("poster.png");
        std::fs::write(&p, b"test")?;
        assert!(selected_file(p.clone(), "film").is_err());
        let f = selected_file(p.clone(), "poster")?;
        unchanged(&f)?;
        std::fs::write(&p, b"changed")?;
        assert!(unchanged(&f).is_err());
        assert!(validate_destination("file:///tmp/test").is_err());
        assert!(validate_destination("https://user:secret@example.com/a").is_err());
        Ok(())
    }
    #[test]
    fn completed_receipts_survive_restart_and_paths_stay_native() -> Result<()> {
        let dir = tempfile::tempdir()?;
        let d = Desktop::new(dir.path().to_path_buf())?;
        let p = dir.path().join("sample.pdf");
        std::fs::write(&p, b"pdf")?;
        let mut f = selected_file(p, "synopsis")?;
        f.file_id = Some(8);
        let j = Job {
            id: "retry".into(),
            api_base: "https://example.test".into(),
            uid: "7".into(),
            scope: -1,
            version: 2,
            kind: "synopsis".into(),
            seq: 0,
            files: vec![f],
            status: "已暂停".into(),
            concurrency: default_concurrency(),
            revision: 0,
        };
        store(&d, &j)?;
        assert_eq!(load(&d)?[0].files[0].file_id, Some(8));
        assert!(j.view()["files"][0].get("path").is_none());
        assert!(j.view().get("uid").is_none());
        Ok(())
    }
}

#[cfg(test)]
mod http_tests;

#[cfg(test)]
mod directory_tests {
    use super::*;
    #[test]
    fn directory_preserves_relative_names_and_filters_by_material_kind() -> Result<()> {
        let root = tempfile::tempdir()?;
        std::fs::create_dir(root.path().join("第1集"))?;
        std::fs::write(root.path().join("第1集/01.mp4"), b"video")?;
        std::fs::write(root.path().join("第1集/01.srt"), b"subtitle")?;
        std::fs::write(root.path().join(".DS_Store"), b"ignored")?;
        let video = selected_directory(root.path(), "film")?;
        assert_eq!(video.len(), 1);
        assert_eq!(video[0].relative_path, "第1集/01.mp4");
        assert_eq!(video[0].name, "01.mp4");
        let srt = selected_directory(root.path(), "srt")?;
        assert_eq!(srt.len(), 1);
        assert_eq!(srt[0].relative_path, "第1集/01.srt");
        assert!(selected_directory(root.path(), "project_image").is_err());
        Ok(())
    }
    #[cfg(unix)]
    #[test]
    fn directory_rejects_symbolic_links() -> Result<()> {
        let root = tempfile::tempdir()?;
        let outside = tempfile::tempdir()?;
        std::fs::write(outside.path().join("01.mp4"), b"video")?;
        std::os::unix::fs::symlink(outside.path(), root.path().join("linked"))?;
        assert!(selected_directory(root.path(), "film").is_err());
        Ok(())
    }
}
