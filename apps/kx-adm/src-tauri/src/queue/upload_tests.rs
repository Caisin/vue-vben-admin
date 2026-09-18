use super::*;
use crate::session::{SessionEvents, Vault};
use base64::Engine;
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::TcpListener,
};
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
impl UploadEvents for Events {
    fn job_updated(&self, _: Value) -> Result<()> {
        Ok(())
    }
}
#[tokio::test]
async fn opendal_uploads_with_s3_credentials_and_metadata_then_registers_version() -> Result<()> {
    exercise_upload(2 * 1024 * 1024 + 13).await
}
#[tokio::test]
async fn opendal_multipart_keeps_video_metadata_and_completes_before_registration() -> Result<()> {
    exercise_upload(10 * 1024 * 1024 + 13).await
}
async fn exercise_upload(size: usize) -> Result<()> {
    let listener = TcpListener::bind("127.0.0.1:0").await?;
    let base = format!("http://{}", listener.local_addr()?);
    let remote = base.clone();
    let data = vec![7u8; size];
    let requests = if size > 8 * 1024 * 1024 { 10 } else { 7 };
    let expected = data.clone();
    let server = tokio::spawn(async move {
        let mut paths = Vec::new();
        let mut uploaded: Vec<u8> = Vec::new();
        for _ in 0..requests {
            let (mut socket, _) = listener.accept().await.unwrap();
            let mut bytes = Vec::new();
            let end = loop {
                let mut b = [0; 4096];
                let n = socket.read(&mut b).await.unwrap();
                assert!(n > 0);
                bytes.extend(&b[..n]);
                if let Some(i) = bytes.windows(4).position(|w| w == b"\r\n\r\n") {
                    break i + 4;
                }
            };
            let headers = String::from_utf8_lossy(&bytes[..end]).to_lowercase();
            let len = headers
                .lines()
                .find_map(|l| l.strip_prefix("content-length: "))
                .and_then(|v| v.parse::<usize>().ok())
                .unwrap_or(0);
            while bytes.len() < end + len {
                let mut b = vec![0; 65536];
                let n = socket.read(&mut b).await.unwrap();
                assert!(n > 0);
                bytes.extend(&b[..n]);
            }
            let path = headers
                .lines()
                .next()
                .unwrap()
                .split_whitespace()
                .nth(1)
                .unwrap();
            paths.push(path.to_owned());
            if len > 0 && !path.starts_with("/videos/") {
                assert!(headers.contains("content-type: application/json"));
            }
            let mut object_response = Vec::new();
            let result = match path {
                "/adm/res/drama-storage" => {
                    serde_json::json!({"code":"media","storage_name":"剧视频","storage_type":"s3"})
                }
                "/auth/user/user_info" => serde_json::json!({"id":7}),
                "/adm/res/41/versions/2/files/media/native-prepare" => {
                    let body: Value = serde_json::from_slice(
                        &kx_ed::KxEd::de(&bytes[end..end + len]).await.unwrap(),
                    )
                    .unwrap();
                    assert_eq!(body["size"], expected.len());
                    assert_eq!(body["md5_hash"], format!("{:x}", md5::compute(&expected)));
                    serde_json::json!({"upload_required":true,"key":format!("uploads/res/41/versions/2/{}",body["md5_hash"].as_str().unwrap()),"content_type":"video/mp4","content_disposition":"inline; filename=episode.mp4","config":{"endpoint":remote,"bucket":"videos","region":"us-east-1","enable_virtual_host":false,"access_key_id":"test-access","secret_access_key":"test-secret","session_token":""}})
                }
                p if p.starts_with("/videos/uploads/res/41/versions/2/") => {
                    assert!(!headers.contains("authorization: bearer"));
                    assert!(headers.contains("authorization: aws4-hmac-sha256"));
                    assert!(!headers.contains("cookie:"));
                    if path.contains("?uploads") {
                        assert!(headers.contains("content-type: video/mp4"));
                        assert!(headers.contains("content-disposition: inline"));
                        object_response = b"<InitiateMultipartUploadResult><UploadId>fixture-upload</UploadId></InitiateMultipartUploadResult>".to_vec();
                    } else if headers.starts_with("put ") {
                        if !path.contains("partnumber=") {
                            assert!(headers.contains("content-type: video/mp4"));
                            assert!(headers.contains("content-disposition: inline"));
                        }
                        uploaded.extend(&bytes[end..end + len]);
                    } else {
                        assert!(path.contains("uploadid="));
                        assert!(headers.starts_with("post "));
                        assert_eq!(uploaded, expected);
                        object_response = b"<CompleteMultipartUploadResult><ETag>multipart-etag-2</ETag></CompleteMultipartUploadResult>".to_vec();
                    }
                    Value::Null
                }
                "/adm/res/41/versions/2/files/media/complete" => {
                    assert_eq!(uploaded, expected);
                    let body: Value = serde_json::from_slice(
                        &kx_ed::KxEd::de(&bytes[end..end + len]).await.unwrap(),
                    )
                    .unwrap();
                    assert_eq!(
                        body["key"],
                        format!(
                            "uploads/res/41/versions/2/{}",
                            body["md5_hash"].as_str().unwrap()
                        )
                    );
                    serde_json::json!({"file":{"file_id":9007199254740999i64}})
                }
                "/adm/res/41/versions/2/video-imports" => {
                    let body: Value = serde_json::from_slice(
                        &kx_ed::KxEd::de(&bytes[end..end + len]).await.unwrap(),
                    )
                    .unwrap();
                    assert_eq!(body["entries"][0]["file_id"], 9007199254740999i64);
                    assert_eq!(body["entries"][0]["seq_no"], 1);
                    serde_json::json!({"id":55,"dispatch_error":""})
                }
                "/adm/res/41/versions/2/video-imports/55" => {
                    serde_json::json!({"task_run":{"status":"succeeded"},"results":[{"seq_no":1,"state":"succeeded","message":"已登记"}]})
                }
                _ => panic!("unexpected route {path}"),
            };
            let body = if path.starts_with("/videos/") {
                object_response
            } else {
                assert!(headers.contains("authorization: bearer "));
                kx_ed::KxEd::en(
                    &serde_json::to_vec(&serde_json::json!({"code":200,"result":result})).unwrap(),
                )
                .await
                .unwrap()
            };
            socket
                .write_all(
                    format!(
                        "HTTP/1.1 200 OK\r\nETag: test-part\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                        body.len()
                    )
                    .as_bytes(),
                )
                .await
                .unwrap();
            socket.write_all(&body).await.unwrap();
        }
        paths
    });
    let dir = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
    let root = dir.join("drama");
    std::fs::create_dir_all(&root)?;
    std::fs::write(root.join("第1集.mp4"), data)?;
    let mut d = Desktop::new(dir.clone())?;
    Arc::get_mut(&mut d).unwrap().vault = Vault::Memory(tokio::sync::Mutex::new(None));
    d.configure(&Events, base.clone()).await?;
    let payload = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(serde_json::to_vec(
        &serde_json::json!({"uid":7,"exp":crate::session::now()+3600}),
    )?);
    d.import(&Events, format!("h.{payload}.s")).await?;
    let items = crate::scan::scan(&root)?;
    let job = Job {
        timing: Default::default(),
        concurrency: 3,
        version_name: String::new(),
        id: "test".into(),
        api_base: base,
        uid: "7".into(),
        res: "41".into(),
        version: "2".into(),
        storage: "media".into(),
        local_storage: false,
        root: root.canonicalize()?,
        name: "剧".into(),
        status: "等待上传".into(),
        error: String::new(),
        items,
        import_id: None,
    };
    d.add(&Events, job).await?;
    d.run(&Events, "test").await?;
    let q = d.queue.lock().await;
    assert_eq!(q[0].status, "完成");
    assert_eq!(q[0].items[0].status, "已登记");
    assert_eq!(q[0].items[0].file_id.as_deref(), Some("9007199254740999"));
    drop(q);
    assert_eq!(server.await?.len(), requests);
    let persisted = std::fs::read_to_string(dir.join("upload-queue.json"))?;
    assert!(!persisted.contains("test-secret"));
    assert!(!persisted.contains("access_key_id"));
    std::fs::remove_dir_all(dir)?;
    Ok(())
}
