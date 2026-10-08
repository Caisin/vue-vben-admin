use anyhow::{Context, Result, ensure};
use serde::Serialize;
use std::{sync::Arc, time::Duration};
use tauri::{AppHandle, Emitter, State, WebviewWindow};
use tauri_plugin_updater::{Update, UpdaterExt};
use tokio::sync::Mutex;

#[derive(Default)]
pub struct DesktopUpdater(Mutex<Option<(String, Update)>>);
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateView {
    current_version: String,
    version: String,
    notes: String,
}
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct Progress {
    stage: &'static str,
    downloaded: u64,
    total: Option<u64>,
}
fn endpoint(base: &str) -> Result<url::Url> {
    let url = url::Url::parse(base)?;
    ensure!(
        url.scheme() == "https"
            && url.username().is_empty()
            && url.password().is_none()
            && url.query().is_none()
            && url.fragment().is_none(),
        "自动更新需要 HTTPS 服务地址"
    );
    Ok(url::Url::parse(&format!(
        "{}/adm/client-updates/{{{{target}}}}/{{{{arch}}}}/{{{{current_version}}}}",
        base.trim_end_matches('/')
    ))?)
}
async fn fetch(app: &AppHandle, base: &str) -> Result<Option<Update>> {
    let mut result = app
        .updater_builder()
        .endpoints(vec![endpoint(base)?])?
        .timeout(Duration::from_secs(20))
        // 不转发业务登录令牌；下载和检查均只允许 HTTPS，包括重定向。
        .configure_client(|client| client.https_only(true))
        .build()?
        .check()
        .await?;
    if let Some(update) = &mut result {
        ensure!(
            update.download_url.scheme() == "https",
            "更新包必须使用 HTTPS"
        );
        update.timeout = Some(Duration::from_secs(30 * 60));
    }
    Ok(result)
}
#[tauri::command]
pub async fn desktop_update_check(
    window: WebviewWindow,
    app: AppHandle,
    desktop: State<'_, Arc<crate::session::Desktop>>,
    state: State<'_, DesktopUpdater>,
) -> Result<Option<UpdateView>, String> {
    async {
        crate::tiktok::local_caller(&window)?;
        let mut pending = state.0.try_lock().context("正在检查或安装更新")?;
        *pending = None;
        let base = desktop.auth.lock().await.base.clone();
        if let Some(update) = fetch(&app, &base).await? {
            let view = UpdateView {
                current_version: update.current_version.clone(),
                version: update.version.clone(),
                notes: update.body.clone().unwrap_or_default(),
            };
            *pending = Some((base, update));
            Ok(Some(view))
        } else {
            Ok(None)
        }
    }
    .await
    .map_err(|e: anyhow::Error| e.to_string())
}
#[tauri::command]
pub async fn desktop_update_install(
    window: WebviewWindow,
    app: AppHandle,
    desktop: State<'_, Arc<crate::session::Desktop>>,
    tiktok: State<'_, Arc<crate::tiktok::TikTok>>,
    state: State<'_, DesktopUpdater>,
    version: String,
) -> Result<(), String> {
    async {
        crate::tiktok::local_caller(&window)?;
        let pending = state.0.try_lock().context("正在检查或安装更新")?;
        let (base, previous) = pending.as_ref().context("请先检查更新")?;
        ensure!(version == previous.version, "版本已变化，请重新检查更新");
        ensure!(
            desktop.auth.lock().await.base == *base,
            "服务地址已变化，请重新检查更新"
        );
        // 与任务启动使用同一组原生锁；检查空闲后持续持锁，消除检查到重启之间的竞态。
        let uploads = desktop
            .active
            .try_lock()
            .context("上传任务正在启动，请稍后更新")?;
        let downloads = desktop
            .download_active
            .try_lock()
            .context("下载任务正在启动，请稍后更新")?;
        ensure!(
            uploads.is_empty() && downloads.is_empty(),
            "请先暂停上传和下载，并等待在途文件结束后更新"
        );
        let _tiktok = tiktok.update_guard()?;
        let update = fetch(&app, base)
            .await?
            .context("此版本已撤回或没有可用更新，请重新检查")?;
        ensure!(
            update.version == previous.version
                && update.signature == previous.signature
                && update.download_url == previous.download_url,
            "发行信息已变化，请重新检查更新"
        );
        let mut downloaded = 0_u64;
        let mut last = std::time::Instant::now();
        let bytes = update
            .download(
                |chunk, total| {
                    downloaded += chunk as u64;
                    if last.elapsed() >= Duration::from_millis(200) {
                        let _ = app.emit_to(
                            "main",
                            "desktop-update-progress",
                            Progress {
                                stage: "downloading",
                                downloaded,
                                total,
                            },
                        );
                        last = std::time::Instant::now();
                    }
                },
                || {},
            )
            .await?;
        // 下载可能耗时，安装前再次核对撤回和服务切换。
        ensure!(
            desktop.auth.lock().await.base == *base,
            "服务地址已变化，已取消安装"
        );
        let current = fetch(&app, base)
            .await?
            .context("此版本已撤回，已取消安装")?;
        ensure!(
            current.version == update.version
                && current.signature == update.signature
                && current.download_url == update.download_url,
            "发行信息已变化，已取消安装"
        );
        let _ = app.emit_to(
            "main",
            "desktop-update-progress",
            Progress {
                stage: "installing",
                downloaded,
                total: Some(downloaded),
            },
        );
        update.install(bytes)?;
        app.restart();
    }
    .await
    .map_err(|e: anyhow::Error| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn update_endpoint_preserves_api_prefix_and_rejects_unsafe_origin() {
        assert!(
            endpoint("https://example.com/api/")
                .unwrap()
                .as_str()
                .starts_with("https://example.com/api/adm/client-updates/")
        );
        for base in [
            "http://example.com",
            "https://user:pass@example.com",
            "https://example.com?key=secret",
        ] {
            assert!(endpoint(base).is_err());
        }
    }
    #[derive(Clone)]
    struct Events;
    impl crate::session::SessionEvents for Events {
        fn updated(&self, _: &crate::session::Session) -> Result<()> {
            Ok(())
        }
        fn cleared(&self, _: u64) -> Result<()> {
            Ok(())
        }
    }
    impl crate::queue::UploadEvents for Events {
        fn job_updated(&self, _: serde_json::Value) -> Result<()> {
            Ok(())
        }
    }
    impl crate::download::DownloadEvents for Events {
        fn download_updated(&self, _: serde_json::Value) -> Result<()> {
            Ok(())
        }
    }
    #[tokio::test]
    async fn installation_locks_reject_all_three_task_starters() -> Result<()> {
        let dir = std::env::temp_dir().join(format!("kx-update-gate-{}", uuid::Uuid::new_v4()));
        let desktop = crate::session::Desktop::new(dir.clone())?;
        let tiktok = crate::tiktok::TikTok::new(dir.clone())?;
        let uploads = desktop.active.lock().await;
        let downloads = desktop.download_active.lock().await;
        let tik_guard = tiktok.update_guard()?;
        assert!(
            desktop
                .start(Events, "missing".into(), vec![], 1, None)
                .await
                .unwrap_err()
                .to_string()
                .contains("正在安装更新")
        );
        assert!(
            desktop
                .resume_download(Events, "missing".into(), false)
                .await
                .unwrap_err()
                .to_string()
                .contains("正在安装更新")
        );
        assert!(
            tiktok
                .upload(vec![], 0, "missing".into(), 1)
                .await
                .unwrap_err()
                .to_string()
                .contains("批量预约正在执行")
        );
        drop((uploads, downloads, tik_guard));
        assert!(tiktok.update_guard().is_ok());
        std::fs::remove_dir_all(dir)?;
        Ok(())
    }
}
