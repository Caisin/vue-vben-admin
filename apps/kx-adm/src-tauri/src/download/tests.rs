use super::*;
use std::sync::{
    Mutex as StdMutex,
    atomic::{AtomicUsize, Ordering},
};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::TcpListener,
};

#[derive(Clone, Default)]
struct Events(Arc<StdMutex<Vec<Value>>>);
impl crate::session::SessionEvents for Events {
    fn updated(&self, _: &Session) -> Result<()> {
        Ok(())
    }
    fn cleared(&self, _: u64) -> Result<()> {
        Ok(())
    }
}
impl DownloadEvents for Events {
    fn download_updated(&self, value: Value) -> Result<()> {
        self.0.lock().unwrap().push(value);
        Ok(())
    }
}
struct Dir(PathBuf);
impl Dir {
    fn new() -> Result<Self> {
        let path = std::env::temp_dir().join(format!("kx-download-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&path)?;
        Ok(Self(path))
    }
}
impl Drop for Dir {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

async fn server(
    status: &str,
    body: &str,
    content_type: &str,
) -> Result<(
    String,
    Arc<AtomicUsize>,
    tokio_util::task::AbortOnDropHandle<()>,
)> {
    server_with_receipt_failure(status, body, content_type, false).await
}
async fn server_with_receipt_failure(
    status: &str,
    body: &str,
    content_type: &str,
    fail_receipt: bool,
) -> Result<(
    String,
    Arc<AtomicUsize>,
    tokio_util::task::AbortOnDropHandle<()>,
)> {
    server_options(status, body, content_type, fail_receipt, false).await
}
async fn server_options(
    status: &str,
    body: &str,
    content_type: &str,
    fail_receipt: bool,
    with_cover: bool,
) -> Result<(
    String,
    Arc<AtomicUsize>,
    tokio_util::task::AbortOnDropHandle<()>,
)> {
    let listener = TcpListener::bind("127.0.0.1:0").await?;
    let base = format!("http://{}", listener.local_addr()?);
    let calls = Arc::new(AtomicUsize::new(0));
    let count = calls.clone();
    let response = format!(
        "HTTP/1.1 {status}\r\nContent-Type: {content_type}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
        body.len()
    );
    let base_url = base.clone();
    let status = status.to_owned();
    let task = tokio::spawn(async move {
        let mut signed = 0;
        let mut receipt_calls = 0;
        while let Ok((mut stream, _)) = listener.accept().await {
            let mut buffer = [0u8; 8192];
            let n = stream.read(&mut buffer).await.unwrap_or(0);
            let header = String::from_utf8_lossy(&buffer[..n]).to_string();
            let path = header
                .lines()
                .next()
                .unwrap_or_default()
                .split_whitespace()
                .nth(1)
                .unwrap_or_default();
            if path.ends_with("/prepare") {
                let cover = if with_cover {
                    json!({"file_id":4,"file_name":"cover.png","size":3})
                } else {
                    Value::Null
                };
                let payload = json!({"code":200,"result":{
                    "task_id":2,"resource_code":"DR-1","res_name":"剧名","version_id":1,
                    "files":[{"file_id":3,"seq_no":1,"size":3}],"cover":cover
                }});
                let body = kx_ed::KxEd::en(&serde_json::to_vec(&payload).unwrap())
                    .await
                    .unwrap();
                let head = format!(
                    "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                    body.len()
                );
                let _ = stream.write_all(head.as_bytes()).await;
                let _ = stream.write_all(&body).await;
            } else if path.ends_with("/cover") {
                assert_eq!(path, "/api/res/download-tasks/2/cover");
                if with_cover && !status.starts_with("200") {
                    let _ = stream.write_all(response.as_bytes()).await;
                    continue;
                }
                let cover = if with_cover {
                    json!({"file_id":4,"file_name":"cover.png","size":3})
                } else {
                    Value::Null
                };
                let payload = json!({"code":200,"result":cover});
                let body = kx_ed::KxEd::en(&serde_json::to_vec(&payload).unwrap())
                    .await
                    .unwrap();
                let head = format!(
                    "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                    body.len()
                );
                let _ = stream.write_all(head.as_bytes()).await;
                let _ = stream.write_all(&body).await;
            } else if path.ends_with("/url") && status.starts_with("200") {
                signed += 1;
                assert!(
                    signed <= count.load(Ordering::SeqCst) + 1,
                    "later episode links must not be prefetched"
                );
                assert!(
                    header
                        .to_ascii_lowercase()
                        .contains("authorization: bearer fixture")
                );
                let json = json!({"code":200,"result":{"mode":"direct","url":format!("{base_url}/object?signature=secret"),"log_id":11}});
                let body = kx_ed::KxEd::en(&serde_json::to_vec(&json).unwrap())
                    .await
                    .unwrap();
                let head = format!(
                    "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                    body.len()
                );
                let _ = stream.write_all(head.as_bytes()).await;
                let _ = stream.write_all(&body).await;
            } else if path.ends_with("/receipt") {
                receipt_calls += 1;
                if fail_receipt && receipt_calls == 1 {
                    let _ = stream.write_all(b"HTTP/1.1 503 Unavailable\r\nContent-Length: 0\r\nConnection: close\r\n\r\n").await;
                    continue;
                }
                let body = kx_ed::KxEd::en(br#"{"code":200,"result":true}"#)
                    .await
                    .unwrap();
                let head = format!(
                    "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                    body.len()
                );
                let _ = stream.write_all(head.as_bytes()).await;
                let _ = stream.write_all(&body).await;
            } else {
                if path.starts_with("/object") {
                    assert!(!header.to_ascii_lowercase().contains("authorization:"));
                    assert!(!header.to_ascii_lowercase().contains("x-kx-client:"));
                    assert!(!header.to_ascii_lowercase().contains("security:"));
                }
                count.fetch_add(1, Ordering::SeqCst);
                let _ = stream.write_all(response.as_bytes()).await;
            }
        }
    });
    Ok((base, calls, tokio_util::task::AbortOnDropHandle::new(task)))
}

#[tokio::test]
async fn signs_each_episode_only_when_its_download_slot_starts() -> Result<()> {
    let root = Dir::new()?;
    let (base, calls, _server) = server("200 OK", "new", "application/octet-stream").await?;
    let d = desktop(&root, &base, "待下载").await?;
    {
        let mut q = d.download_queue.lock().await;
        q[0].concurrency = 1;
        q[0].files.push(DownloadFile {
            file_id: 4,
            file_name: "2.mp4".into(),
            size: 3,
            status: "待下载".into(),
            ..Default::default()
        });
    }
    run(&d, false).await?;
    assert_eq!(calls.load(Ordering::SeqCst), 2);
    assert_eq!(tokio::fs::read(root.0.join("2.mp4")).await?, b"new");
    Ok(())
}

#[tokio::test]
async fn failed_receipt_is_retried_without_redownloading_saved_file() -> Result<()> {
    let root = Dir::new()?;
    let (base, calls, _server) =
        server_with_receipt_failure("200 OK", "new", "application/octet-stream", true).await?;
    let d = desktop(&root, &base, "待下载").await?;
    run(&d, false).await?;
    assert!(load(&root.0)?[0].files[0].pending_receipt.is_some());
    assert_eq!(tokio::fs::read(root.0.join("1.mp4")).await?, b"new");
    run(&d, false).await?;
    assert!(load(&root.0)?[0].files[0].pending_receipt.is_none());
    assert_eq!(calls.load(Ordering::SeqCst), 1);
    Ok(())
}
async fn desktop(root: &Dir, base: &str, file_status: &str) -> Result<Arc<Desktop>> {
    let d = Desktop::new(root.0.clone())?;
    d.auth.lock().await.session = Some(Session {
        token: "fixture".into(),
        uid: "7".into(),
        api_base: base.into(),
        expires_at: crate::session::now() + 3600,
        generation: 1,
    });
    d.download_queue.lock().await.push(DownloadJob {
        id: "fixture-job".into(),
        uid: "7".into(),
        api_base: base.into(),
        directory: root.0.clone(),
        res_id: 1,
        task_id: 2,
        files: vec![DownloadFile {
            file_id: 3,
            file_name: "1.mp4".into(),
            size: 3,
            status: file_status.into(),
            ..Default::default()
        }],
        ..Default::default()
    });
    Ok(d)
}
async fn run(d: &Arc<Desktop>, overwrite: bool) -> Result<()> {
    run_at(d, overwrite, None).await
}
async fn run_at(d: &Arc<Desktop>, overwrite: bool, directory: Option<PathBuf>) -> Result<()> {
    d.resume_download(
        Events::default(),
        "fixture-job".into(),
        overwrite,
        directory,
    )
    .await?;
    tokio::time::timeout(std::time::Duration::from_secs(5), async {
        while d.download_active.lock().await.contains("fixture-job") {
            tokio::time::sleep(std::time::Duration::from_millis(5)).await;
        }
    })
    .await?;
    Ok(())
}

#[tokio::test]
async fn existing_file_is_skipped_without_network_and_explicit_overwrite_replaces_it() -> Result<()>
{
    let root = Dir::new()?;
    let (base, calls, _server) = server("200 OK", "new", "application/octet-stream").await?;
    tokio::fs::write(root.0.join("1.mp4"), b"old").await?;
    let d = desktop(&root, &base, "待下载").await?;
    run(&d, false).await?;
    assert_eq!(calls.load(Ordering::SeqCst), 0);
    assert_eq!(tokio::fs::read(root.0.join("1.mp4")).await?, b"old");
    assert_eq!(load(&root.0)?[0].files[0].status, "已跳过");
    run(&d, true).await?;
    assert_eq!(calls.load(Ordering::SeqCst), 1);
    assert_eq!(tokio::fs::read(root.0.join("1.mp4")).await?, b"new");
    assert_eq!(load(&root.0)?[0].status, "已完成");
    let persisted = std::fs::read_to_string(root.0.join("download-queue.json"))?;
    assert!(!persisted.contains("signature=secret"));
    assert!(!persisted.contains("/object"));
    Ok(())
}

#[tokio::test]
async fn missing_completed_file_is_downloaded_again() -> Result<()> {
    let root = Dir::new()?;
    let (base, calls, _server) = server("200 OK", "new", "application/octet-stream").await?;
    let d = desktop(&root, &base, "已完成").await?;
    run(&d, false).await?;
    assert_eq!(calls.load(Ordering::SeqCst), 1);
    assert_eq!(tokio::fs::read(root.0.join("1.mp4")).await?, b"new");
    Ok(())
}

#[tokio::test]
async fn failed_overwrite_preserves_original_and_records_server_reason_on_task_and_item()
-> Result<()> {
    let root = Dir::new()?;
    let (base, _, _server) = server(
        "403 Forbidden",
        r#"{"code":403,"msg":"下载授权已过期"}"#,
        "application/json",
    )
    .await?;
    tokio::fs::write(root.0.join("1.mp4"), b"old").await?;
    let d = desktop(&root, &base, "已完成").await?;
    run(&d, true).await?;
    let stored = load(&root.0)?;
    assert_eq!(stored[0].status, "下载失败");
    assert_eq!(stored[0].files[0].status, "下载失败");
    assert!(stored[0].error.contains("下载授权已过期"));
    assert!(stored[0].files[0].error.contains("HTTP 403"));
    assert_eq!(tokio::fs::read(root.0.join("1.mp4")).await?, b"old");
    Ok(())
}

#[tokio::test]
async fn atomic_install_keeps_file_created_after_initial_check() -> Result<()> {
    let root = Dir::new()?;
    let target = root.0.join("1.mp4");
    let temp = root.0.join("download.part");
    assert!(local_files::existing_file(&target).await?.is_none());
    tokio::fs::write(&temp, b"new").await?;
    tokio::fs::write(&target, b"other job").await?;
    assert!(!local_files::install(&temp, &target, false).await?);
    assert_eq!(tokio::fs::read(&target).await?, b"other job");
    Ok(())
}

#[test]
fn windows_directory_display_preserves_drive_unc_and_special_paths() {
    for (path, expected) in [
        (r"\\?\E:\AIGC1677_剧名", r"E:\AIGC1677_剧名"),
        (r"\\?\UNC\server\share\剧名", r"\\server\share\剧名"),
        (r"E:\剧名", r"E:\剧名"),
        (r"\\server\share", r"\\server\share"),
        (r"\\?\Volume{device}\", r"\\?\Volume{device}\"),
        ("/tmp/剧名", "/tmp/剧名"),
    ] {
        let job = DownloadJob {
            directory: PathBuf::from(path),
            ..Default::default()
        };
        assert_eq!(job.view()["targetDirectory"], expected);
        assert_eq!(job.directory, PathBuf::from(path));
    }
}

#[tokio::test]
async fn changing_directory_redownloads_completed_files_and_persists_new_target() -> Result<()> {
    let root = Dir::new()?;
    let destination = Dir::new()?;
    let (base, calls, _server) = server("200 OK", "new", "application/octet-stream").await?;
    tokio::fs::write(root.0.join("1.mp4"), b"old").await?;
    let d = desktop(&root, &base, "已完成").await?;
    run_at(&d, false, Some(destination.0.clone())).await?;
    assert_eq!(calls.load(Ordering::SeqCst), 1);
    assert_eq!(tokio::fs::read(root.0.join("1.mp4")).await?, b"old");
    assert_eq!(tokio::fs::read(destination.0.join("1.mp4")).await?, b"new");
    let restored = load(&root.0)?;
    assert_eq!(restored[0].directory, destination.0.canonicalize()?);
    assert_eq!(restored[0].status, "已完成");
    run(&d, false).await?;
    assert_eq!(calls.load(Ordering::SeqCst), 1);
    Ok(())
}

#[tokio::test]
async fn changed_directory_keeps_existing_files_unless_overwrite_is_explicit() -> Result<()> {
    let root = Dir::new()?;
    let destination = Dir::new()?;
    let (base, calls, _server) = server("200 OK", "new", "application/octet-stream").await?;
    tokio::fs::write(destination.0.join("1.mp4"), b"keep").await?;
    let d = desktop(&root, &base, "已完成").await?;
    run_at(&d, false, Some(destination.0.clone())).await?;
    assert_eq!(calls.load(Ordering::SeqCst), 0);
    assert_eq!(tokio::fs::read(destination.0.join("1.mp4")).await?, b"keep");
    run_at(&d, true, Some(destination.0.clone())).await?;
    assert_eq!(calls.load(Ordering::SeqCst), 1);
    assert_eq!(tokio::fs::read(destination.0.join("1.mp4")).await?, b"new");
    Ok(())
}

#[tokio::test]
async fn invalid_directory_active_job_and_persist_failure_preserve_original_queue() -> Result<()> {
    let root = Dir::new()?;
    let destination = Dir::new()?;
    let d = desktop(&root, "http://localhost", "已完成").await?;
    let original = serde_json::to_value(&*d.download_queue.lock().await)?;
    let events = Events::default();
    assert!(
        d.resume_download(
            events.clone(),
            "fixture-job".into(),
            false,
            Some(root.0.join("missing"))
        )
        .await
        .is_err()
    );
    d.download_active.lock().await.insert("fixture-job".into());
    assert!(
        d.resume_download(
            events.clone(),
            "fixture-job".into(),
            false,
            Some(destination.0.clone())
        )
        .await
        .is_err()
    );
    d.download_active.lock().await.clear();
    // 用同名目录制造持久化失败，不依赖系统用户的权限配置。
    std::fs::create_dir(root.0.join("download-queue.tmp"))?;
    assert!(
        d.resume_download(
            events,
            "fixture-job".into(),
            false,
            Some(destination.0.clone())
        )
        .await
        .is_err()
    );
    assert_eq!(
        serde_json::to_value(&*d.download_queue.lock().await)?,
        original
    );
    assert!(d.download_active.lock().await.is_empty());
    Ok(())
}

#[tokio::test]
async fn concurrency_changes_are_persisted_and_reject_active_or_foreign_jobs() -> Result<()> {
    let root = Dir::new()?;
    let d = desktop(&root, "http://localhost", "待下载").await?;
    let events = Events::default();
    d.set_download_concurrency(&events, "fixture-job", 2)
        .await?;
    assert_eq!(load(&root.0)?[0].concurrency, 2);
    for invalid in [0, 9] {
        assert!(
            d.set_download_concurrency(&events, "fixture-job", invalid)
                .await
                .is_err()
        );
    }
    d.download_active.lock().await.insert("fixture-job".into());
    assert!(
        d.set_download_concurrency(&events, "fixture-job", 3)
            .await
            .is_err()
    );
    d.download_active.lock().await.clear();
    d.auth.lock().await.session.as_mut().unwrap().uid = "other".into();
    assert!(
        d.set_download_concurrency(&events, "fixture-job", 3)
            .await
            .is_err()
    );
    assert_eq!(load(&root.0)?[0].concurrency, 2);
    Ok(())
}

#[tokio::test]
async fn cover_is_downloaded_beside_episodes_with_fixed_basename() -> Result<()> {
    let root = Dir::new()?;
    let (base, calls, _server) = server("200 OK", "new", "application/octet-stream").await?;
    let d = desktop(&root, &base, "待下载").await?;
    let (_, files) = download_layout(
        &root.0,
        &json!({
            "resource_code":"DR-1", "res_name":"剧名",
            "files":[{"file_id":3,"seq_no":1,"size":3}],
            "cover":{"file_id":4,"file_name":"cover.png","size":3}
        }),
    )?;
    d.download_queue.lock().await[0].files = files;
    d.download_queue.lock().await[0].concurrency = 1;
    run(&d, false).await?;
    assert_eq!(calls.load(Ordering::SeqCst), 2);
    assert_eq!(std::fs::read(root.0.join("cover.png"))?, b"new");
    assert_eq!(std::fs::read(root.0.join("1.mp4"))?, b"new");
    assert_eq!(load(&root.0)?[0].files.len(), 2);
    Ok(())
}

#[tokio::test]
async fn legacy_resume_and_redownload_check_cover_in_current_directory() -> Result<()> {
    let root = Dir::new()?;
    let (base, calls, _server) =
        server_options("200 OK", "new", "application/octet-stream", false, true).await?;
    let d = desktop(&root, &base, "已完成").await?;
    std::fs::write(root.0.join("1.mp4"), b"old")?;
    // 历史任务没有封面条目：检查补下载应自动补清单和缺失封面。
    run(&d, false).await?;
    assert_eq!(std::fs::read(root.0.join("cover.png"))?, b"new");
    assert_eq!(std::fs::read(root.0.join("1.mp4"))?, b"old");
    assert_eq!(calls.load(Ordering::SeqCst), 1);
    assert_eq!(load(&root.0)?[0].files.len(), 2);
    // 已完成状态不代表文件仍存在，封面删除后再次补下。
    std::fs::remove_file(root.0.join("cover.png"))?;
    run(&d, false).await?;
    assert_eq!(calls.load(Ordering::SeqCst), 2);
    run(&d, false).await?;
    assert_eq!(calls.load(Ordering::SeqCst), 2);
    assert_eq!(load(&root.0)?[0].files.len(), 2);
    // 改目录重新下载按新目录检查，不复用旧目录的封面状态。
    let destination = Dir::new()?;
    std::fs::write(destination.0.join("1.mp4"), b"old")?;
    run_at(&d, false, Some(destination.0.clone())).await?;
    assert_eq!(std::fs::read(destination.0.join("cover.png"))?, b"new");
    assert_eq!(calls.load(Ordering::SeqCst), 3);
    std::fs::write(destination.0.join("cover.png"), b"own")?;
    run(&d, false).await?;
    assert_eq!(std::fs::read(destination.0.join("cover.png"))?, b"own");
    run(&d, true).await?;
    assert_eq!(std::fs::read(destination.0.join("cover.png"))?, b"new");
    assert_eq!(calls.load(Ordering::SeqCst), 5);
    Ok(())
}

#[tokio::test]
async fn adding_download_starts_video_and_cover_without_manual_resume() -> Result<()> {
    let root = Dir::new()?;
    let (base, calls, _server) =
        server_options("200 OK", "new", "application/octet-stream", false, true).await?;
    let d = desktop(&root, &base, "待下载").await?;
    d.download_queue.lock().await.clear();
    let events = Events::default();
    let view = d
        .add_download(&events, 1, 1, vec![3], root.0.clone(), 1)
        .await?;
    let id = view["id"].as_str().unwrap();
    assert_ne!(view["status"], "已暂停");
    assert_eq!(events.0.lock().unwrap()[0]["status"], "下载中");
    tokio::time::timeout(std::time::Duration::from_secs(5), async {
        while d.download_active.lock().await.contains(id) {
            tokio::time::sleep(std::time::Duration::from_millis(5)).await;
        }
    })
    .await?;
    let target = root.0.join("DR-1_剧名");
    assert_eq!(std::fs::read(target.join("1.mp4"))?, b"new");
    assert_eq!(std::fs::read(target.join("cover.png"))?, b"new");
    assert_eq!(calls.load(Ordering::SeqCst), 2);
    assert_eq!(load(&root.0)?[0].status, "已完成");
    Ok(())
}

#[tokio::test]
async fn cover_check_failure_is_visible_and_does_not_silently_complete() -> Result<()> {
    let root = Dir::new()?;
    let (base, calls, _server) = server_options(
        "503 Unavailable",
        "cover unavailable",
        "text/plain",
        false,
        true,
    )
    .await?;
    let d = desktop(&root, &base, "已完成").await?;
    std::fs::write(root.0.join("1.mp4"), b"old")?;
    run(&d, false).await?;
    let saved = load(&root.0)?;
    assert_eq!(saved[0].status, "下载失败");
    assert!(saved[0].error.contains("检查下载封面失败"));
    assert_eq!(saved[0].files.len(), 1);
    assert_eq!(calls.load(Ordering::SeqCst), 0);
    assert_eq!(std::fs::read(root.0.join("1.mp4"))?, b"old");
    Ok(())
}
