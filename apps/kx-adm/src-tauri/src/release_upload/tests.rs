use super::*;
use base64::Engine;
use tokio::io::AsyncWriteExt;

#[derive(Clone)]
struct Events;
impl SessionEvents for Events {
    fn updated(&self, _: &Session) -> Result<()> {
        Ok(())
    }
    fn cleared(&self, _: u64) -> Result<()> {
        Ok(())
    }
}

async fn package(path: &Path, size: u64, payload: &[u8]) -> Result<()> {
    package_named(path, size, payload, "app.exe", "windows-x86_64").await
}

async fn package_named(
    path: &Path,
    size: u64,
    payload: &[u8],
    name: &'static str,
    target: &'static str,
) -> Result<()> {
    let path = path.to_owned();
    let payload = payload.to_vec();
    tauri::async_runtime::spawn_blocking(move || -> Result<()> {
        let metadata = serde_json::to_vec(&json!({"version":"1.0.0", "notes":"发行说明", "target":target, "name":name, "signature":"signed", "size":size}))?;
        let gzip = flate2::write::GzEncoder::new(std::fs::File::create(path)?, flate2::Compression::fast());
        let mut archive = tar::Builder::new(gzip);
        let mut header = tar::Header::new_ustar();
        header.set_size(metadata.len() as u64); header.set_mode(0o600); header.set_cksum();
        archive.append_data(&mut header, "release.json", metadata.as_slice())?;
        header.set_size(size); header.set_cksum();
        if payload.is_empty() {
            archive.append_data(&mut header, "installer", std::io::Read::take(std::io::repeat(0), size))?;
        } else {
            archive.append_data(&mut header, "installer", payload.as_slice())?;
        }
        archive.into_inner()?.finish()?;
        Ok(())
    }).await??;
    Ok(())
}

#[tokio::test]
async fn parses_script_generated_tgz_and_rejects_corruption() -> Result<()> {
    use std::io::{Read, Write};
    let path = std::env::temp_dir().join(format!("kx-tgz-{}.tgz", uuid::Uuid::new_v4()));
    let bytes = include_bytes!("../../../test-fixtures/release.tgz");
    std::fs::write(&path, bytes)?;
    let mut bundle = Bundle::open(&path).await?;
    let mut payload = Vec::new();
    bundle.file.read_to_end(&mut payload).await?;
    assert_eq!(payload, b"raw installer fixture");
    drop(bundle);
    std::fs::write(&path, &bytes[..bytes.len() - 8])?;
    assert!(Bundle::open(&path).await.is_err());
    let mut tar = Vec::new();
    flate2::read::GzDecoder::new(bytes.as_slice()).read_to_end(&mut tar)?;
    for offset in [0, 156, 2048] {
        let mut altered = tar.clone();
        altered[offset] = b'A';
        let mut encoder = flate2::write::GzEncoder::new(Vec::new(), flate2::Compression::fast());
        encoder.write_all(&altered)?;
        std::fs::write(&path, encoder.finish()?)?;
        assert!(Bundle::open(&path).await.is_err());
    }
    std::fs::remove_file(path)?;
    Ok(())
}

#[tokio::test]
async fn extracts_large_release_with_bounded_memory() -> Result<()> {
    let path = std::env::temp_dir().join(format!("kx-release-{}.tgz", uuid::Uuid::new_v4()));
    package(&path, 513 * 1024 * 1024, &[]).await?;
    let bundle = Bundle::open(&path).await?;
    assert_eq!(bundle.metadata.size, 513 * 1024 * 1024);
    drop(bundle);
    std::fs::remove_file(path)?;
    Ok(())
}

#[tokio::test]
async fn direct_upload_streams_only_installer_and_registers_after_success() -> Result<()> {
    transfer(false, "app.exe", "windows-x86_64").await
}

#[tokio::test]
async fn logout_during_upload_prevents_registration() -> Result<()> {
    transfer(true, "app.exe", "windows-x86_64").await
}

#[tokio::test]
async fn compound_and_versioned_filenames_are_preserved_in_prepare_and_complete() -> Result<()> {
    for (name, target) in [
        ("Qinjiu.app.tar.gz", "darwin-aarch64"),
        ("Qinjiu_1.2.3_x64-setup.exe", "windows-x86_64"),
        ("Qinjiu_1.2.3.AppImage", "linux-x86_64"),
    ] {
        transfer(false, name, target).await?;
    }
    Ok(())
}

async fn transfer(logout: bool, name: &'static str, target: &'static str) -> Result<()> {
    let dir = std::env::temp_dir().join(format!("kx-release-upload-{}", uuid::Uuid::new_v4()));
    let desktop = Desktop::new(dir.clone())?;
    let path = dir.join("release.tgz");
    let payload = b"raw installer payload: not the release envelope";
    package_named(&path, payload.len() as u64, payload, name, target).await?;
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await?;
    let base = format!("http://{}", listener.local_addr()?);
    let identity = Session {
        uid: "7".into(),
        token: format!(
            "h.{}.s",
            base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(serde_json::to_vec(
                &json!({"uid":7,"exp":crate::session::now()+3600})
            )?)
        ),
        expires_at: crate::session::now() + 3600,
        api_base: base.clone(),
        generation: 1,
    };
    {
        let mut auth = desktop.auth.lock().await;
        auth.base = base.clone();
        auth.session = Some(identity.clone());
    }
    let owner = desktop.clone();
    let server = tokio::spawn(async move {
        let mut requests = Vec::new();
        for _ in 0..if logout { 2 } else { 3 } {
            let (mut socket, _) = listener.accept().await?;
            let mut bytes = Vec::new();
            let end = loop {
                let mut buffer = [0; 4096];
                let count = socket.read(&mut buffer).await?;
                ensure!(count > 0, "incomplete request");
                bytes.extend_from_slice(&buffer[..count]);
                if let Some(index) = bytes.windows(4).position(|v| v == b"\r\n\r\n") {
                    break index + 4;
                }
            };
            let headers = String::from_utf8(bytes[..end].to_vec())?.to_ascii_lowercase();
            let len: usize = headers
                .lines()
                .find_map(|line| line.strip_prefix("content-length:"))
                .context("missing length")?
                .trim()
                .parse()?;
            while bytes.len() < end + len {
                let mut buffer = [0; 4096];
                let count = socket.read(&mut buffer).await?;
                ensure!(count > 0, "incomplete body");
                bytes.extend_from_slice(&buffer[..count]);
            }
            let route = headers
                .lines()
                .next()
                .unwrap()
                .split_whitespace()
                .nth(1)
                .unwrap();
            requests.push(route.to_owned());
            let response = if route.starts_with("/object") {
                assert!(
                    !headers.contains("authorization:")
                        && !headers.contains("x-kx-")
                        && !headers.contains("cookie:")
                );
                assert_eq!(&bytes[end..end + len], payload);
                if logout {
                    owner.auth.lock().await.session = None;
                }
                Vec::new()
            } else {
                assert!(
                    headers.contains("authorization: bearer") && headers.contains("security: true")
                );
                let input: serde_json::Value =
                    serde_json::from_slice(&kx_ed::KxEd::de(&bytes[end..end + len]).await?)?;
                assert_eq!(input["file_name"], name);
                assert_eq!(
                    input["file_ext"],
                    Path::new(name).extension().unwrap().to_str().unwrap()
                );
                assert_eq!(input["size"], payload.len());
                assert_eq!(input["md5_hash"], format!("{:x}", md5::compute(payload)));
                let result = if route.ends_with("/prepare") {
                    json!({"upload_required":true,"method":"PUT","upload_url":format!("{base}/object?signature=fixture"),"headers":{"content-type":"application/octet-stream"},"key":"client-releases/fixture"})
                } else {
                    assert!(route.ends_with("/complete"));
                    assert_eq!(input["key"], "client-releases/fixture");
                    json!({"file":{"file_id":9007199254740999_i64}})
                };
                kx_ed::KxEd::en(&serde_json::to_vec(&json!({"code":200,"result":result}))?).await?
            };
            socket
                .write_all(
                    format!(
                        "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                        response.len()
                    )
                    .as_bytes(),
                )
                .await?;
            socket.write_all(&response).await?;
        }
        Ok::<_, anyhow::Error>(requests)
    });
    let progress = Arc::new(std::sync::Mutex::new(Vec::new()));
    let sink = progress.clone();
    let result = upload(
        &desktop,
        &Events,
        &identity,
        "media",
        Bundle::open(&path).await?,
        move |stage, bytes, total| sink.lock().unwrap().push((stage.to_owned(), bytes, total)),
    )
    .await;
    let requests = server.await??;
    if logout {
        assert!(result.is_err());
        assert!(!requests.iter().any(|path| path.ends_with("/complete")));
    } else {
        assert_eq!(result?.artifacts[0].file_id, "9007199254740999");
        assert_eq!(progress.lock().unwrap().last().unwrap().0, "completed");
    }
    drop(desktop);
    std::fs::remove_dir_all(dir)?;
    Ok(())
}
