use super::*;
use api::{Api, WebContext, read_json, status_code};
use reqwest::Method;

pub(super) const COPYRIGHT: &str = "/tiktok/copyright/music/check/v1/";
pub(super) const CONTENT_CREATE: &str = "/tiktok/v1/creator/content/check/create";
pub(super) const CONTENT_RESULT: &str = "/tiktok/v1/creator/content/check/";
const TASK: &str = "CONTENT_CHECK_TASK_LITE";

// 可选的发布前检查，不修改账号的官网偏好，也不把未检测伪装成检测通过。
pub(super) async fn run(
    state: &TikTok,
    api: &Api,
    context: &WebContext,
    file: &VideoFile,
    body: &mut Value,
) -> Result<bool> {
    let schedule = file.schedule.as_ref().context("未配置预约时间")?;
    if !schedule.copyright_check && !schedule.content_check {
        return Ok(true);
    }
    state
        .update(
            &file.id,
            "checking",
            "等待发布前检测，尚未提交预约",
            file.size,
        )
        .await?;
    let result = tokio::select! {
        result = tokio::time::timeout(Duration::from_secs(900), perform(api, context, file, body)) => {
            result.context("检测超过 15 分钟，未提交预约；请重试检测")??;
            true
        }
        _ = paused(state) => false,
    };
    state
        .update(
            &file.id,
            "ready",
            if result {
                "所选检测已通过，等待提交预约"
            } else {
                "已暂停检测，尚未提交预约"
            },
            file.size,
        )
        .await?;
    Ok(result)
}
async fn paused(state: &TikTok) {
    while !state.pause.load(Ordering::SeqCst) {
        tokio::time::sleep(Duration::from_millis(200)).await;
    }
}
async fn read_check(request: reqwest::RequestBuilder, stage: &str) -> Result<Value> {
    let response = request
        .send()
        .await
        .map_err(|_| anyhow::anyhow!("{stage}请求失败，未提交预约"))?;
    let value = read_json(response, stage).await?;
    ensure!(
        status_code(&value) == Some(0),
        "{stage}未成功（状态码 {:?}），未提交预约",
        status_code(&value)
    );
    Ok(value)
}
async fn perform(
    api: &Api,
    context: &WebContext,
    file: &VideoFile,
    body: &mut Value,
) -> Result<()> {
    let schedule = file.schedule.as_ref().context("未配置预约时间")?;
    let vid = &file.media.as_ref().context("尚未取得视频 ID")?.vid;
    if schedule.copyright_check {
        let result = read_check(
            api.site_request(Method::GET, COPYRIGHT)?
                .query(&[("video_id", vid)]),
            "音乐版权检测",
        )
        .await?;
        ensure!(
            result["copyright_detection_result"].as_u64() == Some(1),
            "音乐版权检测未通过或结果未知，未提交预约"
        );
        let mut copyright = json!({"result": 1});
        if let Some(materials) = result.get("copyrighted_materials") {
            copyright["materials"] = materials.clone();
        }
        body["feature_common_info_list"][0]["music_copyright"] = copyright;
        if let Some(id) = result["pre_check_id"].as_str().filter(|id| !id.is_empty()) {
            body["single_post_req_list"][0]["single_post_feature_info"]["music_info"]["music_pre_check_id"] =
                json!(id);
        }
    }
    if schedule.content_check {
        let created = read_check(
            api.site_request(Method::POST, CONTENT_CREATE)?
                .header("tt-csrf-token", &context.csrf)
                .json(&json!({"video_id": vid, "tasks": [0]})),
            "创建内容检测",
        )
        .await?;
        let id = created["check_ids"][TASK]
            .as_str()
            .or_else(|| created["check_ids"]["0"].as_str())
            .filter(|id| !id.is_empty())
            .context("内容检测缺少任务编号，未提交预约")?;
        let queries = json!([{"task":0,"check_id":id}]).to_string();
        loop {
            let result = read_check(
                api.site_request(Method::GET, CONTENT_RESULT)?
                    .query(&[("video_id", vid.as_str()), ("queries", &queries)]),
                "内容检测",
            )
            .await?;
            if content_passed(&result, id)? {
                // 官网轻量检测仅在客户端阻止提前发布，不冒用深度检测 content_check_id。
                break;
            }
            #[cfg(not(test))]
            tokio::time::sleep(Duration::from_secs(10)).await;
            #[cfg(test)]
            tokio::time::sleep(Duration::from_millis(10)).await;
        }
    }
    Ok(())
}
fn content_passed(value: &Value, id: &str) -> Result<bool> {
    let lookup = |field: &str| {
        [id, TASK, "0"]
            .iter()
            .find_map(|key| value[field].get(*key))
    };
    match lookup("check_status").and_then(Value::as_u64) {
        Some(0 | 1) => Ok(false),
        Some(2) => {
            let results = lookup("check_result")
                .and_then(|v| v["model_check_results"].as_array())
                .filter(|v| !v.is_empty())
                .context("内容检测缺少结果，未提交预约")?;
            ensure!(
                results
                    .iter()
                    .all(|v| v["model_check_result"].as_u64() == Some(0)),
                "内容检测未通过，未提交预约；请检查或更换视频"
            );
            Ok(true)
        }
        Some(3) => anyhow::bail!("内容检测失败，未提交预约；可重试检测"),
        _ => anyhow::bail!("内容检测状态未知，未提交预约"),
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn processing_is_not_a_pass_and_incomplete_or_flagged_results_stop_publication() {
        assert!(!content_passed(&json!({"check_status":{"test-check":1}}), "test-check").unwrap());
        assert!(content_passed(&json!({"check_status":{"test-check":2},"check_result":{"test-check":{"model_check_results":[{"model_type":0,"model_check_result":0}]}}}), "test-check").unwrap());
        for result in [
            json!({}),
            json!({"check_status":{"test-check":2}}),
            json!({"check_status":{"test-check":3}}),
            json!({"check_status":{"test-check":2},"check_result":{"test-check":{"model_check_results":[{"model_type":0,"model_check_result":1}]}}}),
        ] {
            assert!(content_passed(&result, "test-check").is_err());
        }
    }
}
