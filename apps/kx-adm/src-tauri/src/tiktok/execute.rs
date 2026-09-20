use super::*;
impl TikTok {
    pub async fn upload(
        self: &Arc<Self>,
        ids: Vec<String>,
        revision: u64,
        account_id: String,
        concurrency: usize,
    ) -> Result<()> {
        ensure!((1..=8).contains(&concurrency), "同时上传视频数须为 1 至 8");
        let _guard = self.gate.try_lock().context("批量预约正在执行")?;
        let selection = self
            .selection
            .lock()
            .await
            .clone()
            .context("请先选择目录")?;
        let files = validate_start(&selection.view, &ids, revision)?;
        let account = selection
            .view
            .account
            .as_ref()
            .context("请先保存预约计划")?;
        ensure!(account.uid == account_id, "确认账号与已保存计划不一致");
        let login = self
            .auth
            .lock()
            .await
            .clone()
            .context("请先粘贴 Cookie 登录")?;
        ensure!(
            login.account.uid == account_id,
            "当前 Cookie 账号与计划不一致"
        );
        let api = api::Api::new(login)?;
        self.pause.store(false, Ordering::SeqCst);
        self.run_batch(
            api,
            selection.root.clone(),
            files,
            account.clone(),
            concurrency,
        )
        .await
    }
    pub(super) async fn run_batch(
        self: &Arc<Self>,
        api: api::Api,
        root: PathBuf,
        files: Vec<VideoFile>,
        account: Account,
        concurrency: usize,
    ) -> Result<()> {
        use futures_util::StreamExt;
        let pool = kx_tk_pool::TkPool::new(concurrency);
        let mut handles = futures_util::stream::FuturesUnordered::new();
        for mut file in files {
            let state = self.clone();
            let api = api.clone();
            let root = root.clone();
            let account = account.clone();
            let handle = pool
                .spawn(async move {
                    if state.pause.load(Ordering::SeqCst) {
                        return Ok(());
                    }
                    let result = state.execute(&api, &root, &mut file, &account).await;
                    if let Err(error) = result {
                        // 停止尚未提交的操作，但已发出的预约必须等待回执，不能提前丢弃Future。
                        state.pause.store(true, Ordering::SeqCst);
                        let current = state.selection.lock().await;
                        let row = current
                            .as_ref()
                            .and_then(|s| s.view.files.iter().find(|f| f.id == file.id));
                        let status = if row.is_some_and(|f| f.status == "scheduling") {
                            "review"
                        } else {
                            "failed"
                        };
                        let bytes = row.map_or(0, |f| f.bytes);
                        drop(current);
                        state
                            .update(
                                &file.id,
                                status,
                                &crate::protocol::safe_message(&error.to_string()),
                                bytes,
                            )
                            .await?;
                        return Err(error);
                    }
                    Ok(())
                })
                .await?;
            handles.push(tokio_util::task::AbortOnDropHandle::new(handle));
        }
        let mut failure = None;
        while let Some(outcome) = handles.next().await {
            match outcome {
                Ok(Ok(())) => {}
                Ok(Err(error)) => {
                    failure.get_or_insert(error);
                }
                Err(_) => {
                    self.pause.store(true, Ordering::SeqCst);
                    failure
                        .get_or_insert_with(|| anyhow::anyhow!("上传执行中断，请核对各视频状态"));
                }
            }
        }
        if let Some(error) = failure {
            return Err(error);
        }
        Ok(())
    }
    pub(super) async fn execute(
        &self,
        api: &api::Api,
        root: &Path,
        file: &mut VideoFile,
        account: &Account,
    ) -> Result<()> {
        let current = api.account().await?;
        ensure!(
            current.uid == account.uid,
            "Cookie 账号与预约计划不一致，队列已停止"
        );
        file.schedule
            .as_ref()
            .context("未配置预约时间")?
            .validate(now(), &current)?;
        let context = api.context().await?;
        if file.media.is_none() {
            let media = vod::upload(self, api, &context, root, file).await?;
            self.change(&file.id, |f| {
                f.media = Some(media.clone());
                f.status = "ready".into();
                f.upload_percent = 100;
                f.message = "视频上传完成，等待提交预约".into();
                f.bytes = f.size;
            })
            .await?;
            file.media = Some(media);
        }
        if self.pause.load(Ordering::SeqCst) {
            return Ok(());
        }
        let mut body = publish_body(file)?;
        if !checks::run(self, api, &context, file, &mut body).await? {
            return Ok(());
        }
        let current = api.account().await?;
        ensure!(
            current.uid == account.uid,
            "Cookie 账号发生变化，未提交预约"
        );
        file.schedule
            .as_ref()
            .context("未配置预约时间")?
            .validate(now(), &current)?;
        if self.pause.load(Ordering::SeqCst) {
            self.update(&file.id, "ready", "已暂停，尚未提交预约", file.size)
                .await?;
            return Ok(());
        }
        self.update(
            &file.id,
            "scheduling",
            "正在通过 API 提交预约，等待 TikTok 回执",
            file.size,
        )
        .await?;
        let receipt = api.post(&body, &context).await?;
        apply_receipt(self, &file.id, receipt).await
    }
}
async fn apply_receipt(state: &TikTok, id: &str, receipt: Value) -> Result<()> {
    match receipt["disposition"].as_str() {
        Some("scheduled") => {
            let item_id = receipt["itemId"]
                .as_str()
                .filter(|v| valid_item_id(v))
                .context("发布回执缺少视频 ID，请人工核对")?
                .to_owned();
            state
                .change(id, |file| {
                    file.item_id = Some(item_id);
                    file.receipt = Some(receipt);
                    file.status = "scheduled".into();
                    file.message = "TikTok 已接收预约，到时由平台发布".into();
                })
                .await
        }
        Some("rejected") => {
            let message = crate::protocol::safe_message(
                receipt["message"].as_str().unwrap_or("TikTok 拒绝预约"),
            );
            state
                .change(id, |file| {
                    file.status = "failed".into();
                    file.message = message.clone();
                    file.receipt = Some(receipt);
                })
                .await?;
            anyhow::bail!("{message}")
        }
        _ => anyhow::bail!(
            "{}",
            crate::protocol::safe_message(
                receipt["message"]
                    .as_str()
                    .unwrap_or("预约结果未知，请核对官方列表")
            )
        ),
    }
}

#[cfg(test)]
pub(super) async fn test_apply_receipt(state: &TikTok, id: &str, receipt: Value) -> Result<()> {
    apply_receipt(state, id, receipt).await
}
