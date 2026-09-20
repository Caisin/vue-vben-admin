use super::*;

fn apply_update(job: &Job, update: JobUpdate) -> Result<Job> {
    ensure!(
        job.revision == update.expected_revision,
        "目录清单已变化，请刷新后重试"
    );
    ensure!(
        !update.name.trim().is_empty() && update.name.chars().count() <= 200,
        "目录显示名称需要 1 至 200 字"
    );
    ensure!(
        (1..=8).contains(&update.concurrency),
        "同时上传集数须为 1 至 8"
    );
    ensure!(
        !update.items.is_empty(),
        "目录不能没有分集，请移除整个目录任务"
    );
    ensure!(
        job.import_id.is_none() && job.status != "完成",
        "清单已提交登记，请到版本内容中编辑分集"
    );
    let mut names = std::collections::HashSet::new();
    let mut seqs = std::collections::HashSet::new();
    let mut items = Vec::with_capacity(update.items.len());
    for edit in update.items {
        ensure!(names.insert(edit.relative.clone()), "清单文件重复");
        let original = job
            .items
            .iter()
            .find(|i| i.relative == edit.relative)
            .ok_or_else(|| anyhow::anyhow!("不能添加未扫描的文件，请重新选择目录"))?;
        // 未识别的序号 0 可暂存；正式开始上传仍要求所有集数为正且唯一。
        ensure!(
            edit.seq >= 0 && (edit.seq == 0 || seqs.insert(edit.seq)),
            "集数不能为负数或重复"
        );
        ensure!(
            !edit.title.trim().is_empty() && edit.title.chars().count() <= 200,
            "请填写有效分集标题"
        );
        if original.status == "已登记" {
            ensure!(
                edit.seq == original.seq && edit.title == original.title,
                "已登记分集请在版本内容中编辑"
            );
        }
        let mut item = original.clone();
        item.seq = edit.seq;
        item.title = edit.title.trim().into();
        items.push(item);
    }
    ensure!(
        job.items
            .iter()
            .filter(|i| i.status == "已登记")
            .all(|i| names.contains(&i.relative)),
        "已登记分集请在版本内容中删除"
    );
    let mut next = job.clone();
    next.name = update.name.trim().into();
    next.concurrency = update.concurrency;
    next.items = items;
    next.revision += 1;
    Ok(next)
}
impl Desktop {
    pub async fn update_job(
        &self,
        app: &impl UploadEvents,
        id: &str,
        update: JobUpdate,
    ) -> Result<Value> {
        let active = self.active.lock().await;
        ensure!(!active.contains(id), "请先暂停并等待在途分集结束后编辑");
        let (job, _) = self.owned_job(id).await?;
        let mut next = apply_update(&job, update)?;
        let mut q = self.queue.lock().await;
        let current = q
            .iter_mut()
            .find(|j| j.id == id)
            .ok_or_else(|| anyhow::anyhow!("目录任务不存在"))?;
        // 展开状态不属于清单编辑，不能被草稿覆盖。
        next.collapsed = current.collapsed;
        *current = next.clone();
        persist(&self.data, &q)?;
        let view = next.view();
        app.job_updated(view.clone())?;
        Ok(view)
    }
    pub async fn remove_job(&self, id: &str, expected_revision: u64) -> Result<()> {
        let active = self.active.lock().await;
        ensure!(!active.contains(id), "请先暂停并等待在途分集结束后移除目录");
        let (job, _) = self.owned_job(id).await?;
        ensure!(
            job.revision == expected_revision,
            "目录清单已变化，请刷新后重试"
        );
        let mut q = self.queue.lock().await;
        q.retain(|j| j.id != id);
        persist(&self.data, &q)
    }
    pub async fn collapse_job(
        &self,
        app: &impl UploadEvents,
        id: &str,
        collapsed: bool,
    ) -> Result<Value> {
        self.owned_job(id).await?;
        Ok(self
            .change(app, id, |j| j.collapsed = collapsed)
            .await?
            .view())
    }
    pub async fn rebind_job(
        &self,
        app: &impl UploadEvents,
        id: &str,
        expected_revision: u64,
    ) -> Result<Value> {
        let active = self.active.lock().await;
        ensure!(!active.contains(id), "请先暂停并等待在途分集结束后修改存储");
        let (job, identity) = self.owned_job(id).await?;
        ensure!(
            job.revision == expected_revision,
            "目录清单已变化，请刷新后重试"
        );
        ensure!(
            job.items.iter().all(|i| i.file_id.is_none()) && job.import_id.is_none(),
            "已有上传文件，请保留原存储或重新创建目录任务"
        );
        let storage = self
            .api(
                app,
                &identity,
                reqwest::Method::GET,
                "/adm/res/drama-storage",
                None,
            )
            .await?;
        let code = storage["code"]
            .as_str()
            .filter(|v| !v.is_empty())
            .ok_or_else(|| anyhow::anyhow!("剧视频存储配置无效"))?
            .to_owned();
        let local = matches!(storage["storage_type"].as_str(), Some("local" | "fs"));
        Ok(self
            .change(app, id, |j| {
                j.storage = code;
                j.local_storage = local;
                j.error.clear();
                j.status = "待确认".into();
                j.revision += 1;
            })
            .await?
            .view())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::session::SessionEvents;
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
    fn update(job: &Job) -> JobUpdate {
        JobUpdate {
            expected_revision: job.revision,
            name: job.name.clone(),
            concurrency: 2,
            items: job
                .items
                .iter()
                .map(|i| model::ItemEdit {
                    relative: i.relative.clone(),
                    seq: i.seq,
                    title: i.title.clone(),
                })
                .collect(),
        }
    }
    #[tokio::test]
    async fn edits_removals_and_collapse_persist_without_touching_files_or_other_users()
    -> Result<()> {
        let dir = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let root = dir.join("videos");
        std::fs::create_dir_all(&root)?;
        for name in ["1.mp4", "2.mp4"] {
            std::fs::write(root.join(name), b"video")?;
        }
        let state = Desktop::new(dir.clone())?;
        let identity = Session {
            token: "fixture".into(),
            uid: "7".into(),
            expires_at: crate::session::now() + 3600,
            api_base: "https://example.test".into(),
            generation: 1,
        };
        state.auth.lock().await.session = Some(identity);
        let job = Job {
            revision: 0,
            collapsed: true,
            timing: Default::default(),
            concurrency: 3,
            version_name: "原版".into(),
            id: "editable".into(),
            api_base: "https://example.test".into(),
            uid: "7".into(),
            res: "1".into(),
            version: "2".into(),
            storage: "media".into(),
            local_storage: false,
            root: root.clone(),
            name: "videos".into(),
            status: "已暂停".into(),
            error: String::new(),
            items: crate::scan::scan(&root)?,
            import_id: None,
        };
        state.add(&Events, job.clone()).await?;
        state.collapse_job(&Events, &job.id, false).await?;
        let mut edit = update(&job);
        edit.name = "我的目录".into();
        edit.items[0].seq = 5;
        edit.items[0].title = "第五集".into();
        edit.items.remove(1);
        let saved = state.update_job(&Events, &job.id, edit).await?;
        assert_eq!(saved["revision"], 1);
        assert_eq!(saved["items"].as_array().unwrap().len(), 1);
        assert_eq!(saved["items"][0]["seq"], 5);
        assert_eq!(saved["name"], "我的目录");
        assert_eq!(saved["collapsed"], false);
        let current = state.owned_job(&job.id).await?.0;
        assert!(
            state
                .update_job(&Events, &job.id, update(&job))
                .await
                .is_err(),
            "旧修订号不得覆盖"
        );
        let mut invalid = update(&current);
        invalid.items[0].relative = "../../private.mp4".into();
        assert!(state.update_job(&Events, &job.id, invalid).await.is_err());
        state.active.lock().await.insert(job.id.clone());
        assert!(
            state
                .update_job(&Events, &job.id, update(&current))
                .await
                .is_err()
        );
        assert!(state.remove_job(&job.id, 1).await.is_err());
        state.collapse_job(&Events, &job.id, true).await?;
        state.active.lock().await.clear();
        let loaded = load(&dir)?;
        assert!(loaded[0].collapsed);
        assert_eq!(loaded[0].items[0].title, "第五集");
        assert_eq!(loaded[0].items[0].relative, "1.mp4");
        state.auth.lock().await.session.as_mut().unwrap().uid = "8".into();
        assert!(state.remove_job(&job.id, 1).await.is_err());
        assert!(
            state
                .update_job(&Events, &job.id, update(&current))
                .await
                .is_err()
        );
        state.auth.lock().await.session.as_mut().unwrap().uid = "7".into();
        assert!(state.remove_job(&job.id, 0).await.is_err());
        state.remove_job(&job.id, 1).await?;
        assert!(load(&dir)?.is_empty());
        assert!(root.join("1.mp4").exists());
        assert!(root.join("2.mp4").exists());
        std::fs::remove_dir_all(dir)?;
        Ok(())
    }
    #[tokio::test]
    async fn rebinding_uses_backend_config_only_for_unuploaded_directory() -> Result<()> {
        use tokio::io::{AsyncReadExt, AsyncWriteExt};
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await?;
        let base = format!("http://{}", listener.local_addr()?);
        let server = tokio::spawn(async move {
            let (mut socket, _) = listener.accept().await.unwrap();
            let mut bytes = Vec::new();
            loop {
                let mut buf = [0; 4096];
                let n = socket.read(&mut buf).await.unwrap();
                if n == 0 {
                    break;
                }
                bytes.extend_from_slice(&buf[..n]);
                if bytes.windows(4).any(|v| v == b"\r\n\r\n") {
                    break;
                }
            }
            assert!(String::from_utf8_lossy(&bytes).starts_with("GET /adm/res/drama-storage "));
            let body = kx_ed::KxEd::en(
                br#"{"code":200,"result":{"code":"new-video","storage_type":"s3"}}"#,
            )
            .await
            .unwrap();
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
        let dir = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        let state = Desktop::new(dir.clone())?;
        state.auth.lock().await.session = Some(Session {
            token: "fixture".into(),
            uid: "7".into(),
            expires_at: crate::session::now() + 3600,
            api_base: base.clone(),
            generation: 1,
        });
        let job: Job = serde_json::from_value(
            json!({"id":"rebind","apiBase":base,"uid":"7","res":"1","version":"2","storage":"old","localStorage":true,"root":dir,"name":"目录","status":"已暂停","error":"存储已变化","items":[{"relative":"1.mp4","seq":1,"title":"第1集","size":3,"modified":1,"fileId":null,"status":"待上传","error":"","bytes":0}],"importId":null}),
        )?;
        state.add(&Events, job).await?;
        let result = state.rebind_job(&Events, "rebind", 0).await?;
        server.await?;
        assert_eq!(result["storage"], "new-video");
        assert_eq!(result["localStorage"], false);
        assert_eq!(result["revision"], 1);
        assert_eq!(result["items"][0]["title"], "第1集");
        let restored = load(&dir)?;
        assert_eq!(restored[0].storage, "new-video");
        assert!(state.rebind_job(&Events, "rebind", 0).await.is_err());
        state.queue.lock().await[0].items[0].file_id = Some("99".into());
        assert!(state.rebind_job(&Events, "rebind", 1).await.is_err());
        std::fs::remove_dir_all(dir)?;
        Ok(())
    }
}
