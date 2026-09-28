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
    let listener = TcpListener::bind("127.0.0.1:0").await?;
    let base = format!("http://{}", listener.local_addr()?);
    let calls = Arc::new(AtomicUsize::new(0));
    let count = calls.clone();
    let response = format!(
        "HTTP/1.1 {status}\r\nContent-Type: {content_type}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
        body.len()
    );
    let task = tokio::spawn(async move {
        while let Ok((mut stream, _)) = listener.accept().await {
            let mut buffer = [0u8; 8192];
            let _ = stream.read(&mut buffer).await;
            count.fetch_add(1, Ordering::SeqCst);
            let _ = stream.write_all(response.as_bytes()).await;
        }
    });
    Ok((base, calls, tokio_util::task::AbortOnDropHandle::new(task)))
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
    d.resume_download(Events::default(), "fixture-job".into(), overwrite)
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
