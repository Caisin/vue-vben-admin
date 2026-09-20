use super::*;
use std::sync::Mutex as StdMutex;
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::TcpListener,
};
#[derive(Clone)]
struct Request {
    target: String,
    headers: std::collections::BTreeMap<String, String>,
    body: Vec<u8>,
    parallel: usize,
}
struct Temp(PathBuf);
impl Temp {
    fn new() -> Self {
        let p = std::env::temp_dir().join(format!("kx-native-tiktok-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&p).unwrap();
        Self(p.canonicalize().unwrap())
    }
}
impl Drop for Temp {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}
fn account() -> Account {
    Account {
        uid: "7".into(),
        nickname: "fixture".into(),
        timezone: "Asia/Shanghai".into(),
        min_delay_seconds: 900,
        max_delay_seconds: 864000,
        private_account: false,
    }
}
fn login() -> Login {
    Login {
        owner_key: None,
        account: account(),
        cookie: "sessionid=fixture-a; sessionid=fixture-b".into(),
        user_agent: "fixture-agent".into(),
    }
}
fn fixture(size: usize) -> Result<(Temp, Arc<TikTok>, VideoFile)> {
    let dir = Temp::new();
    std::fs::write(dir.0.join("video.mp4"), vec![0x5a; size])?;
    let mut file = scan(&dir.0)?.remove(0);
    file.schedule = Some(model::Schedule {
        caption: "测试预约".into(),
        scheduled_at: (now() / 300 + 24) * 300,
        visibility: 0,
        allow_comment: true,
        copyright_check: false,
        content_check: false,
    });
    let selection = Selection {
        owner_key: None,
        version: 2,
        root: dir.0.clone(),
        view: DirectorySelection {
            revision: 1,
            name: "fixture".into(),
            files: vec![file.clone()],
            account: Some(account()),
        },
    };
    persist(&dir.0, &selection)?;
    let state = TikTok::new(dir.0.clone())?;
    Ok((dir, state, file))
}
async fn mock_server(
    reject_part: bool,
    change_account: bool,
) -> Result<(
    Url,
    Arc<StdMutex<Vec<Request>>>,
    tokio::task::JoinHandle<()>,
)> {
    mock_server_with_checks(reject_part, change_account, false).await
}
async fn mock_server_with_checks(
    reject_part: bool,
    change_account: bool,
    reject_check: bool,
) -> Result<(
    Url,
    Arc<StdMutex<Vec<Request>>>,
    tokio::task::JoinHandle<()>,
)> {
    let listener = TcpListener::bind("127.0.0.1:0").await?;
    let base = format!("http://{}", listener.local_addr()?);
    let records = Arc::new(StdMutex::new(Vec::new()));
    let observed = records.clone();
    let host = base.clone();
    let server = tokio::spawn(async move {
        let profiles = Arc::new(std::sync::atomic::AtomicUsize::new(0));
        let polls = Arc::new(std::sync::atomic::AtomicUsize::new(0));
        let transfers = Arc::new(std::sync::atomic::AtomicUsize::new(0));
        loop {
            let (mut socket, _) = listener.accept().await.unwrap();
            let (profiles, polls, transfers) = (profiles.clone(), polls.clone(), transfers.clone());
            let host = host.clone();
            let observed = observed.clone();
            tokio::spawn(async move {
                let mut bytes = Vec::new();
                let header_end = loop {
                    let mut buffer = [0; 8192];
                    let n = socket.read(&mut buffer).await.unwrap();
                    if n == 0 {
                        return;
                    }
                    bytes.extend_from_slice(&buffer[..n]);
                    if let Some(end) = bytes.windows(4).position(|v| v == b"\r\n\r\n") {
                        break end + 4;
                    }
                };
                let text = String::from_utf8_lossy(&bytes[..header_end]);
                let target = text
                    .lines()
                    .next()
                    .unwrap()
                    .split_whitespace()
                    .nth(1)
                    .unwrap()
                    .to_owned();
                let headers: std::collections::BTreeMap<_, _> = text
                    .lines()
                    .skip(1)
                    .filter_map(|line| line.split_once(':'))
                    .map(|(key, value)| (key.to_ascii_lowercase(), value.trim().to_owned()))
                    .collect();
                let length = headers
                    .get("content-length")
                    .and_then(|v| v.parse::<usize>().ok())
                    .unwrap_or(0);
                while bytes.len() - header_end < length {
                    let mut buffer = vec![0; 65536];
                    let n = socket.read(&mut buffer).await.unwrap();
                    assert!(n > 0);
                    bytes.extend_from_slice(&buffer[..n]);
                }
                let mut request = Request {
                    parallel: 0,
                    target: target.clone(),
                    headers,
                    body: bytes[header_end..header_end + length].to_vec(),
                };
                let url = Url::parse(&format!("{host}{target}")).unwrap();
                let query: std::collections::HashMap<_, _> = url
                    .query_pairs()
                    .map(|(k, v)| (k.into_owned(), v.into_owned()))
                    .collect();
                let response = match url.path() {
                    api::PROFILE => {
                        let profiles = profiles.fetch_add(1, Ordering::SeqCst) + 1;
                        json!({"status_code":0,"user":{"uid":if change_account&&profiles>1{"8"}else{"7"},"nickname":"fixture"}})
                    }
                    "/node-webapp/api/common-app-context" => {
                        json!({"statusCode":0,"clusterRegion":"TTP","csrfToken":"csrf-fixture","wid":"web-device"})
                    }
                    api::UPLOAD_AUTH => {
                        json!({"status_code":0,"video_token_v5":{"access_key_id":"fixture-key","secret_acess_key":"fixture-secret","session_token":"fixture-session"}})
                    }
                    "/top/v1" if query.get("Action").is_some_and(|v| v == "ApplyUploadInner") => {
                        json!({"ResponseMetadata":{},"Result":{"InnerUploadAddress":{"UploadNodes":[{"UploadHost":host,"SessionKey":"fixture-vod-session","StoreInfos":[{"StoreUri":"fixture/video","Auth":"fixture-object-auth"}],"UploadHeader":{"X-Storage-Mode":"gateway"}}]}}})
                    }
                    "/top/v1" => {
                        json!({"ResponseMetadata":{},"Result":{"Results":[{"Vid":"v-uploaded","VideoMeta":{"Duration":5.0,"Width":720,"Height":1280}}]}})
                    }
                    "/upload/v1/fixture/video"
                        if query.get("phase").is_some_and(|v| v == "init") =>
                    {
                        json!({"code":2000,"data":{"uploadid":"upload-1"}})
                    }
                    "/upload/v1/fixture/video"
                        if request
                            .headers
                            .get("x-phase")
                            .is_some_and(|v| v == "transfer") =>
                    {
                        request.parallel = transfers.fetch_add(1, Ordering::SeqCst) + 1;
                        tokio::time::sleep(Duration::from_millis(30)).await;
                        transfers.fetch_sub(1, Ordering::SeqCst);
                        if reject_part {
                            json!({"code":4000})
                        } else {
                            json!({"code":2000,"data":{"crc32":format!("{:08x}",crc32fast::hash(&request.body))}})
                        }
                    }
                    "/upload/v1/fixture/video" => json!({"code":2000}),
                    checks::COPYRIGHT => json!({"status_code":0,"copyright_detection_result":1}),
                    checks::CONTENT_CREATE => {
                        json!({"status_code":0,"check_ids":{"CONTENT_CHECK_TASK_LITE":"fixture-check"}})
                    }
                    checks::CONTENT_RESULT => {
                        assert_eq!(query.get("video_id").unwrap(), "v-uploaded");
                        assert_eq!(
                            serde_json::from_str::<Value>(&query["queries"]).unwrap(),
                            json!([{"task":0,"check_id":"fixture-check"}])
                        );
                        let polls = polls.fetch_add(1, Ordering::SeqCst) + 1;
                        if polls == 1 {
                            json!({"status_code":0,"check_status":{"fixture-check":1}})
                        } else {
                            json!({"status_code":0,"check_status":{"fixture-check":2},"check_result":{"fixture-check":{"model_check_results":[{"model_type":0,"model_check_result":u8::from(reject_check)}]}}})
                        }
                    }
                    "/tiktok/web/project/post/v1/" => {
                        let body: Value = serde_json::from_slice(&request.body).unwrap();
                        if body["post_common_info"]["enter_post_page_from"].as_u64() != Some(8)
                            || body["post_common_info"]["post_type"] != 3
                            || body["feature_common_info_list"][0]["vedit_common_info"]["video_id"]
                                != "v-uploaded"
                        {
                            json!({"status_code":5,"status_msg":"enter_post_page_from must be an integer enum"})
                        } else {
                            json!({"status_code":0,"single_post_resp_list":[{"batch_index":0,"status_code":0,"item_id":"7000000000000000001"}]})
                        }
                    }
                    _ => panic!("unexpected fixture request path"),
                };
                observed.lock().unwrap().push(request);
                let body = serde_json::to_vec(&response).unwrap();
                socket
                    .write_all(
                        format!(
                            "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                            body.len()
                        )
                        .as_bytes(),
                    )
                    .await
                    .unwrap();
                socket.write_all(&body).await.unwrap();
            });
        }
    });
    Ok((Url::parse(&format!("{base}/"))?, records, server))
}
#[tokio::test]
async fn native_http_uploads_chunks_signs_vod_and_schedules_without_cookie_leakage() -> Result<()> {
    let (dir, state, mut file) = fixture(PART_SIZE + 3)?;
    let (base, records, server) = mock_server(false, false).await?;
    let api = Api::for_test(login(), base)?;
    state.execute(&api, &dir.0, &mut file, &account()).await?;
    let rows = records.lock().unwrap().clone();
    server.abort();
    let parts: Vec<_> = rows
        .iter()
        .filter(|r| r.headers.get("x-phase").is_some_and(|v| v == "transfer"))
        .collect();
    assert_eq!(parts.len(), 2);
    assert_eq!(parts[0].body.len(), PART_SIZE);
    assert_eq!(parts[1].body.len(), 3);
    assert_eq!(parts[0].headers["x-part-offset"], "0");
    assert_eq!(parts[1].headers["x-part-offset"], PART_SIZE.to_string());
    let mut crc = Vec::new();
    for (index, part) in parts.iter().enumerate() {
        let expected = format!("{:08x}", crc32fast::hash(&part.body));
        assert_eq!(part.headers["content-crc32"], expected);
        crc.push(format!("{}:{expected}", index + 1));
        assert_eq!(part.headers["authorization"], "fixture-object-auth");
        assert!(!part.headers.contains_key("cookie"));
        assert!(!part.headers.contains_key("x-amz-security-token"));
    }
    let finish = rows
        .iter()
        .find(|r| r.headers.get("x-phase").is_some_and(|v| v == "finish"))
        .unwrap();
    assert_eq!(finish.body, crc.join(",").as_bytes());
    for row in rows.iter().filter(|r| r.target.starts_with("/top/v1")) {
        assert!(row.headers["authorization"].contains("/US-TTP/vod/aws4_request"));
        assert_eq!(
            row.headers["cookie"],
            "sessionid=fixture-a; sessionid=fixture-b"
        );
        assert!(!row.headers["authorization"].contains("fixture-secret"));
    }
    let post = rows
        .iter()
        .find(|r| r.target.starts_with(api::PUBLISH))
        .unwrap();
    assert_eq!(post.headers["tt-csrf-token"], "csrf-fixture");
    let body: Value = serde_json::from_slice(&post.body)?;
    assert_eq!(body["single_post_req_list"][0]["video_id"], "v-uploaded");
    assert_eq!(
        body["feature_common_info_list"][0]["schedule_time"],
        file.schedule.as_ref().unwrap().scheduled_at
    );
    assert!(!post.headers.contains_key("authorization"));
    assert!(!rows.iter().any(|r| r.target.contains("/check")));
    assert!(
        body["feature_common_info_list"][0]
            .get("music_copyright")
            .is_none()
    );
    assert!(
        body["feature_common_info_list"][0]
            .get("content_check_id")
            .is_none()
    );
    let row = &state.list().await.unwrap().files[0];
    assert_eq!(row.status, "scheduled");
    assert_eq!(row.item_id.as_deref(), Some("7000000000000000001"));
    let saved = std::fs::read_to_string(dir.0.join("tiktok-queue.json"))?;
    for secret in [
        "fixture-secret",
        "fixture-session",
        "fixture-a",
        "csrf-fixture",
        "fixture-object-auth",
    ] {
        assert!(!saved.contains(secret));
    }
    Ok(())
}
#[tokio::test]
async fn chunk_failure_and_account_change_never_submit_publication() -> Result<()> {
    for (reject, changed) in [(true, false), (false, true)] {
        let (dir, state, mut file) = fixture(10)?;
        let (base, records, server) = mock_server(reject, changed).await?;
        let api = Api::for_test(login(), base)?;
        let error = state
            .execute(&api, &dir.0, &mut file, &account())
            .await
            .unwrap_err()
            .to_string();
        assert!(
            error.contains(if reject {
                "状态码 4000"
            } else {
                "Cookie 账号发生变化"
            }),
            "{error}"
        );
        assert!(
            !records
                .lock()
                .unwrap()
                .iter()
                .any(|r| r.target.starts_with(api::PUBLISH))
        );
        server.abort();
    }
    Ok(())
}
#[test]
fn upload_destination_must_be_a_tiktok_domain() -> Result<()> {
    let api = Api::new(login())?;
    assert!(upload_host("tos-useast5.tiktokd.org", &api).is_ok());
    for host in [
        "https://evil.test/",
        "https://tiktokcdn.com.evil.test/",
        "http://tiktokcdn.com/",
        "https://user:pass@tiktokcdn.com/",
        "https://127.0.0.1/",
        "https://tiktokcdn.com/path",
    ] {
        assert!(upload_host(host, &api).is_err());
    }
    Ok(())
}

#[tokio::test]
async fn enabled_checks_must_complete_before_post_and_findings_prevent_post() -> Result<()> {
    for reject in [false, true] {
        let (dir, state, mut file) = fixture(10)?;
        file.schedule.as_mut().unwrap().copyright_check = true;
        file.schedule.as_mut().unwrap().content_check = true;
        let (base, records, server) = mock_server_with_checks(false, false, reject).await?;
        let api = Api::for_test(login(), base)?;
        let result = state.execute(&api, &dir.0, &mut file, &account()).await;
        server.abort();
        let rows = records.lock().unwrap().clone();
        let polls: Vec<_> = rows
            .iter()
            .enumerate()
            .filter(|(_, r)| {
                r.target
                    .starts_with(&format!("{}?", checks::CONTENT_RESULT))
            })
            .collect();
        assert_eq!(polls.len(), 2);
        let post = rows.iter().position(|r| r.target.starts_with(api::PUBLISH));
        if reject {
            assert!(result.unwrap_err().to_string().contains("内容检测未通过"));
            assert!(post.is_none());
        } else {
            result?;
            assert!(post.unwrap() > polls[1].0);
            let body: Value = serde_json::from_slice(&rows[post.unwrap()].body)?;
            assert_eq!(
                body["feature_common_info_list"][0]["music_copyright"]["result"],
                1
            );
        }
    }
    Ok(())
}

#[tokio::test]
async fn tk_pool_uploads_multiple_files_with_a_bounded_parallel_limit() -> Result<()> {
    let (dir, state, first) = fixture(10)?;
    let mut files = Vec::new();
    for _ in 0..5 {
        let mut file = first.clone();
        file.id = uuid::Uuid::new_v4().to_string();
        file.creation_id = uuid::Uuid::new_v4().to_string();
        files.push(file);
    }
    state.selection.lock().await.as_mut().unwrap().view.files = files.clone();
    let (base, records, server) = mock_server(false, false).await?;
    let api = Api::for_test(login(), base)?;
    state
        .run_batch(api, dir.0.clone(), files, account(), 2)
        .await?;
    server.abort();
    let rows = records.lock().unwrap().clone();
    assert_eq!(rows.iter().map(|r| r.parallel).max(), Some(2));
    assert_eq!(
        rows.iter()
            .filter(|r| r.target.starts_with(api::PUBLISH))
            .count(),
        5
    );
    drop(rows);
    let saved = state.list().await.unwrap();
    assert!(saved.files.iter().all(|f| f.status == "scheduled"));
    assert_eq!(saved.files.len(), 5);
    Ok(())
}
