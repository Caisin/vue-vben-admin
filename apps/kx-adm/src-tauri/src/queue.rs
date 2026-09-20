pub trait UploadEvents: crate::session::SessionEvents + Clone + 'static {
    fn job_updated(&self, job: Value) -> Result<()>;
}
impl UploadEvents for AppHandle {
    fn job_updated(&self, job: Value) -> Result<()> {
        self.emit_to("main", "desktop-upload-updated", job)?;
        Ok(())
    }
}

use crate::{
    protocol,
    session::{Desktop, Session},
};
use anyhow::{Result, ensure};
use futures_util::StreamExt;
use serde_json::{Value, json};
use std::{
    path::Path,
    sync::Arc,
    time::{Duration, UNIX_EPOCH},
};
use tauri::{AppHandle, Emitter};
use tokio::io::AsyncReadExt;
mod model;
pub use model::{Edit, Item, Job, JobUpdate};
pub fn modified(m: &std::fs::Metadata) -> u64 {
    m.modified()
        .ok()
        .and_then(|v| v.duration_since(UNIX_EPOCH).ok())
        .map(|v| v.as_secs())
        .unwrap_or_default()
}
pub fn load(data: &Path) -> Result<Vec<Job>> {
    let path = data.join("upload-queue.json");
    if !path.exists() {
        return Ok(Vec::new());
    }
    let mut jobs: Vec<Job> = serde_json::from_slice(&std::fs::read(path)?)?;
    for job in &mut jobs {
        if !["完成", "待确认"].contains(&job.status.as_str()) {
            job.status = "已暂停".into();
            job.timing.stop(false);
            for item in &mut job.items {
                item.timing.stop(false);
                if item.file_id.is_none() {
                    item.bytes = 0;
                    item.status = "待上传".into();
                }
            }
        }
    }
    Ok(jobs)
}
fn persist(data: &Path, jobs: &[Job]) -> Result<()> {
    let tmp = data.join("upload-queue.tmp");
    std::fs::write(&tmp, serde_json::to_vec(jobs)?)?;
    std::fs::rename(tmp, data.join("upload-queue.json"))?;
    Ok(())
}
impl Desktop {
    pub(crate) async fn pause_all(&self) -> Result<()> {
        let mut jobs = self.queue.lock().await;
        for job in jobs.iter_mut() {
            if ["等待上传", "上传中", "登记分集"].contains(&job.status.as_str()) {
                job.status = "暂停中".into();
            }
        }
        persist(&self.data, &jobs)
    }

    pub async fn jobs(&self) -> Result<Vec<Value>> {
        let s = self.identity().await?;
        Ok(self
            .queue
            .lock()
            .await
            .iter()
            .filter(|j| j.uid == s.uid && j.api_base == s.api_base)
            .map(Job::view)
            .collect())
    }
    pub async fn add(&self, app: &impl UploadEvents, job: Job) -> Result<Value> {
        let v = job.view();
        let mut q = self.queue.lock().await;
        q.push(job);
        persist(&self.data, &q)?;
        app.job_updated(v.clone())?;
        Ok(v)
    }
    async fn change(
        &self,
        app: &impl UploadEvents,
        id: &str,
        f: impl FnOnce(&mut Job),
    ) -> Result<Job> {
        let mut q = self.queue.lock().await;
        let j = q
            .iter_mut()
            .find(|j| j.id == id)
            .ok_or_else(|| anyhow::anyhow!("上传任务不存在"))?;
        j.timing.checkpoint();
        for item in &mut j.items {
            item.timing.checkpoint();
        }
        f(j);
        let j = j.clone();
        persist(&self.data, &q)?;
        app.job_updated(j.view())?;
        Ok(j)
    }
    async fn owned_job(&self, id: &str) -> Result<(Job, Session)> {
        let s = self.identity().await?;
        let j = self
            .queue
            .lock()
            .await
            .iter()
            .find(|j| j.id == id && j.uid == s.uid && j.api_base == s.api_base)
            .cloned()
            .ok_or_else(|| anyhow::anyhow!("上传任务不存在或属于其他账号"))?;
        Ok((j, s))
    }
    pub async fn pause(&self, app: &impl UploadEvents, id: &str) -> Result<()> {
        self.owned_job(id).await?;
        self.change(app, id, |j| j.status = "暂停中".into()).await?;
        Ok(())
    }
    pub async fn start(
        self: &Arc<Self>,
        app: impl UploadEvents,
        id: String,
        edits: Vec<Edit>,
        concurrency: usize,
        expected_revision: Option<u64>,
    ) -> Result<()> {
        ensure!((1..=8).contains(&concurrency), "同时上传集数须为 1 至 8");
        let mut active = self.active.lock().await;
        let (job, _) = self.owned_job(&id).await?;
        ensure!(
            expected_revision.is_none_or(|v| v == job.revision),
            "目录清单已变化，请刷新后重试"
        );
        ensure!(!active.contains(&id), "任务正在执行，请等待当前文件结束");
        ensure!(
            !self.queue.lock().await.iter().any(|other| other.id != id
                && active.contains(&other.id)
                && other.uid == job.uid
                && other.api_base == job.api_base
                && other.res == job.res
                && other.version == job.version),
            "该版本已有目录正在上传，请等待完成或暂停后再开始"
        );
        ensure!(edits.len() == job.items.len(), "清单长度发生变化");
        let mut seqs = std::collections::HashSet::new();
        for (edit, item) in edits.iter().zip(&job.items) {
            ensure!(
                edit.seq > 0
                    && seqs.insert(edit.seq)
                    && !edit.title.trim().is_empty()
                    && edit.title.chars().count() <= 200,
                "请填写不重复的正整数集数和标题"
            );
            if item.file_id.is_some() {
                ensure!(
                    edit.seq == item.seq && edit.title == item.title,
                    "已上传文件不能修改清单，请在版本内容中编辑"
                );
            }
        }
        self.change(&app, &id, |j| {
            j.revision += 1;
            j.concurrency = concurrency;
            j.status = "等待上传".into();
            j.error.clear();
            for (item, edit) in j.items.iter_mut().zip(edits) {
                item.seq = edit.seq;
                item.title = edit.title;
                item.error.clear();
            }
        })
        .await?;
        active.insert(id.clone());
        drop(active);
        let this = self.clone();
        tauri::async_runtime::spawn(async move {
            let outcome = this.run(&app, &id).await;
            if let Err(e) = outcome {
                let message = e.to_string();
                let _ = this
                    .change(&app, &id, |j| {
                        j.timing.stop(false);
                        j.status = "已暂停".into();
                        j.error = message;
                    })
                    .await;
            }
            this.active.lock().await.remove(&id);
        });
        Ok(())
    }
    async fn running(&self, id: &str) -> Result<(Job, Session)> {
        let (j, s) = self.owned_job(id).await?;
        ensure!(j.status != "暂停中", "已暂停，可继续上传");
        Ok((j, s))
    }
    async fn run(self: &Arc<Self>, app: &impl UploadEvents, id: &str) -> Result<()> {
        let (mut job, identity) = self.running(id).await?;
        if job.items.iter().any(|item| item.file_id.is_none()) {
            let configured = self
                .api(
                    app,
                    &identity,
                    reqwest::Method::GET,
                    "/adm/res/drama-storage",
                    None,
                )
                .await
                .map_err(|e| anyhow::anyhow!("读取剧视频存储失败：{e}"))?;
            ensure!(
                configured["code"].as_str() == Some(job.storage.as_str()),
                "剧视频存储配置已变化，请重新选择目录创建上传任务"
            );
            let local = matches!(configured["storage_type"].as_str(), Some("local" | "fs"));
            ensure!(
                local == job.local_storage,
                "存储类型已变化，请重新选择目录创建上传任务"
            );
        }
        if job.import_id.is_none() {
            self.change(app, id, |j| j.status = "上传中".into()).await?;
            let pool = kx_tk_pool::TkPool::new(job.concurrency.clamp(1, 8));
            let mut handles = futures_util::stream::FuturesUnordered::new();
            let snapshot = Arc::new(job.clone());
            for index in 0..job.items.len() {
                if job.items[index].file_id.is_some() {
                    continue;
                }
                let this = self.clone();
                let app = app.clone();
                let job = snapshot.clone();
                let identity = identity.clone();
                let handle = pool
                    .spawn(async move {
                        let worker = this.clone();
                        let handle =
                            this.upload_pool
                                .spawn(async move {
                                    worker.upload_one(&app, &identity, &job, index).await
                                })
                                .await?;
                        tokio_util::task::AbortOnDropHandle::new(handle).await?
                    })
                    .await?;
                handles.push(tokio_util::task::AbortOnDropHandle::new(handle));
            }
            let mut failed = false;
            while let Some(outcome) = handles.next().await {
                match outcome {
                    Ok(Ok(())) => {}
                    _ => failed = true,
                }
            }
            job = self
                .change(app, id, |j| {
                    j.timing
                        .stop(!failed && j.items.iter().all(|i| i.file_id.is_some()))
                })
                .await?;
            self.running(id).await?;
            ensure!(
                !failed && job.items.iter().all(|i| i.file_id.is_some()),
                "部分视频上传失败，成功分集已保留，请重试失败集"
            );
            self.running(id).await?;
            let entries: Vec<_>=job.items.iter().map(|i| Ok(json!({"seq_no":i.seq,"title":i.title,"file_id":i.file_id.as_ref().unwrap().parse::<i64>()?,"file_name":i.relative}))).collect::<Result<_>>()?;
            let v = self
                .api(
                    app,
                    &identity,
                    reqwest::Method::POST,
                    &format!("{}/video-imports", job.base()),
                    Some(&json!({"entries":entries})),
                )
                .await?;
            ensure!(
                v["dispatch_error"].as_str().unwrap_or("").is_empty(),
                "服务端任务提交失败，请重试"
            );
            let import_id = id_value(&v["id"])?;
            job = self
                .change(app, id, |j| {
                    j.import_id = Some(import_id);
                    j.status = "登记分集".into();
                })
                .await?;
        }
        loop {
            self.running(id).await?;
            let v = self
                .api(
                    app,
                    &identity,
                    reqwest::Method::GET,
                    &format!(
                        "{}/video-imports/{}",
                        job.base(),
                        job.import_id.as_ref().unwrap()
                    ),
                    None,
                )
                .await?;
            let results = v["results"].as_array().cloned().unwrap_or_default();
            let status = v["task_run"]["status"].as_str().unwrap_or("");
            let finished = results.len() == job.items.len()
                || [
                    "failed",
                    "cancelled",
                    "succeeded",
                    "partially_succeeded",
                    "skipped",
                ]
                .contains(&status);
            self.change(app, id, |j| {
                for result in &results {
                    if let Some(item) = j
                        .items
                        .iter_mut()
                        .find(|i| Some(i.seq as i64) == result["seq_no"].as_i64())
                    {
                        item.status = if result["state"] == "failed" {
                            "登记失败"
                        } else {
                            "已登记"
                        }
                        .into();
                        item.error = if result["state"] == "failed" {
                            result["message"].as_str().unwrap_or("登记失败").into()
                        } else {
                            String::new()
                        };
                    }
                }
                if finished {
                    let failed = j.items.iter().any(|i| i.status != "已登记");
                    j.status = if failed { "登记有误" } else { "完成" }.into();
                    if failed {
                        j.import_id = None;
                        j.error = "部分分集未登记，请处理错误后重试".into();
                    }
                }
            })
            .await?;
            if finished {
                return Ok(());
            }
            tokio::time::sleep(Duration::from_secs(2)).await;
        }
    }
}
fn id_value(v: &Value) -> Result<String> {
    let s = v
        .as_str()
        .map(str::to_owned)
        .or_else(|| v.as_i64().map(|v| v.to_string()))
        .ok_or_else(|| anyhow::anyhow!("服务返回的编号无效"))?;
    ensure!(s.parse::<i64>().is_ok_and(|v| v > 0), "服务返回的编号无效");
    Ok(s)
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn restart_keeps_successes_and_pauses_active_work_without_tokens() -> Result<()> {
        let dir = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        std::fs::create_dir(&dir)?;
        let j = Job {
            revision: 0,
            collapsed: true,
            timing: Default::default(),
            concurrency: 3,
            version_name: String::new(),
            id: "test".into(),
            api_base: "https://example.test".into(),
            uid: "7".into(),
            res: "1".into(),
            version: "2".into(),
            storage: "s3".into(),
            local_storage: false,
            root: dir.clone(),
            name: "剧".into(),
            status: "上传中".into(),
            error: String::new(),
            import_id: None,
            items: vec![Item {
                timing: Default::default(),
                content_type: String::new(),
                relative: "1.mp4".into(),
                seq: 1,
                title: "1".into(),
                size: 10,
                modified: 1,
                file_id: Some("9007199254740999".into()),
                status: "上传成功".into(),
                error: String::new(),
                bytes: 10,
            }],
        };
        persist(&dir, std::slice::from_ref(&j))?;
        let jobs = load(&dir)?;
        assert_eq!(jobs[0].status, "已暂停");
        assert_eq!(
            jobs[0].items[0].file_id.as_deref(),
            Some("9007199254740999")
        );
        assert!(jobs[0].view().get("root").is_none());
        assert!(!std::fs::read_to_string(dir.join("upload-queue.json"))?.contains("token"));
        std::fs::remove_dir_all(dir)?;
        Ok(())
    }
}

#[cfg(test)]
mod upload_tests;

mod upload;

#[cfg(test)]
mod concurrent_tests;

mod manage;
