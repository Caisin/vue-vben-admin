use anyhow::{Context, Result, ensure};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::{
    collections::HashSet,
    path::{Path, PathBuf},
    sync::{
        Arc,
        atomic::{AtomicBool, Ordering},
    },
    time::{Duration, SystemTime},
};
use tauri::{AppHandle, WebviewWindow};
use tauri_plugin_dialog::DialogExt;
use tokio::sync::Mutex;
use url::Url;
use walkdir::WalkDir;
mod accounts;
mod api;
mod auth;
mod checks;
mod execute;
mod model;
mod vod;
pub use auth::{CookieInput, Login};
pub use model::{Account, DirectorySelection, PlanEdit, VideoFile};
use model::{Selection, active, now, publish_body, recover, retryable, validate_start};
const MAX_FILES: usize = 50;
const MAX_FILE_BYTES: u64 = 30_000_000_000;
const UPLOAD_URL: &str = "https://www.tiktok.com/tiktokstudio/upload?lang=en";

pub struct TikTok {
    selection: Mutex<Option<Selection>>,
    gate: Mutex<()>,
    pause: AtomicBool,
    data: PathBuf,
    auth: Mutex<Option<Login>>,
}
fn persist(data: &Path, selection: &Selection) -> Result<()> {
    let tmp = data.join("tiktok-queue.tmp");
    let mut output = std::fs::File::create(&tmp)?;
    serde_json::to_writer(&mut output, selection)?;
    output.sync_all()?;
    std::fs::rename(tmp, data.join("tiktok-queue.json"))?;
    Ok(())
}
impl TikTok {
    pub fn new(data: PathBuf) -> Result<Arc<Self>> {
        std::fs::create_dir_all(&data)?;
        let path = data.join("tiktok-queue.json");
        let selection = if path.exists() {
            let mut selection: Selection = serde_json::from_slice(&std::fs::read(path)?)
                .context("TikTok 本地清单损坏，请备份并检查 tiktok-queue.json")?;
            recover(&mut selection);
            persist(&data, &selection)?;
            Some(selection)
        } else {
            None
        };
        Ok(Arc::new(Self {
            selection: Mutex::new(selection),
            gate: Mutex::new(()),
            pause: AtomicBool::new(false),
            data,
            auth: Mutex::new(None),
        }))
    }
    pub async fn list(&self) -> Option<DirectorySelection> {
        self.selection.lock().await.as_ref().map(|s| s.view.clone())
    }
    pub fn pause(&self) {
        self.pause.store(true, Ordering::SeqCst);
    }
    pub async fn account(&self) -> Result<Account> {
        self.cookie_account().await
    }
    pub async fn pick_directory(&self, app: &AppHandle) -> Result<Option<DirectorySelection>> {
        let _guard = self
            .gate
            .try_lock()
            .context("任务正在执行，请先暂停并等待当前视频结束")?;
        ensure!(
            self.selection.lock().await.as_ref().is_none_or(|s| s
                .view
                .files
                .iter()
                .all(|f| matches!(f.status.as_str(), "scheduled" | "legacy_draft"))),
            "请先处理或移除当前清单"
        );
        let account = self
            .auth
            .lock()
            .await
            .as_ref()
            .map(|login| login.account.clone())
            .context("请先选择 TikTok 账号")?;
        let dialog = app.dialog().file().set_title("选择 TikTok 视频目录");
        let selected =
            tauri::async_runtime::spawn_blocking(move || dialog.blocking_pick_folder()).await?;
        let Some(selected) = selected else {
            return Ok(None);
        };
        let root = selected
            .into_path()
            .map_err(|_| anyhow::anyhow!("目录路径无效"))?
            .canonicalize()?;
        let scan_root = root.clone();
        let files = tauri::async_runtime::spawn_blocking(move || scan(&scan_root)).await??;
        ensure!(
            !files.is_empty(),
            "目录中没有可上传的视频（MP4、MOV、WebM）"
        );
        let name = root
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .into_owned();
        let mut current = self.selection.lock().await;
        let revision = current.as_ref().map_or(1, |s| s.view.revision + 1);
        let next = Selection {
            owner_key: self
                .auth
                .lock()
                .await
                .as_ref()
                .and_then(|l| l.owner_key.clone()),
            version: 2,
            root,
            view: DirectorySelection {
                revision,
                name,
                files,
                account: Some(account),
            },
        };
        persist(&self.data, &next)?;
        let view = next.view.clone();
        *current = Some(next);
        Ok(Some(view))
    }
    pub async fn plan(&self, edit: PlanEdit) -> Result<DirectorySelection> {
        let _guard = self.gate.try_lock().context("请先暂停并等待当前视频结束")?;
        let account = self.account().await?;
        ensure!(
            account.uid == edit.account_id,
            "TikTok 当前账号与计划不一致，请刷新账号"
        );
        let mut current = self.selection.lock().await;
        let mut next = current.clone().context("清单不存在")?;
        apply_plan(&mut next, edit, account, now())?;
        persist(&self.data, &next)?;
        let view = next.view.clone();
        *current = Some(next);
        Ok(view)
    }
    pub async fn remove(&self, revision: u64) -> Result<()> {
        let _guard = self.gate.try_lock().context("请先暂停并等待当前视频结束")?;
        let mut current = self.selection.lock().await;
        if let Some(s) = current.as_ref() {
            ensure!(s.view.revision == revision, "清单已变化，请刷新");
            self.remove_account_archive(s)?;
            std::fs::remove_file(self.data.join("tiktok-queue.json"))?;
        }
        *current = None;
        Ok(())
    }
    pub async fn reconcile(&self, id: &str, revision: u64, item_id: Option<String>) -> Result<()> {
        let _guard = self.gate.try_lock().context("请等待当前视频结束后核对")?;
        let current = self.selection.lock().await;
        let selection = current.as_ref().context("清单不存在")?;
        ensure!(selection.view.revision == revision, "清单已变化，请刷新");
        ensure!(
            selection
                .view
                .files
                .iter()
                .any(|f| f.id == id && f.status == "review"),
            "此视频无需人工核对"
        );
        if let Some(id) = &item_id {
            ensure!(valid_item_id(id), "请填写官方预约对应的数字视频 ID");
        }
        drop(current);
        self.change(id, |file| {
            file.status = if item_id.is_some() {
                "scheduled"
            } else if file.media.is_some() {
                "ready"
            } else {
                "pending"
            }
            .into();
            file.message = if item_id.is_some() {
                "用户已核实官方预约并录入视频 ID"
            } else {
                "用户确认未创建预约，可重新配置时间后提交"
            }
            .into();
            file.item_id = item_id;
            file.receipt = Some(json!({"source":"manual_reconciliation"}));
        })
        .await
    }
    pub async fn reset_media(&self, id: &str, revision: u64) -> Result<()> {
        let _guard = self.gate.try_lock().context("请先暂停并等待当前请求结束")?;
        let current = self.selection.lock().await;
        let selection = current.as_ref().context("清单不存在")?;
        ensure!(selection.view.revision == revision, "清单已变化，请刷新");
        ensure!(
            selection
                .view
                .files
                .iter()
                .any(|f| f.id == id && retryable(&f.status) && f.item_id.is_none()),
            "已提交或结果未知的预约不能重新上传"
        );
        drop(current);
        self.change(id, |file| {
            file.media = None;
            file.bytes = 0;
            file.upload_percent = 0;
            file.receipt = None;
            file.status = "pending".into();
            file.message = "已清除素材引用，下次提交会重新上传源文件".into();
        })
        .await
    }
    async fn change(&self, id: &str, update: impl FnOnce(&mut VideoFile)) -> Result<()> {
        let mut current = self.selection.lock().await;
        let mut next = current.clone().context("清单不存在")?;
        let file = next
            .view
            .files
            .iter_mut()
            .find(|f| f.id == id)
            .context("视频不在清单中")?;
        update(file);
        next.view.revision += 1;
        persist(&self.data, &next)?;
        *current = Some(next);
        Ok(())
    }
    async fn update(&self, id: &str, status: &str, message: &str, bytes: u64) -> Result<()> {
        self.change(id, |file| {
            file.status = status.into();
            file.message = message.into();
            file.bytes = bytes;
        })
        .await
    }
}
fn valid_item_id(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 30
        && value != "0"
        && value.bytes().all(|b| b.is_ascii_digit())
}
fn apply_plan(
    selection: &mut Selection,
    edit: PlanEdit,
    account: Account,
    timestamp: i64,
) -> Result<()> {
    ensure!(
        selection.view.revision == edit.expected_revision,
        "清单已变化，请刷新后重试"
    );
    ensure!(
        !edit.items.is_empty() && edit.items.len() <= MAX_FILES,
        "请选择需要配置的视频"
    );
    ensure!(
        !selection
            .view
            .files
            .iter()
            .any(|f| active(&f.status) || f.status == "review"),
        "请先核对未完成的预约"
    );
    ensure!(
        selection
            .view
            .account
            .as_ref()
            .is_none_or(|a| a.uid == account.uid)
            || selection
                .view
                .files
                .iter()
                .all(|f| f.media.is_none() && retryable(&f.status)),
        "清单已有上传素材，不能切换 TikTok 账号"
    );
    let mut seen = HashSet::new();
    for item in &edit.items {
        ensure!(seen.insert(&item.id), "重复的视频选择");
        ensure!(
            selection
                .view
                .files
                .iter()
                .any(|f| f.id == item.id && retryable(&f.status)),
            "视频已提交或不在清单中"
        );
        item.schedule.validate(timestamp, &account)?;
    }
    // 全部验证成功后再修改，失败不留下一半预约计划。
    for item in edit.items {
        selection
            .view
            .files
            .iter_mut()
            .find(|f| f.id == item.id)
            .unwrap()
            .schedule = Some(item.schedule);
    }
    selection.view.account = Some(account);
    selection.view.revision += 1;
    Ok(())
}
pub fn local_caller(window: &WebviewWindow) -> Result<()> {
    let url = window.url()?;
    let local = matches!(
        (url.scheme(), url.host_str()),
        ("tauri", Some("localhost")) | ("http" | "https", Some("tauri.localhost"))
    ) || (cfg!(debug_assertions)
        && url.scheme() == "http"
        && url.host_str() == Some("localhost")
        && url.port() == Some(1420));
    ensure!(
        window.label() == "main" && local,
        "TikTok 命令仅供本地桌面主窗口调用"
    );
    Ok(())
}
fn fingerprint(metadata: &std::fs::Metadata) -> Result<Option<SystemTime>> {
    Ok(Some(metadata.modified().context("无法读取视频修改时间")?))
}
async fn open_video(root: &Path, file: &VideoFile) -> Result<tokio::fs::File> {
    let relative = Path::new(&file.relative);
    ensure!(
        relative
            .components()
            .all(|c| matches!(c, std::path::Component::Normal(_))),
        "视频路径无效"
    );
    let mut path = root.to_path_buf();
    ensure!(
        path.canonicalize()? == path && !std::fs::symlink_metadata(&path)?.file_type().is_symlink(),
        "源目录已变化"
    );
    for component in relative.components() {
        path.push(component);
        ensure!(
            !std::fs::symlink_metadata(&path)?.file_type().is_symlink(),
            "视频路径包含符号链接"
        );
    }
    ensure!(path.canonicalize()?.starts_with(root), "视频不在所选目录");
    let source = tokio::fs::File::open(path).await?;
    let metadata = source.metadata().await?;
    ensure!(
        metadata.is_file()
            && metadata.len() == file.size
            && fingerprint(&metadata)? == file.modified,
        "扫描后视频已变化，请重新选择目录"
    );
    Ok(source)
}
fn scan(root: &Path) -> Result<Vec<VideoFile>> {
    let mut files = Vec::new();
    for entry in WalkDir::new(root).follow_links(false).max_depth(20) {
        let entry = entry.context("无法完整扫描目录，请检查权限")?;
        if !entry.file_type().is_file() {
            continue;
        }
        let path = entry.path();
        let extension = path
            .extension()
            .and_then(|v| v.to_str())
            .map(str::to_ascii_lowercase);
        if !matches!(extension.as_deref(), Some("mp4" | "mov" | "webm")) {
            continue;
        }
        let metadata = entry.metadata()?;
        ensure!(
            metadata.len() > 0 && metadata.len() <= MAX_FILE_BYTES,
            "视频必须非空且不超过 30 GB：{}",
            path.display()
        );
        let relative = path
            .strip_prefix(root)?
            .to_str()
            .context("视频路径必须为 UTF-8")?
            .to_owned();
        let name = path
            .file_name()
            .and_then(|v| v.to_str())
            .context("视频文件名必须为 UTF-8")?
            .to_owned();
        files.push(VideoFile {
            id: uuid::Uuid::new_v4().to_string(),
            name,
            relative,
            size: metadata.len(),
            status: "pending".into(),
            message: String::new(),
            bytes: 0,
            upload_percent: 0,
            schedule: None,
            media: None,
            item_id: None,
            receipt: None,
            creation_id: uuid::Uuid::new_v4().to_string(),
            modified: fingerprint(&metadata)?,
        });
        ensure!(
            files.len() <= MAX_FILES,
            "一次最多选择 {MAX_FILES} 个视频，请缩小目录范围"
        );
    }
    files.sort_by(|a, b| natord::compare(&a.relative, &b.relative));
    Ok(files)
}

#[cfg(test)]
mod tests;
