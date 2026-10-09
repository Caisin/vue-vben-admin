use anyhow::{Context, Result, ensure};
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::{path::PathBuf, sync::Arc};
use tauri::{AppHandle, Emitter};
use tokio::io::AsyncWriteExt;

use crate::{
    protocol,
    session::{Desktop, Session},
};
mod direct;
mod local_files;
use direct::{DownloadLink, DownloadReceipt};

#[derive(Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct DownloadFile {
    pub file_id: i64,
    pub file_name: String,
    pub size: u64,
    pub bytes: u64,
    pub status: String,
    pub error: String,
    pub pending_receipt: Option<DownloadReceipt>,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct DownloadJob {
    pub id: String,
    pub api_base: String,
    pub uid: String,
    pub res_id: i64,
    #[serde(default)]
    pub version_id: i64,
    #[serde(default)]
    pub task_id: i64,
    pub directory: PathBuf,
    pub concurrency: usize,
    pub overwrite: bool,
    pub status: String,
    pub error: String,
    pub files: Vec<DownloadFile>,
}

impl Default for DownloadJob {
    fn default() -> Self {
        Self {
            id: String::new(),
            api_base: String::new(),
            uid: String::new(),
            res_id: 0,
            version_id: 0,
            task_id: 0,
            directory: PathBuf::new(),
            concurrency: 4,
            overwrite: false,
            status: "已暂停".into(),
            error: String::new(),
            files: Vec::new(),
        }
    }
}

impl DownloadJob {
    fn view(&self) -> Value {
        let mut value = serde_json::to_value(self).expect("download job serializes");
        value.as_object_mut().unwrap().remove("directory");
        value["targetDirectory"] = json!(display_directory(&self.directory.to_string_lossy()));
        value
    }
}

/// 只转换展示路径；磁盘操作保留 Windows 扩展路径以支持长路径。
pub(crate) fn display_directory(path: &str) -> String {
    if let Some(share) = path.strip_prefix(r"\\?\UNC\") {
        return format!(r"\\{share}");
    }
    if let Some(drive) = path.strip_prefix(r"\\?\") {
        let bytes = drive.as_bytes();
        if bytes.len() >= 3 && bytes[0].is_ascii_alphabetic() && &bytes[1..3] == b":\\" {
            return drive.to_owned();
        }
    }
    path.to_owned()
}

pub trait DownloadEvents: crate::session::SessionEvents + Clone + Send + Sync + 'static {
    fn download_updated(&self, job: Value) -> Result<()>;
}
impl DownloadEvents for AppHandle {
    fn download_updated(&self, job: Value) -> Result<()> {
        self.emit_to("main", "desktop-download-updated", job)?;
        Ok(())
    }
}

pub fn load(data: &std::path::Path) -> Result<Vec<DownloadJob>> {
    let path = data.join("download-queue.json");
    if !path.exists() {
        return Ok(Vec::new());
    }
    let mut jobs: Vec<DownloadJob> = serde_json::from_slice(&std::fs::read(path)?)?;
    for job in &mut jobs {
        if job.status == "下载中" {
            job.status = "已暂停".into();
        }
    }
    Ok(jobs)
}

fn persist(data: &std::path::Path, jobs: &[DownloadJob]) -> Result<()> {
    let tmp = data.join("download-queue.tmp");
    std::fs::write(&tmp, serde_json::to_vec(jobs)?)?;
    std::fs::rename(tmp, data.join("download-queue.json"))?;
    Ok(())
}

impl Desktop {
    pub(crate) async fn pause_downloads(&self) -> Result<()> {
        let mut queue = self.download_queue.lock().await;
        for job in queue.iter_mut() {
            if job.status == "下载中" {
                job.status = "已暂停".into();
            }
        }
        persist(&self.data, &queue)
    }

    pub async fn download_jobs(&self) -> Result<Vec<Value>> {
        let s = self.identity().await?;
        Ok(self
            .download_queue
            .lock()
            .await
            .iter()
            .filter(|j| j.uid == s.uid && j.api_base == s.api_base)
            .map(DownloadJob::view)
            .collect())
    }

    pub async fn add_download(
        self: &Arc<Self>,
        app: &impl DownloadEvents,
        res_id: i64,
        version_id: i64,
        file_ids: Vec<i64>,
        directory: PathBuf,
        concurrency: usize,
    ) -> Result<Value> {
        ensure!((1..=8).contains(&concurrency), "下载并发数须为 1 至 8");
        let identity = self.identity().await?;
        ensure!(directory.is_dir(), "下载目录不存在");
        let directory = directory.canonicalize().context("无法读取下载目录")?;
        let prepared = self
            .api(
                app,
                &identity,
                reqwest::Method::POST,
                "/api/res/downloads/prepare",
                Some(&json!({"res_id": res_id, "version_id": version_id, "file_ids": file_ids, "include_cover": true})),
            )
            .await
            .map_err(|error| anyhow::anyhow!("服务端准备下载失败：{error}"))?;
        let (directory, files) = download_layout(&directory, &prepared)?;
        tokio::fs::create_dir_all(&directory)
            .await
            .map_err(|error| anyhow::anyhow!("创建剧目下载目录失败：{error}"))?;
        let job = DownloadJob {
            id: uuid::Uuid::new_v4().to_string(),
            api_base: identity.api_base.clone(),
            uid: identity.uid.clone(),
            res_id,
            version_id,
            task_id: prepared["task_id"].as_i64().unwrap_or_default(),
            directory,
            concurrency,
            overwrite: false,
            status: "已暂停".into(),
            error: String::new(),
            files,
        };
        let id = job.id.clone();
        {
            let mut queue = self.download_queue.lock().await;
            let mut next = queue.clone();
            next.push(job);
            persist(&self.data, &next)?;
            *queue = next;
        }
        self.resume_download((*app).clone(), id.clone(), false, None)
            .await?;
        let queue = self.download_queue.lock().await;
        Ok(queue
            .iter()
            .find(|job| job.id == id)
            .context("下载任务不存在")?
            .view())
    }

    pub async fn pause_download(&self, app: &impl DownloadEvents, id: &str) -> Result<()> {
        let identity = self.identity().await?;
        let mut queue = self.download_queue.lock().await;
        let view = {
            let job = queue
                .iter_mut()
                .find(|j| j.id == id && j.uid == identity.uid && j.api_base == identity.api_base)
                .ok_or_else(|| anyhow::anyhow!("下载任务不存在或属于其他账号"))?;
            job.status = "已暂停".into();
            job.view()
        };
        persist(&self.data, &queue)?;
        app.download_updated(view)?;
        Ok(())
    }

    pub async fn set_download_concurrency(
        &self,
        app: &impl DownloadEvents,
        id: &str,
        concurrency: usize,
    ) -> Result<Value> {
        ensure!((1..=8).contains(&concurrency), "下载并发数须为 1 至 8");
        let active = self
            .download_active
            .try_lock()
            .context("正在安装更新或启动任务，请稍后重试")?;
        ensure!(!active.contains(id), "请等待下载任务停止后再调整并发");
        let identity = self.identity().await?;
        let mut queue = self.download_queue.lock().await;
        let mut next = queue.clone();
        let job = next
            .iter_mut()
            .find(|j| j.id == id && j.uid == identity.uid && j.api_base == identity.api_base)
            .context("下载任务不存在或属于其他账号")?;
        ensure!(job.status != "下载中", "请暂停下载后再调整并发");
        job.concurrency = concurrency;
        let view = job.view();
        persist(&self.data, &next)?;
        *queue = next;
        app.download_updated(view.clone())?;
        Ok(view)
    }

    pub async fn resume_download(
        self: &Arc<Self>,
        app: impl DownloadEvents,
        id: String,
        overwrite: bool,
        directory: Option<PathBuf>,
    ) -> Result<()> {
        let mut active = self
            .download_active
            .try_lock()
            .context("正在安装更新或启动任务，请稍后重试")?;
        ensure!(!active.contains(&id), "任务仍在停止中，请稍后再继续");
        let s = self.identity().await?;
        {
            let mut queue = self.download_queue.lock().await;
            // 先保存候选队列；目录或磁盘校验失败不改变当前任务。
            let mut next = queue.clone();
            let job = next
                .iter_mut()
                .find(|j| j.id == id && j.uid == s.uid && j.api_base == s.api_base)
                .ok_or_else(|| anyhow::anyhow!("下载任务不存在或属于其他账号"))?;
            ensure!(job.status != "下载中", "下载任务正在执行");
            let mut directory_changed = false;
            if let Some(directory) = directory {
                ensure!(
                    directory.is_absolute() && directory.is_dir(),
                    "请选择有效的本地下载目录"
                );
                let directory = directory.canonicalize().context("无法读取下载目录")?;
                directory_changed = directory != job.directory;
                job.directory = directory;
            }
            job.status = "下载中".into();
            job.overwrite = overwrite;
            job.error.clear();
            for file in &mut job.files {
                file.error.clear();
                if overwrite || directory_changed {
                    file.status = "待下载".into();
                    file.bytes = 0;
                }
            }
            let view = job.view();
            persist(&self.data, &next)?;
            *queue = next;
            // 启动事件只用于刷新界面，发送失败不能阻止已持久化任务执行。
            let _ = app.download_updated(view);
        }
        active.insert(id.clone());
        drop(active);
        let this = self.clone();
        tauri::async_runtime::spawn(async move {
            let result = this.run_download(&app, &id).await;
            if let Err(error) = result {
                {
                    let mut queue = this.download_queue.lock().await;
                    let view = if let Some(job) = queue.iter_mut().find(|j| j.id == id) {
                        job.status = "下载失败".into();
                        job.error = protocol::safe_message(&format!("{error:#}"));
                        Some(job.view())
                    } else {
                        None
                    };
                    let _ = persist(&this.data, &queue);
                    if let Some(view) = view {
                        let _ = app.download_updated(view);
                    }
                }
            }
            this.download_active.lock().await.remove(&id);
        });
        Ok(())
    }

    async fn run_download(self: &Arc<Self>, app: &impl DownloadEvents, id: &str) -> Result<()> {
        let session = self.identity().await?;
        let job = {
            let queue = self.download_queue.lock().await;
            queue
                .iter()
                .find(|j| j.id == id)
                .cloned()
                .ok_or_else(|| anyhow::anyhow!("下载任务不存在"))?
        };
        let cover = self
            .api(
                app,
                &session,
                reqwest::Method::POST,
                &format!("/api/res/download-tasks/{}/cover", job.task_id),
                None,
            )
            .await
            .context("检查下载封面失败")?;
        if !self.download_running(id, &session).await? {
            return Ok(());
        }
        if let Some(cover) = cover_file(&cover)? {
            let mut queue = self.download_queue.lock().await;
            let mut next = queue.clone();
            let current = next
                .iter_mut()
                .find(|j| j.id == id)
                .context("下载任务不存在")?;
            if current.status != "下载中" {
                return Ok(());
            }
            if let Some(existing) = current.files.iter().find(|f| f.file_id == cover.file_id) {
                ensure!(existing.file_name == cover.file_name, "封面与已有文件冲突");
            } else {
                ensure!(
                    !current.files.iter().any(|f| f.file_name == cover.file_name),
                    "封面文件已变化，请重新创建任务"
                );
                current.files.push(cover);
                let view = current.view();
                persist(&self.data, &next).context("保存封面下载清单失败")?;
                *queue = next;
                app.download_updated(view)?;
            }
        }
        let job = self
            .download_queue
            .lock()
            .await
            .iter()
            .find(|j| j.id == id)
            .cloned()
            .context("下载任务不存在")?;
        let pool = kx_tk_pool::TkPool::new(job.concurrency.clamp(1, 8));
        let futures = (0..job.files.len())
            .map(|index| {
                let this = self.clone();
                let app = app.clone();
                let session = session.clone();
                let id = id.to_owned();
                async move {
                    let result = this.download_one(&app, &id, session, index).await;
                    if let Err(error) = &result {
                        let detail = protocol::safe_message(&format!("{error:#}"));
                        this.update_download_file(&app, &id, index, "下载失败", None, &detail)
                            .await?;
                    }
                    result
                }
            })
            .collect();
        for result in pool.spawn_all(futures).await? {
            result?;
        }
        let mut queue = self.download_queue.lock().await;
        if let Some(job) = queue.iter_mut().find(|j| j.id == id) {
            if job
                .files
                .iter()
                .all(|f| matches!(f.status.as_str(), "已完成" | "已跳过"))
            {
                job.status = "已完成".into();
            } else if job.status != "已暂停" {
                job.status = "已暂停".into();
            }
            let view = job.view();
            persist(&self.data, &queue)?;
            app.download_updated(view)?;
        }
        Ok(())
    }

    async fn update_download_file(
        &self,
        app: &impl DownloadEvents,
        id: &str,
        index: usize,
        status: &str,
        bytes: Option<u64>,
        error: &str,
    ) -> Result<()> {
        let mut queue = self.download_queue.lock().await;
        let job = queue
            .iter_mut()
            .find(|job| job.id == id)
            .context("下载任务不存在")?;
        let file = job.files.get_mut(index).context("下载文件不存在")?;
        file.status = status.into();
        if let Some(bytes) = bytes {
            file.bytes = bytes;
        }
        file.error = error.into();
        let view = job.view();
        persist(&self.data, &queue).context("保存下载进度失败")?;
        app.download_updated(view)
    }

    async fn download_running(&self, id: &str, session: &Session) -> Result<bool> {
        let current = self.identity().await?;
        ensure!(
            current.uid == session.uid && current.api_base == session.api_base,
            "登录身份已变化，下载已停止"
        );
        let queue = self.download_queue.lock().await;
        Ok(queue
            .iter()
            .find(|job| job.id == id)
            .context("下载任务不存在")?
            .status
            == "下载中")
    }

    async fn download_one(
        self: &Arc<Self>,
        app: &impl DownloadEvents,
        id: &str,
        session: Session,
        index: usize,
    ) -> Result<()> {
        if !self.download_running(id, &session).await? {
            return Ok(());
        }
        let job = self
            .download_queue
            .lock()
            .await
            .iter()
            .find(|job| job.id == id)
            .cloned()
            .context("下载任务不存在")?;
        let file = job.files.get(index).context("下载文件不存在")?;
        if let Some(receipt) = &file.pending_receipt {
            self.report_download_receipt(app, &session, &job, file, receipt)
                .await?;
            self.save_download_receipt(id, index, None).await?;
        }
        let target = local_files::target_path(&job.directory, &file.file_name)?;
        if let Some(bytes) = local_files::existing_file(&target).await?
            && !job.overwrite
        {
            self.update_download_file(app, id, index, "已跳过", Some(bytes), "")
                .await?;
            return Ok(());
        }
        self.update_download_file(app, id, index, "下载中", Some(0), "")
            .await?;
        let link: DownloadLink = serde_json::from_value(
            self.api(
                app,
                &session,
                reqwest::Method::POST,
                &format!("/api/res/downloads/{}/{}/url", job.res_id, file.file_id),
                Some(&json!({"task_id": job.task_id})),
            )
            .await?,
        )
        .context("下载地址响应无效")?;
        let transfer = async {
        let fetch = self.fetch_download(&session, &job, file, &link);
        tokio::pin!(fetch);
        let mut wait = tokio::time::interval(std::time::Duration::from_millis(250));
        let response = loop {
            tokio::select! {
                response = &mut fetch => break response?,
                _ = wait.tick() => if !self.download_running(id, &session).await? {
                    self.update_download_file(app, id, index, "已暂停", Some(0), "").await?;
                    return Ok(());
                }
            }
        };
        let temp = job
            .directory
            .join(format!(".{}.{}.part", file.file_name, uuid::Uuid::new_v4()));
        let result = async {
            let mut output = tokio::fs::OpenOptions::new().write(true).create_new(true).open(&temp).await.context("创建下载临时文件失败")?;
            let mut bytes = 0u64;
            let mut body = response.bytes_stream();
            let mut check = tokio::time::interval(std::time::Duration::from_millis(250));
            loop {
                let chunk = tokio::select! {
                    chunk = body.next() => chunk,
                    _ = check.tick() => {
                        if !self.download_running(id, &session).await? {
                            self.update_download_file(app, id, index, "已暂停", Some(bytes), "").await?;
                            return Ok(());
                        }
                        continue;
                    }
                };
                let Some(chunk) = chunk else { break; };
                let chunk = chunk.map_err(|e| anyhow::anyhow!("接收文件内容失败：{}", e.without_url()))?;
                output.write_all(&chunk).await.context("写入下载文件失败")?;
                bytes += chunk.len() as u64;
                ensure!(bytes <= file.size, "下载文件超过预期大小");
                let mut queue = self.download_queue.lock().await;
                let job = queue.iter_mut().find(|job| job.id == id).context("下载任务不存在")?;
                job.files[index].bytes = bytes;
                app.download_updated(job.view())?;
            }
            ensure!(bytes == file.size, "下载文件大小不符：实际 {bytes} 字节，预期 {} 字节", file.size);
            output.flush().await.context("刷新下载文件失败")?;
            output.sync_all().await.context("下载文件落盘失败")?;
            drop(output);
            if !self.download_running(id, &session).await? {
                self.update_download_file(app, id, index, "已暂停", Some(bytes), "").await?;
                return Ok(());
            }
            let installed = local_files::install(&temp, &target, job.overwrite).await?;
            self.update_download_file(app, id, index, if installed { "已完成" } else { "已跳过" }, Some(bytes), "").await
        }.await;
        let _ = tokio::fs::remove_file(&temp).await;
        result
        }.await;
        if let Some(log_id) = link.log_id {
            let current = self
                .download_queue
                .lock()
                .await
                .iter()
                .find(|j| j.id == id)
                .and_then(|j| j.files.get(index))
                .cloned()
                .context("下载文件不存在")?;
            let status = if transfer.is_err() {
                "failed"
            } else if current.status == "已暂停" {
                "cancelled"
            } else {
                "completed"
            };
            let receipt = DownloadReceipt {
                log_id,
                status: status.into(),
                bytes: current.bytes.min(i64::MAX as u64) as i64,
            };
            self.save_download_receipt(id, index, Some(receipt.clone()))
                .await?;
            self.report_download_receipt(app, &session, &job, file, &receipt)
                .await
                .context("文件处理结束，但下载记录回报失败；重试可补报")?;
            self.save_download_receipt(id, index, None).await?;
        }
        transfer
    }
}

// 下载名只取服务端作品元数据和章节序号，不使用源文件名拼接本地路径。
fn download_layout(
    root: &std::path::Path,
    prepared: &Value,
) -> Result<(PathBuf, Vec<DownloadFile>)> {
    let code = prepared["resource_code"].as_str().unwrap_or_default();
    let name = prepared["res_name"].as_str().unwrap_or_default();
    ensure!(
        !code.trim().is_empty() && !name.trim().is_empty(),
        "下载响应缺少剧编号或剧名，请更新后端后重新创建任务"
    );
    let folder = format!("{}_{}", path_component(code), path_component(name));
    ensure!(folder.len() <= 240, "剧编号和剧名过长，无法创建下载目录");
    let entries = prepared["files"]
        .as_array()
        .ok_or_else(|| anyhow::anyhow!("下载响应缺少章节清单"))?;
    ensure!(!entries.is_empty(), "没有可下载的文件");
    let mut sequences = std::collections::HashSet::new();
    let mut files = Vec::with_capacity(entries.len());
    for entry in entries {
        let seq = entry["seq_no"]
            .as_i64()
            .filter(|seq| *seq > 0)
            .ok_or_else(|| anyhow::anyhow!("下载章节序号无效"))?;
        ensure!(sequences.insert(seq), "下载章节序号重复：{seq}");
        let file_id = entry["file_id"]
            .as_i64()
            .filter(|id| *id > 0)
            .ok_or_else(|| anyhow::anyhow!("下载文件编号无效"))?;
        let size = entry["size"]
            .as_u64()
            .ok_or_else(|| anyhow::anyhow!("下载文件大小无效"))?;
        files.push(DownloadFile {
            file_id,
            file_name: format!("{seq}.mp4"),
            size,
            bytes: 0,
            status: "待下载".into(),
            error: String::new(),
            pending_receipt: None,
        });
    }
    if let Some(cover) = cover_file(&prepared["cover"])? {
        ensure!(
            !files.iter().any(|f| f.file_id == cover.file_id),
            "封面与视频不能使用同一文件"
        );
        files.push(cover);
    }
    Ok((root.join(folder), files))
}

fn cover_file(cover: &Value) -> Result<Option<DownloadFile>> {
    if cover.is_null() {
        return Ok(None);
    }
    let name = cover["file_name"].as_str().unwrap_or_default();
    ensure!(
        [
            "cover.jpg",
            "cover.jpeg",
            "cover.png",
            "cover.webp",
            "cover.gif"
        ]
        .contains(&name),
        "下载封面名称无效"
    );
    Ok(Some(DownloadFile {
        file_id: cover["file_id"]
            .as_i64()
            .filter(|id| *id > 0)
            .context("下载封面文件编号无效")?,
        file_name: name.to_owned(),
        size: cover["size"].as_u64().context("下载封面大小无效")?,
        status: "待下载".into(),
        ..Default::default()
    }))
}

fn path_component(value: &str) -> String {
    let clean: String = value
        .trim()
        .chars()
        .map(|ch| {
            if ch.is_control() || matches!(ch, '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|')
            {
                '_'
            } else {
                ch
            }
        })
        .collect();
    let clean = clean.trim_matches(['.', ' ']);
    if clean.is_empty() {
        "_".into()
    } else {
        clean.into()
    }
}

#[cfg(test)]
mod layout_tests {
    use super::*;

    fn prepared() -> Value {
        json!({"resource_code":"aigc123", "res_name":"剧名", "files":[
            {"file_id":11,"file_name":"source-a.mp4","seq_no":1,"size":10},
            {"file_id":12,"file_name":"source-b.mp4","seq_no":2,"size":20}
        ]})
    }

    #[test]
    fn saves_episodes_under_work_code_and_title_and_restores_same_paths() -> Result<()> {
        let root = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        std::fs::create_dir_all(&root)?;
        let (directory, files) = download_layout(&root, &prepared())?;
        assert_eq!(directory, root.join("aigc123_剧名"));
        assert_eq!(
            files
                .iter()
                .map(|file| file.file_name.as_str())
                .collect::<Vec<_>>(),
            ["1.mp4", "2.mp4"]
        );
        let job = DownloadJob {
            directory: directory.clone(),
            files,
            status: "下载中".into(),
            ..Default::default()
        };
        persist(&root, &[job])?;
        let restored = load(&root)?;
        assert_eq!(
            restored[0].directory.join(&restored[0].files[0].file_name),
            root.join("aigc123_剧名/1.mp4")
        );
        assert_eq!(restored[0].status, "已暂停");
        assert_eq!(
            restored[0].view()["targetDirectory"],
            directory.to_string_lossy().as_ref()
        );
        std::fs::remove_dir_all(root)?;
        Ok(())
    }

    #[test]
    fn rejects_missing_metadata_and_duplicate_sequences_and_contains_unsafe_names() -> Result<()> {
        let root = PathBuf::from("downloads");
        let mut input = prepared();
        input["resource_code"] = json!("../aigc123");
        input["res_name"] = json!("剧/名\\测试:*?");
        let (directory, _) = download_layout(&root, &input)?;
        assert_eq!(directory.parent(), Some(root.as_path()));
        assert!(
            !directory
                .file_name()
                .unwrap()
                .to_string_lossy()
                .contains('\\')
        );
        input["files"][1]["seq_no"] = json!(1);
        assert!(download_layout(&root, &input).is_err());
        assert!(download_layout(&root, &json!({"files":[]})).is_err());
        Ok(())
    }
}

#[cfg(test)]
mod tests;
