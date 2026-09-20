use super::*;

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Account {
    pub uid: String,
    pub nickname: String,
    pub timezone: String,
    pub min_delay_seconds: i64,
    pub max_delay_seconds: i64,
    pub private_account: bool,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Schedule {
    pub caption: String,
    pub scheduled_at: i64,
    pub visibility: u8,
    pub allow_comment: bool,
    #[serde(default)]
    pub copyright_check: bool,
    #[serde(default)]
    pub content_check: bool,
}
impl Schedule {
    pub fn validate(&self, now: i64, account: &Account) -> Result<()> {
        ensure!(
            !self.caption.trim().is_empty() && self.caption.chars().count() <= 4000,
            "标题须为 1 至 4000 字"
        );
        ensure!(
            matches!(self.visibility, 0 | 2),
            "预约可见范围须为公开或朋友"
        );
        ensure!(self.scheduled_at % 300 == 0, "预约时间须按 5 分钟对齐");
        let delay = self.scheduled_at.checked_sub(now).context("预约时间无效")?;
        ensure!(
            delay >= account.min_delay_seconds.max(900),
            "预约时间不足 15 分钟，请重新安排"
        );
        ensure!(
            delay <= account.max_delay_seconds.min(30 * 86400),
            "预约时间超出当前账号允许范围"
        );
        Ok(())
    }
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Media {
    pub vid: String,
    pub duration: f64,
    pub width: u32,
    pub height: u32,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoFile {
    pub id: String,
    pub name: String,
    pub relative: String,
    pub size: u64,
    pub status: String,
    pub message: String,
    pub bytes: u64,
    #[serde(default)]
    pub upload_percent: u8,
    #[serde(default)]
    pub schedule: Option<Schedule>,
    #[serde(default)]
    pub media: Option<Media>,
    #[serde(default)]
    pub item_id: Option<String>,
    #[serde(default)]
    pub creation_id: String,
    #[serde(default)]
    pub receipt: Option<Value>,
    pub(super) modified: Option<SystemTime>,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectorySelection {
    pub revision: u64,
    pub name: String,
    pub files: Vec<VideoFile>,
    #[serde(default)]
    pub account: Option<Account>,
}
#[derive(Clone, Serialize, Deserialize)]
pub(super) struct Selection {
    #[serde(default)]
    pub owner_key: Option<String>,
    #[serde(default)]
    pub version: u32,
    pub root: PathBuf,
    pub view: DirectorySelection,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PlanEdit {
    pub expected_revision: u64,
    pub account_id: String,
    pub items: Vec<PlanItem>,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PlanItem {
    pub id: String,
    pub schedule: Schedule,
}
pub(super) fn now() -> i64 {
    crate::session::now()
}
pub(super) fn active(status: &str) -> bool {
    matches!(
        status,
        "transferring" | "uploading" | "checking" | "scheduling"
    )
}
pub(super) fn retryable(status: &str) -> bool {
    matches!(status, "pending" | "failed" | "ready")
}
pub(super) fn recover(selection: &mut Selection) {
    for file in &mut selection.view.files {
        if file.creation_id.is_empty() {
            file.creation_id = uuid::Uuid::new_v4().to_string();
        }
        if file.status == "scheduling"
            || file.status == "saving"
            || (selection.version < 2 && active(&file.status))
        {
            file.status = "review".into();
            file.message = "上次执行中断，请先核对官方作品/预约列表，禁止直接重试".into();
        } else if active(&file.status) {
            file.status = "failed".into();
            file.message = "上传或检测中断，尚未提交预约，可重试".into();
        } else if file.status == "saved" {
            file.status = "legacy_draft".into();
        }
    }
    selection.version = 2;
}
pub(super) fn validate_start(
    view: &DirectorySelection,
    ids: &[String],
    revision: u64,
) -> Result<Vec<VideoFile>> {
    ensure!(view.revision == revision, "预约清单已变化，请刷新后确认");
    ensure!(view.account.is_some(), "请先保存预约计划并绑定账号");
    ensure!(
        !view
            .files
            .iter()
            .any(|f| f.status == "review" || active(&f.status)),
        "请先核对未完成的预约"
    );
    ensure!(
        !ids.is_empty() && ids.len() <= MAX_FILES,
        "请选择 1 至 50 个视频"
    );
    ensure!(
        ids.iter().collect::<HashSet<_>>().len() == ids.len(),
        "重复的视频选择"
    );
    let files: Vec<_> = view
        .files
        .iter()
        .filter(|f| ids.contains(&f.id))
        .cloned()
        .collect();
    ensure!(
        files.len() == ids.len() && files.iter().all(|f| retryable(&f.status)),
        "视频已预约或选择已失效"
    );
    for file in &files {
        file.schedule
            .as_ref()
            .context("存在尚未配置时间的视频")?
            .validate(now(), view.account.as_ref().unwrap())?;
    }
    Ok(files)
}
pub(super) fn publish_body(file: &VideoFile) -> Result<Value> {
    let schedule = file.schedule.as_ref().context("未配置预约时间")?;
    let media = file.media.as_ref().context("尚未取得视频 ID")?;
    ensure!(
        !media.vid.is_empty()
            && media.duration.is_finite()
            && media.duration > 0.0
            && media.width > 0
            && media.height > 0,
        "视频上传回执无效"
    );
    Ok(json!({
        "post_common_info": { "creation_id": file.creation_id, "enter_post_page_from": 8, "post_type": 3 },
        "feature_common_info_list": [{
            "schedule_time": schedule.scheduled_at, "geofencing_regions": [], "sound_exemption": 0,
            "tcm_params": "{\"commerce_toggle_info\":{}}",
            "playlist_name": "", "playlist_id": "", "anchors": [],
            "vedit_common_info": {"draft": "", "video_id": media.vid},
            "privacy_setting_info": { "visibility_type": schedule.visibility,
                "allow_comment": u8::from(schedule.allow_comment), "allow_duet": 0, "allow_stitch": 0,
                "allow_content_reuse": 0, "allow_ai_remix": 2 }
        }],
        "single_post_req_list": [{ "batch_index": 0, "video_id": media.vid,
            "is_long_video": u8::from(media.duration > 60.0),
            "single_post_feature_info": { "text": schedule.caption, "text_extra": [],
                "markup_text": schedule.caption.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;").replace("\r\n", "\n").replace('\n', "<br>"),
                "poster_delay": 0, "music_info": {"origin_volume": "100"},
                "cloud_edit_video_height": media.height, "cloud_edit_video_width": media.width,
                "cloud_edit_is_use_video_canvas": false, "has_original_audio": 1,
                "is_upload_audio_track": false, "mature_theme_type": 0,
                "video_track_time_range_list": [{"start_time_in_ms": 0,
                    "end_time_in_ms": (media.duration * 1000.0).floor() as u64}] }
        }]
    }))
}
