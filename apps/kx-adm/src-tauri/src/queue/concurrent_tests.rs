use super::*;
use crate::session::SessionEvents;
use base64::Engine;
use std::sync::atomic::{AtomicUsize, Ordering};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::TcpListener,
};
#[derive(Clone, Default)]
struct Events(Arc<std::sync::Mutex<Vec<Value>>>);
impl SessionEvents for Events {
    fn updated(&self, _: &Session) -> Result<()> {
        Ok(())
    }
    fn cleared(&self, _: u64) -> Result<()> {
        Ok(())
    }
}
impl UploadEvents for Events {
    fn job_updated(&self, v: Value) -> Result<()> {
        self.0.lock().unwrap().push(v);
        Ok(())
    }
}
#[tokio::test]
async fn tk_pool_limits_parallel_episodes_keeps_successes_and_records_directory_time() -> Result<()>
{
    let listener = TcpListener::bind("127.0.0.1:0").await?;
    let base = format!("http://{}", listener.local_addr()?);
    let active = Arc::new(AtomicUsize::new(0));
    let peak = Arc::new(AtomicUsize::new(0));
    let puts = Arc::new(AtomicUsize::new(0));
    let failures = Arc::new(AtomicUsize::new(0));
    let server_base = base.clone();
    let (live, max, count, fail) = (active.clone(), peak.clone(), puts.clone(), failures.clone());
    let server = tokio::spawn(async move {
        let mut clients = tokio::task::JoinSet::new();
        loop {
            let (mut socket, _) = listener.accept().await.unwrap();
            let (base, live, max, count, fail) = (
                server_base.clone(),
                live.clone(),
                max.clone(),
                count.clone(),
                fail.clone(),
            );
            clients.spawn(async move {
                let mut bytes=Vec::new();let end=loop {let mut buf=[0;4096];let n=socket.read(&mut buf).await.unwrap();assert!(n>0);bytes.extend(&buf[..n]);if let Some(i)=bytes.windows(4).position(|w|w==b"\r\n\r\n"){break i+4;}};
                let headers=String::from_utf8_lossy(&bytes[..end]).to_lowercase();let path=headers.lines().next().unwrap().split_whitespace().nth(1).unwrap();
                let len=headers.lines().find_map(|l|l.strip_prefix("content-length: ")).and_then(|s|s.parse::<usize>().ok()).unwrap_or(0);
                while bytes.len()<end+len {let mut buf=[0;8192];let n=socket.read(&mut buf).await.unwrap();assert!(n>0);bytes.extend(&buf[..n]);}
                let mut status=200;
                let data=if path.starts_with("/videos/") {
                    assert!(headers.contains("content-type: video/mp4"));assert!(headers.contains("content-disposition: inline"));assert!(!headers.contains("authorization: bearer"));
                    assert!(headers.contains("authorization: aws4-hmac-sha256"));
                    count.fetch_add(1,Ordering::SeqCst);let n=live.fetch_add(1,Ordering::SeqCst)+1;max.fetch_max(n,Ordering::SeqCst);
                    tokio::time::sleep(Duration::from_millis(100)).await;
                    live.fetch_sub(1,Ordering::SeqCst);
                    if bytes[end] == 2 && fail.fetch_add(1,Ordering::SeqCst)==0 {status=500;}
                    Vec::new()
                } else {
                    let input:Value=if len>0 {serde_json::from_slice(&kx_ed::KxEd::de(&bytes[end..end+len]).await.unwrap()).unwrap()}else{Value::Null};
                    let result=if path=="/auth/user/user_info" {json!({"id":7})}
                    else if path=="/adm/res/drama-storage" {json!({"code":"media","storage_type":"s3"})}
                    else if path.ends_with("/native-prepare") {let name=input["file_name"].as_str().unwrap();json!({"upload_required":true,"key":format!("res/41/versions/2/{}",input["md5_hash"].as_str().unwrap()),"content_type":"video/mp4","content_disposition":format!("inline; filename={name}.mp4"),"config":{"endpoint":base,"bucket":"videos","region":"us-east-1","enable_virtual_host":false,"access_key_id":"test-access","secret_access_key":"test-secret","session_token":""}})}
                    else if path.ends_with("/complete") {let name=input["file_name"].as_str().unwrap().parse::<i64>().unwrap();json!({"file":{"file_id":100+name}})}
                    else if path.ends_with("/video-imports") {assert_eq!(input["entries"].as_array().unwrap().len(),5);json!({"id":99,"dispatch_error":""})}
                    else if path.ends_with("/video-imports/99") {json!({"task_run":{"status":"succeeded"},"results":(1..=5).map(|n|json!({"seq_no":n,"state":"succeeded"})).collect::<Vec<_>>()})}
                    else {panic!("unexpected API {path}")};
                    kx_ed::KxEd::en(&serde_json::to_vec(&json!({"code":200,"result":result})).unwrap()).await.unwrap()
                };
                socket.write_all(format!("HTTP/1.1 {status} OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",data.len()).as_bytes()).await.unwrap();socket.write_all(&data).await.unwrap();
            });
        }
    });
    let dir = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
    let root = dir.join("version-original");
    std::fs::create_dir_all(&root)?;
    for n in 1..=5 {
        std::fs::write(root.join(format!("{n}.mp4")), vec![n as u8; 32768])?;
    }
    let d = Desktop::new(dir.clone())?;
    let events = Events::default();
    d.configure(&events, base.clone()).await?;
    let token = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(serde_json::to_vec(
        &json!({"uid":7,"exp":crate::session::now()+3600}),
    )?);
    d.import(&events, format!("h.{token}.s")).await?;
    let job = Job {
        revision: 0,
        collapsed: true,
        id: "parallel".into(),
        api_base: base,
        uid: "7".into(),
        res: "41".into(),
        version: "2".into(),
        version_name: "原版".into(),
        concurrency: 2,
        timing: Default::default(),
        storage: "media".into(),
        local_storage: false,
        root: root.canonicalize()?,
        name: "version-original".into(),
        status: "等待上传".into(),
        error: String::new(),
        items: crate::scan::scan(&root)?,
        import_id: None,
    };
    d.add(&events, job).await?;
    assert!(d.run(&events, "parallel").await.is_err());
    assert_eq!(peak.load(Ordering::SeqCst), 2);
    assert_eq!(puts.load(Ordering::SeqCst), 5);
    let saved = d.queue.lock().await[0].clone();
    assert_eq!(
        saved.items.iter().filter(|i| i.file_id.is_some()).count(),
        4
    );
    assert_eq!(saved.items[1].status, "上传失败");
    assert!(saved.timing.elapsed_ms >= 200);
    assert!(!saved.timing.active);
    let elapsed = saved.timing.elapsed_ms;
    tokio::time::sleep(Duration::from_millis(30)).await;
    assert_eq!(d.queue.lock().await[0].timing.elapsed_ms, elapsed);
    d.run(&events, "parallel").await?;
    assert_eq!(puts.load(Ordering::SeqCst), 6);
    let saved = d.queue.lock().await[0].clone();
    assert_eq!(saved.status, "完成");
    assert!(
        saved
            .items
            .iter()
            .all(|i| i.file_id.is_some() && i.timing.finished_at.is_some())
    );
    assert!(saved.timing.finished_at.is_some());
    let restored = load(&dir)?;
    assert_eq!(restored[0].timing.elapsed_ms, saved.timing.elapsed_ms);
    assert_eq!(restored[0].concurrency, 2);
    assert_eq!(saved.view()["targetDirectory"], "res/41/versions/2/");
    {
        let snapshots = events.0.lock().unwrap();
        assert!(snapshots.iter().any(|s| {
            s["items"]
                .as_array()
                .unwrap()
                .iter()
                .filter(|i| i["timing"]["active"] == true)
                .count()
                == 2
        }));
    }
    // 暂停只等待已开始的两集，后续集不可再启动；累计耗时和成功 ID 保留。
    let mut paused = saved.clone();
    paused.id = "pause-fixture".into();
    paused.status = "等待上传".into();
    paused.import_id = None;
    paused.timing = Default::default();
    for item in &mut paused.items {
        item.file_id = None;
        item.bytes = 0;
        item.timing = Default::default();
        item.status = "待上传".into();
    }
    d.add(&events, paused).await?;
    let runner = d.clone();
    let running_events = events.clone();
    let running = tokio::spawn(async move { runner.run(&running_events, "pause-fixture").await });
    tokio::time::timeout(Duration::from_secs(5), async {
        while puts.load(Ordering::SeqCst) < 8 {
            tokio::time::sleep(Duration::from_millis(1)).await;
        }
    })
    .await?;
    d.pause(&events, "pause-fixture").await?;
    assert!(running.await?.is_err());
    assert_eq!(puts.load(Ordering::SeqCst), 8);
    let paused = d.queue.lock().await[1].clone();
    assert_eq!(
        paused
            .items
            .iter()
            .filter(|item| item.file_id.is_some())
            .count(),
        2
    );
    assert!(!paused.timing.active);
    server.abort();
    std::fs::remove_dir_all(dir)?;
    Ok(())
}
