use super::*;

#[tokio::test]
async fn nine_episodes_leave_one_global_slot_for_the_next_series() -> Result<()> {
    let root = Dir::new()?;
    let listener = TcpListener::bind("127.0.0.1:0").await?;
    let base = format!("http://{}", listener.local_addr()?);
    let started = Arc::new(tokio::sync::Mutex::new(Vec::<i64>::new()));
    let active = Arc::new(AtomicUsize::new(0));
    let peak = Arc::new(AtomicUsize::new(0));
    let gate = Arc::new(tokio::sync::Semaphore::new(0));
    let server = {
        let started = started.clone();
        let active = active.clone();
        let peak = peak.clone();
        let gate = gate.clone();
        let base = base.clone();
        tokio_util::task::AbortOnDropHandle::new(tokio::spawn(async move {
            let mut connections = tokio::task::JoinSet::new();
            while let Ok((mut stream, _)) = listener.accept().await {
                let (started, active, peak, gate, base) = (
                    started.clone(),
                    active.clone(),
                    peak.clone(),
                    gate.clone(),
                    base.clone(),
                );
                connections.spawn(async move {
                    let mut buf = [0; 8192];
                    let n = stream.read(&mut buf).await.unwrap();
                    let request = String::from_utf8_lossy(&buf[..n]);
                    let path = request.lines().next().unwrap().split_whitespace().nth(1).unwrap();
                    let body = if let Some(id) = path.strip_prefix("/object/") {
                        let id = id.parse::<i64>().unwrap();
                        let now = active.fetch_add(1, Ordering::SeqCst) + 1;
                        peak.fetch_max(now, Ordering::SeqCst);
                        started.lock().await.push(id);
                        gate.acquire().await.unwrap().forget();
                        active.fetch_sub(1, Ordering::SeqCst);
                        b"new".to_vec()
                    } else {
                        let result = if path.ends_with("/url") {
                            let id = path.split('/').nth_back(1).unwrap();
                            json!({"mode":"direct", "url":format!("{base}/object/{id}"), "log_id":id.parse::<i64>().unwrap()})
                        } else { json!(true) };
                        kx_ed::KxEd::en(&serde_json::to_vec(&json!({"code":200,"result":result})).unwrap()).await.unwrap()
                    };
                    let kind = if path.starts_with("/object/") { "application/octet-stream" } else { "application/json" };
                    let head = format!("HTTP/1.1 200 OK\r\nContent-Type: {kind}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n", body.len());
                    stream.write_all(head.as_bytes()).await.unwrap();
                    stream.write_all(&body).await.unwrap();
                });
            }
        }))
    };
    let d = desktop(&root, &base, "待下载").await?;
    d.save_download_settings(10).await?;
    {
        let mut q = d.download_queue.lock().await;
        q[0].res_id = -1;
        q[0].files = (1..=9)
            .map(|id| DownloadFile {
                file_id: id,
                file_name: format!("first-{id}.mp4"),
                size: 3,
                ..Default::default()
            })
            .collect();
        let mut second = q[0].clone();
        second.id = "second".into();
        second.res_id = -2;
        second.files = (100..103)
            .map(|id| DownloadFile {
                file_id: id,
                file_name: format!("second-{id}.mp4"),
                size: 3,
                ..Default::default()
            })
            .collect();
        q.push(second);
    }
    d.resume_download(Events::default(), "fixture-job".into(), false, None)
        .await?;
    tokio::time::timeout(std::time::Duration::from_secs(5), async {
        while started.lock().await.len() < 9 {
            tokio::time::sleep(std::time::Duration::from_millis(5)).await;
        }
    })
    .await?;
    d.resume_download(Events::default(), "second".into(), false, None)
        .await?;
    tokio::time::timeout(std::time::Duration::from_secs(5), async {
        while started.lock().await.len() < 10 {
            tokio::time::sleep(std::time::Duration::from_millis(5)).await;
        }
    })
    .await?;
    assert_eq!(
        started.lock().await.iter().filter(|id| **id >= 100).count(),
        1,
        "第一部剧的9集尚未完成时，下一部剧已自动开始1集"
    );
    assert_eq!(peak.load(Ordering::SeqCst), 10);
    gate.add_permits(1);
    tokio::time::timeout(std::time::Duration::from_secs(5), async {
        while started.lock().await.len() < 11 {
            tokio::time::sleep(std::time::Duration::from_millis(5)).await;
        }
    })
    .await?;
    assert!(peak.load(Ordering::SeqCst) <= 10);
    gate.add_permits(20);
    tokio::time::timeout(std::time::Duration::from_secs(5), async {
        while !d.download_active.lock().await.is_empty() {
            tokio::time::sleep(std::time::Duration::from_millis(5)).await;
        }
    })
    .await?;
    assert_eq!(started.lock().await.len(), 12);
    assert!(load(&root.0)?.iter().all(|job| job.status == "已完成"));
    drop(server);
    Ok(())
}
