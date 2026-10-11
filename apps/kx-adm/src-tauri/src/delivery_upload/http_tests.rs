use super::*;
use crate::session::SessionEvents;
use tokio::io::AsyncWriteExt;
struct Events;
impl SessionEvents for Events {
    fn updated(&self, _: &Session) -> Result<()> {
        Ok(())
    }
    fn cleared(&self, _: u64) -> Result<()> {
        Ok(())
    }
}
#[tokio::test]
async fn signed_upload_streams_images_documents_and_video_without_session_secrets() -> Result<()> {
    for name in ["工程截图.png", "剧本简介.pdf", "无音乐版.mp4"] {
        exercise(name, false, false).await?;
    }
    Ok(())
}
#[tokio::test]
async fn account_change_after_object_upload_prevents_file_registration() -> Result<()> {
    exercise("poster.png", true, false).await
}
#[tokio::test]
async fn local_upload_streams_multipart_with_device_headers() -> Result<()> {
    exercise("prompt.txt", false, true).await
}
async fn exercise(name: &str, logout: bool, local: bool) -> Result<()> {
    let dir = tempfile::tempdir()?;
    let desktop = Desktop::new(dir.path().to_path_buf())?;
    let path = dir.path().join(name);
    let payload = vec![b'x'; 1024 * 1024 + 71];
    std::fs::write(&path, &payload)?;
    let file = selected_file(
        path,
        if name.ends_with("mp4") {
            "silent"
        } else if name.ends_with("pdf") || name.ends_with("txt") {
            "synopsis"
        } else {
            "poster"
        },
    )?;
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await?;
    let base = format!("http://{}", listener.local_addr()?);
    let owner = Session {
        token: "fixture-token".into(),
        uid: "7".into(),
        api_base: base.clone(),
        generation: 1,
        expires_at: crate::session::now() + 3600,
    };
    desktop.auth.lock().await.session = Some(owner.clone());
    let d = desktop.clone();
    let expected_name = name.to_owned();
    let expected_payload = payload.clone();
    let server = tokio::spawn(async move {
        for _ in 0..if local || logout { 2 } else { 3 } {
            let (mut socket, _) = listener.accept().await?;
            let mut bytes = Vec::new();
            let end = loop {
                let mut b = [0; 8192];
                let n = socket.read(&mut b).await?;
                ensure!(n > 0, "incomplete headers");
                bytes.extend_from_slice(&b[..n]);
                if let Some(i) = bytes.windows(4).position(|b| b == b"\r\n\r\n") {
                    break i + 4;
                }
            };
            let h = String::from_utf8(bytes[..end].to_vec())?.to_lowercase();
            let size = h
                .lines()
                .find_map(|l| l.strip_prefix("content-length:"))
                .unwrap_or("0")
                .trim()
                .parse::<usize>()?;
            while bytes.len() < end + size {
                let mut b = [0; 8192];
                let n = socket.read(&mut b).await?;
                ensure!(n > 0, "incomplete body");
                bytes.extend_from_slice(&b[..n]);
            }
            let route = h.lines().next().unwrap().split_whitespace().nth(1).unwrap();
            let response = if route.starts_with("/object") {
                assert!(
                    !h.contains("authorization:") && !h.contains("x-kx-") && !h.contains("cookie:")
                );
                assert_eq!(&bytes[end..end + size], expected_payload);
                if logout {
                    d.auth.lock().await.session = None;
                }
                Vec::new()
            } else if route.ends_with("/upload") {
                assert!(
                    h.contains("x-kx-client: tauri")
                        && h.contains("authorization: bearer")
                        && h.contains("x-kx-device-")
                );
                assert!(
                    bytes[end..]
                        .windows(expected_payload.len())
                        .any(|b| b == expected_payload)
                );
                serde_json::to_vec(
                    &json!({"code":200,"result":{"file_id":77,"name":expected_name}}),
                )?
            } else {
                assert!(h.contains("authorization: bearer"));
                let result = if local {
                    json!({"local":true})
                } else {
                    let input: Value =
                        serde_json::from_slice(&kx_ed::KxEd::de(&bytes[end..end + size]).await?)?;
                    assert_eq!(input["file_name"], expected_name);
                    assert_eq!(input["size"], expected_payload.len());
                    if route.ends_with("/prepare") {
                        json!({"upload_required":true,"method":"PUT","upload_url":format!("{base}/object?signature=fixture"),"headers":{"content-type":"application/octet-stream"},"key":"production/test"})
                    } else {
                        assert!(route.ends_with("/complete"));
                        assert_eq!(input["key"], "production/test");
                        json!({"file":{"file_id":77}})
                    }
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
        Ok::<_, anyhow::Error>(())
    });
    let mut progress = Vec::new();
    let result = tokio::time::timeout(
        Duration::from_secs(20),
        transfer(
            &desktop,
            &Events,
            &owner,
            "/adm/res/delivery/-1/2/transfer/poster/0",
            &file,
            local,
            |s, b| progress.push((s.to_owned(), b)),
        ),
    )
    .await?;
    tokio::time::timeout(Duration::from_secs(20), server).await???;
    if logout {
        assert!(result.is_err());
    } else {
        assert_eq!(result?, 77);
        assert!(progress.iter().any(|(s, _)| s == "上传中"));
    }
    Ok(())
}

#[tokio::test]
async fn token_refresh_continues_but_logout_pause_stops_same_account_transfer() -> Result<()> {
    let dir = tempfile::tempdir()?;
    let d = Desktop::new(dir.path().to_path_buf())?;
    let owner = Session {
        token: "old".into(),
        uid: "7".into(),
        api_base: "https://example.test".into(),
        generation: 1,
        expires_at: crate::session::now() + 3600,
    };
    let mut refreshed = owner.clone();
    refreshed.token = "refreshed".into();
    refreshed.generation = 2;
    d.auth.lock().await.session = Some(refreshed);
    checkpoint(&d, &owner).await?;
    d.pause_all().await?;
    assert!(checkpoint(&d, &owner).await.is_err());
    Ok(())
}
