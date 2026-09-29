use super::*;
use std::sync::{
    Mutex as StdMutex,
    atomic::{AtomicUsize, Ordering},
};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::TcpListener,
};
#[derive(Default)]
struct Events(StdMutex<Vec<Option<Session>>>);
impl SessionEvents for Events {
    fn updated(&self, s: &Session) -> Result<()> {
        self.0.lock().unwrap().push(Some(s.clone()));
        Ok(())
    }
    fn cleared(&self, _: u64) -> Result<()> {
        self.0.lock().unwrap().push(None);
        Ok(())
    }
}
fn token(uid: i64, exp: i64, suffix: &str) -> String {
    format!(
        "header.{}.signature{suffix}",
        URL_SAFE_NO_PAD
            .encode(serde_json::to_vec(&serde_json::json!({"uid":uid,"exp":exp})).unwrap())
    )
}
#[tokio::test]
async fn native_refresh_is_singleflight_and_restart_has_no_persisted_token() -> Result<()> {
    let listener = TcpListener::bind("127.0.0.1:0").await?;
    let base = format!("http://{}", listener.local_addr()?);
    let calls = Arc::new(AtomicUsize::new(0));
    let counter = calls.clone();
    let next = token(7, now() + 3600, "next");
    let response_token = next.clone();
    let old = token(7, now() - 120, "old");
    let exchange_token = old.clone();
    let server = tokio::spawn(async move {
        loop {
            let (mut socket, _) = listener.accept().await.unwrap();
            let mut bytes = Vec::new();
            loop {
                let mut buf = [0; 4096];
                let n = socket.read(&mut buf).await.unwrap();
                if n == 0 {
                    break;
                }
                bytes.extend(&buf[..n]);
                if bytes.windows(4).any(|w| w == b"\r\n\r\n") {
                    break;
                }
            }
            let request = String::from_utf8_lossy(&bytes);
            let result = if request.starts_with("POST /auth/user/refresh_token ") {
                counter.fetch_add(1, Ordering::SeqCst);
                tokio::time::sleep(Duration::from_millis(30)).await;
                serde_json::json!({"access_token":response_token})
            } else if request.starts_with("POST /auth/client-devices/exchange ") {
                serde_json::json!({"access_token":exchange_token})
            } else {
                serde_json::json!({"id":7})
            };
            assert!(request.to_lowercase().contains("security: true"));
            assert!(request.to_lowercase().contains("x-kx-device-signature:"));
            let body = kx_ed::KxEd::en(
                &serde_json::to_vec(&serde_json::json!({"code":200,"result":result})).unwrap(),
            )
            .await
            .unwrap();
            socket.write_all(format!("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",body.len()).as_bytes()).await.unwrap();
            socket.write_all(&body).await.unwrap();
        }
    });
    let dir = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
    let d = Desktop::new(dir.clone())?;
    let events = Events::default();
    d.configure(&events, base.clone()).await?;
    d.import(&events, old.clone()).await?;
    let (a, b) = tokio::join!(
        d.refresh(&events, Some(old.clone())),
        d.refresh(&events, Some(old.clone()))
    );
    assert_eq!(a?.token, next);
    assert_eq!(b?.token, next);
    assert_eq!(calls.load(Ordering::SeqCst), 1);
    assert_eq!(
        events
            .0
            .lock()
            .unwrap()
            .last()
            .unwrap()
            .as_ref()
            .unwrap()
            .token,
        next
    );
    assert!(
        Desktop::new(dir.clone())?
            .bootstrap()
            .await?
            .session
            .is_none()
    );
    let identity = d.identity().await?;
    assert!(
        d.api(
            &events,
            &Session {
                uid: "8".into(),
                ..identity.clone()
            },
            reqwest::Method::GET,
            "/test",
            None
        )
        .await
        .is_err()
    );
    assert!(
        d.api(
            &events,
            &Session {
                api_base: "https://other.test".into(),
                ..identity.clone()
            },
            reqwest::Method::GET,
            "/test",
            None
        )
        .await
        .is_err()
    );
    d.queue.lock().await.push(serde_json::from_value(serde_json::json!({
        "id":"paused-on-logout", "apiBase":base, "uid":"7", "res":"1", "version":"2", "storage":"media", "localStorage":false, "root":dir, "name":"剧", "status":"上传中", "error":"", "items":[], "importId":null
    }))?);
    let (refreshed, cleared) = tokio::join!(d.refresh(&events, Some(next)), d.clear(&events));
    refreshed?;
    cleared?;
    assert!(d.identity().await.is_err());
    assert_eq!(d.queue.lock().await[0].status, "暂停中");
    assert!(events.0.lock().unwrap().last().unwrap().is_none());
    assert!(d.refresh(&events, Some(old.clone())).await.is_err());
    assert!(!std::fs::read_to_string(dir.join("server.txt"))?.contains("header."));
    let restarted = Desktop::new(dir.clone())?;
    let snapshot = restarted.bootstrap().await?;
    assert!(snapshot.session.is_none());
    assert!(
        restarted
            .restore(
                &events,
                old.clone(),
                "https://other.test".into(),
                snapshot.generation
            )
            .await
            .is_err()
    );
    let restored = restarted
        .restore(
            &events,
            old.clone(),
            snapshot.api_base.clone(),
            snapshot.generation,
        )
        .await?;
    assert_eq!(restored.uid, "7");
    assert!(restored.expires_at > now());
    assert_ne!(restored.token, old);
    restarted.clear(&events).await?;
    assert!(
        restarted
            .restore(&events, old, snapshot.api_base, snapshot.generation)
            .await
            .is_err()
    );
    server.abort();
    std::fs::remove_dir_all(dir)?;
    Ok(())
}

#[tokio::test]
async fn revoked_device_heartbeat_clears_session_and_pauses_queues() -> Result<()> {
    let listener = TcpListener::bind("127.0.0.1:0").await?;
    let base = format!("http://{}", listener.local_addr()?);
    let server = tokio::spawn(async move {
        for path in ["/auth/client-devices/session", "/auth/user/refresh_token"] {
            let (mut socket, _) = listener.accept().await.unwrap();
            let mut bytes = [0; 8192];
            let n = socket.read(&mut bytes).await.unwrap();
            let request = String::from_utf8_lossy(&bytes[..n]);
            assert!(request.contains(path));
            assert!(request.to_lowercase().contains("x-kx-device-signature:"));
            socket
                .write_all(
                    b"HTTP/1.1 401 Unauthorized\r\nContent-Length: 0\r\nConnection: close\r\n\r\n",
                )
                .await
                .unwrap();
        }
    });
    let dir = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
    let d = Desktop::new(dir.clone())?;
    let events = Events::default();
    d.configure(&events, base.clone()).await?;
    let mut auth = d.auth.lock().await;
    let session = token_session(
        token(7, now() + 3600, "bound"),
        base.clone(),
        auth.generation + 1,
    )?;
    d.save(&events, &mut auth, session).await?;
    drop(auth);
    d.queue.lock().await.push(serde_json::from_value(serde_json::json!({
        "id":"revoked-upload","apiBase":base,"uid":"7","res":"1","version":"2","storage":"media","localStorage":false,"root":dir,"name":"剧","status":"上传中","error":"","items":[],"importId":null
    }))?);
    d.tick(&events).await;
    assert!(d.identity().await.is_err());
    assert_eq!(d.queue.lock().await[0].status, "暂停中");
    assert!(events.0.lock().unwrap().last().unwrap().is_none());
    server.await?;
    std::fs::remove_dir_all(dir)?;
    Ok(())
}
