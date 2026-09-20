use super::*;
struct Temp(PathBuf);
impl Temp {
    fn new() -> Self {
        let path = std::env::temp_dir().join(format!("kx-tiktok-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&path).unwrap();
        Self(path)
    }
}
impl Drop for Temp {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}
fn selection(root: &Path) -> Selection {
    std::fs::write(root.join("episode10.mp4"), b"video10").unwrap();
    std::fs::write(root.join("episode2.MOV"), b"video2").unwrap();
    std::fs::write(root.join("cover.jpg"), b"cover").unwrap();
    Selection {
        owner_key: None,
        version: 2,
        root: root.canonicalize().unwrap(),
        view: DirectorySelection {
            revision: 1,
            name: "test".into(),
            account: Some(account()),
            files: scan(root)
                .unwrap()
                .into_iter()
                .map(|mut f| {
                    f.schedule = Some(schedule());
                    f
                })
                .collect(),
        },
    }
}
#[tokio::test]
async fn restart_never_repeats_submitted_appointments() -> Result<()> {
    let dir = Temp::new();
    let mut s = selection(&dir.0);
    s.view.files[0].status = "scheduled".into();
    s.view.files[0].item_id = Some("1234567890123456789".into());
    s.view.files[1].status = "scheduling".into();
    persist(&dir.0, &s)?;
    let state = TikTok::new(dir.0.clone())?;
    let restored = state.list().await.unwrap();
    assert_eq!(restored.files[0].status, "scheduled");
    assert_eq!(restored.files[1].status, "review");
    assert!(validate_start(&restored, &[restored.files[1].id.clone()], 1).is_err());
    assert!(
        state
            .reconcile(&restored.files[1].id, 1, Some("invalid".into()))
            .await
            .is_err()
    );
    state
        .reconcile(&restored.files[1].id, 1, Some("1234567890123456788".into()))
        .await?;
    assert!(
        TikTok::new(dir.0.clone())?
            .list()
            .await
            .unwrap()
            .files
            .iter()
            .all(|f| f.status == "scheduled")
    );
    Ok(())
}
#[test]
fn interrupted_upload_can_retry_but_legacy_draft_is_not_scheduled() {
    let dir = Temp::new();
    let mut s = selection(&dir.0);
    s.view.files[0].status = "uploading".into();
    s.view.files[1].status = "saved".into();
    recover(&mut s);
    assert_eq!(s.view.files[0].status, "failed");
    assert_eq!(s.view.files[1].status, "legacy_draft");
    s.version = 0;
    s.view.files[0].status = "uploading".into();
    recover(&mut s);
    assert_eq!(s.view.files[0].status, "review");
}
#[test]
fn rejects_duplicate_unknown_stale_or_completed_selections() {
    let dir = Temp::new();
    let mut s = selection(&dir.0);
    let id = s.view.files[0].id.clone();
    assert!(validate_start(&s.view, &[id.clone(), id.clone()], 1).is_err());
    assert!(validate_start(&s.view, &["unknown".into()], 1).is_err());
    assert!(validate_start(&s.view, std::slice::from_ref(&id), 0).is_err());
    assert_eq!(
        validate_start(&s.view, std::slice::from_ref(&id), 1)
            .unwrap()
            .len(),
        1
    );
    s.view.files[0].status = "scheduled".into();
    assert!(validate_start(&s.view, &[id], 1).is_err());
}
fn account() -> Account {
    Account {
        uid: "7".into(),
        nickname: "test".into(),
        timezone: "Asia/Shanghai".into(),
        min_delay_seconds: 900,
        max_delay_seconds: 864000,
        private_account: false,
    }
}
fn schedule() -> model::Schedule {
    model::Schedule {
        caption: "视频标题".into(),
        scheduled_at: (now() / 300 + 24) * 300,
        visibility: 0,
        allow_comment: true,
        copyright_check: false,
        content_check: false,
    }
}
#[test]
fn validates_schedule_boundaries_and_preserves_plan_on_error() {
    let mut planned = schedule();
    let current = account();
    planned.scheduled_at = 900;
    assert!(planned.validate(0, &current).is_ok());
    assert!(planned.validate(1, &current).is_err());
    planned.scheduled_at = 864300;
    assert!(planned.validate(0, &current).is_err());
    planned.scheduled_at = 901;
    assert!(planned.validate(0, &current).is_err());
    planned.scheduled_at = 900;
    planned.visibility = 1;
    assert!(planned.validate(0, &current).is_err());
    let dir = Temp::new();
    let mut s = selection(&dir.0);
    let original = serde_json::to_value(&s).unwrap();
    let edit = PlanEdit {
        expected_revision: 1,
        account_id: "7".into(),
        items: vec![
            model::PlanItem {
                id: s.view.files[0].id.clone(),
                schedule: schedule(),
            },
            model::PlanItem {
                id: s.view.files[1].id.clone(),
                schedule: planned,
            },
        ],
    };
    assert!(apply_plan(&mut s, edit, current, now()).is_err());
    assert_eq!(serde_json::to_value(&s).unwrap(), original);
}
#[test]
fn publishes_exact_utc_seconds_and_video_reference() -> Result<()> {
    let dir = Temp::new();
    let mut s = selection(&dir.0);
    let file = &mut s.view.files[0];
    file.media = Some(model::Media {
        vid: "v-test".into(),
        duration: 5.0,
        width: 720,
        height: 1280,
    });
    let body = publish_body(file)?;
    // 官网 45612 模块：unknown=0、webapp=1、creator_center=2、other=8。
    assert_eq!(
        body["post_common_info"]["enter_post_page_from"].as_u64(),
        Some(8)
    );
    assert_eq!(
        body["feature_common_info_list"][0]["schedule_time"],
        file.schedule.as_ref().unwrap().scheduled_at
    );
    assert_eq!(body["single_post_req_list"][0]["video_id"], "v-test");
    assert_eq!(body["post_common_info"]["creation_id"], file.creation_id);
    assert_eq!(body["single_post_req_list"][0]["batch_index"], 0);
    assert!(body.get("token").is_none());
    file.schedule.as_mut().unwrap().caption = "A & B\n<demo>".into();
    assert_eq!(
        publish_body(file)?["single_post_req_list"][0]["single_post_feature_info"]["markup_text"],
        "A &amp; B<br>&lt;demo&gt;"
    );
    Ok(())
}
#[tokio::test]
async fn missing_receipt_cannot_become_success_and_rejections_keep_media() -> Result<()> {
    let dir = Temp::new();
    let mut s = selection(&dir.0);
    let id = s.view.files[0].id.clone();
    s.view.files[0].status = "scheduling".into();
    s.view.files[0].media = Some(model::Media {
        vid: "v-test".into(),
        duration: 5.0,
        width: 720,
        height: 1280,
    });
    persist(&dir.0, &s)?;
    let state = TikTok::new(dir.0.clone())?;
    assert!(
        execute::test_apply_receipt(&state, &id, json!({"disposition":"scheduled"}))
            .await
            .is_err()
    );
    assert_eq!(state.list().await.unwrap().files[0].status, "review");
    assert!(
        execute::test_apply_receipt(
            &state,
            &id,
            json!({"disposition":"rejected","message":"time invalid"})
        )
        .await
        .is_err()
    );
    assert_eq!(state.list().await.unwrap().files[0].status, "failed");
    assert!(state.list().await.unwrap().files[0].media.is_some());
    execute::test_apply_receipt(
        &state,
        &id,
        json!({"disposition":"scheduled","itemId":"1234567890123456789"}),
    )
    .await?;
    assert_eq!(
        state.list().await.unwrap().files[0].item_id.as_deref(),
        Some("1234567890123456789")
    );
    Ok(())
}
#[tokio::test]
async fn source_changes_and_traversal_are_rejected() -> Result<()> {
    let dir = Temp::new();
    let s = selection(&dir.0);
    assert_eq!(s.view.files[0].name, "episode2.MOV");
    assert_eq!(s.view.files.len(), 2);
    let file = &s.view.files[0];
    open_video(&s.root, file).await?;
    std::fs::write(s.root.join(&file.relative), b"changed-video")?;
    assert!(open_video(&s.root, file).await.is_err());
    let mut file = file.clone();
    file.relative = "../secret.mp4".into();
    assert!(open_video(&s.root, &file).await.is_err());
    Ok(())
}
#[cfg(unix)]
#[tokio::test]
async fn scan_skips_symlinks_and_replacement_link_cannot_be_uploaded() -> Result<()> {
    let dir = Temp::new();
    let outside = Temp::new();
    let s = selection(&dir.0);
    let external = outside.0.join("secret.mp4");
    std::fs::write(&external, b"secret")?;
    let source = dir.0.join(&s.view.files[0].relative);
    std::fs::remove_file(&source)?;
    std::os::unix::fs::symlink(external, source)?;
    assert_eq!(scan(&dir.0)?.len(), 1);
    assert!(open_video(&s.root, &s.view.files[0]).await.is_err());
    Ok(())
}
#[tokio::test]
async fn execution_lock_revision_and_failed_write_preserve_state() -> Result<()> {
    let dir = Temp::new();
    let s = selection(&dir.0);
    persist(&dir.0, &s)?;
    let state = TikTok::new(dir.0.clone())?;
    let guard = state.gate.lock().await;
    assert!(state.remove(1).await.is_err());
    drop(guard);
    assert!(state.remove(0).await.is_err());
    std::fs::create_dir(dir.0.join("tiktok-queue.tmp"))?;
    assert!(
        state
            .update(&s.view.files[0].id, "saved", "", 0)
            .await
            .is_err()
    );
    assert_eq!(state.list().await.unwrap().files[0].status, "pending");
    assert_eq!(state.list().await.unwrap().revision, 1);
    Ok(())
}

#[test]
fn project_payload_matches_sanitized_browser_capture() -> Result<()> {
    let dir = Temp::new();
    let mut selection = selection(&dir.0);
    let file = &mut selection.view.files[0];
    file.creation_id = "fixture-creation".into();
    file.media = Some(model::Media {
        vid: "fixture-video".into(),
        duration: 5.0,
        width: 720,
        height: 1280,
    });
    let schedule = file.schedule.as_mut().unwrap();
    schedule.caption = "fixture caption".into();
    schedule.scheduled_at = 1_800_000_000;
    let actual = publish_body(file)?;
    let mut observed: Value =
        serde_json::from_str(include_str!("fixtures/web-project-schedule.json"))?;
    // HAR 源自 creator_center；原生入口用 other，关闭复用/AI remix。
    // fixture 已移除可选网页封面、检测结果，替换真实标识和时间。
    observed["post_common_info"]["enter_post_page_from"] = json!(8);
    let privacy = &mut observed["feature_common_info_list"][0]["privacy_setting_info"];
    privacy["allow_duet"] = json!(0);
    privacy["allow_stitch"] = json!(0);
    privacy["allow_content_reuse"] = json!(0);
    privacy["allow_ai_remix"] = json!(2);
    assert_eq!(actual, observed);
    for (duration, long) in [(60.0, 0), (60.001, 1), (76.36, 1)] {
        file.media.as_mut().unwrap().duration = duration;
        assert_eq!(
            publish_body(file)?["single_post_req_list"][0]["is_long_video"],
            long
        );
    }
    Ok(())
}
#[test]
fn existing_plans_disable_optional_checks_and_interrupted_checks_are_retryable() -> Result<()> {
    let plan: model::Schedule = serde_json::from_value(
        json!({"caption":"fixture","scheduledAt":1800000000,"visibility":0,"allowComment":true}),
    )?;
    assert!(!plan.copyright_check && !plan.content_check);
    let dir = Temp::new();
    let mut selection = selection(&dir.0);
    selection.version = 2;
    selection.view.files[0].status = "checking".into();
    assert!(active("checking"));
    recover(&mut selection);
    assert_eq!(selection.view.files[0].status, "failed");
    Ok(())
}

#[tokio::test]
async fn account_switch_restores_isolated_queues_and_removed_queue_does_not_return() -> Result<()> {
    let dir = Temp::new();
    let mut a = selection(&dir.0);
    a.view.account = Some(account());
    persist(&dir.0, &a)?;
    let state = TikTok::new(dir.0.clone())?;
    let mut first_other = account();
    first_other.uid = "99".into();
    state
        .activate_account(&first_other, "backend:user7")
        .await?;
    assert!(state.list().await.is_none());
    state.activate_account(&account(), "backend:user7").await?;
    let original = state.list().await.unwrap();
    let mut b_account = account();
    b_account.uid = "8".into();
    state.activate_account(&b_account, "backend:user7").await?;
    assert!(state.list().await.is_none());
    let mut b = a.clone();
    b.owner_key = Some("backend:user7".into());
    b.view.account = Some(b_account.clone());
    b.view.name = "B目录".into();
    persist(&dir.0, &b)?;
    *state.selection.lock().await = Some(b);
    state.activate_account(&account(), "backend:user7").await?;
    assert_eq!(
        state.list().await.unwrap().files[0].id,
        original.files[0].id
    );
    state.activate_account(&account(), "backend:user9").await?;
    assert!(
        state.list().await.is_none(),
        "同一TikTok UID不能串用另一KX用户队列"
    );
    state.activate_account(&account(), "backend:user7").await?;
    let current = state.list().await.unwrap();
    state.remove(current.revision).await?;
    state.activate_account(&b_account, "backend:user7").await?;
    assert_eq!(state.list().await.unwrap().name, "B目录");
    state.activate_account(&account(), "backend:user7").await?;
    assert!(state.list().await.is_none());
    let restarted = TikTok::new(dir.0.clone())?;
    restarted
        .activate_account(&b_account, "backend:user7")
        .await?;
    assert_eq!(restarted.list().await.unwrap().name, "B目录");
    Ok(())
}

#[tokio::test]
async fn preview_only_accepts_current_account_files_and_current_fingerprint() -> Result<()> {
    let dir = Temp::new();
    let selection = selection(&dir.0);
    let file = selection.view.files[0].clone();
    persist(&dir.0, &selection)?;
    let state = TikTok::new(dir.0.clone())?;
    assert!(state.preview_path(&file.id, 1).await.is_err());
    *state.auth.lock().await = Some(Login {
        owner_key: Some("backend:user7".into()),
        account: account(),
        cookie: "fixture".into(),
        user_agent: "fixture".into(),
    });
    assert_eq!(
        state.preview_path(&file.id, 1).await?,
        dir.0.canonicalize()?.join(&file.relative)
    );
    assert!(state.preview_path("../outside", 1).await.is_err());
    assert!(state.preview_path(&file.id, 0).await.is_err());
    state.auth.lock().await.as_mut().unwrap().account.uid = "8".into();
    assert!(state.preview_path(&file.id, 1).await.is_err());
    state.auth.lock().await.as_mut().unwrap().account.uid = "7".into();
    std::fs::write(dir.0.join(&file.relative), b"replaced-video")?;
    assert!(state.preview_path(&file.id, 1).await.is_err());
    Ok(())
}
