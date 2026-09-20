use super::*;

fn archive_dir(data: &Path, owner: Option<&str>, uid: &str) -> Result<PathBuf> {
    ensure!(valid_item_id(uid), "TikTok 账号编号无效");
    use sha2::{Digest, Sha256};
    let namespace = format!("{:x}", Sha256::digest(owner.unwrap_or("legacy").as_bytes()));
    Ok(data.join("tiktok-accounts").join(namespace).join(uid))
}
impl TikTok {
    // 调用方持有 gate；先完成磁盘切换，再替换登录态，失败保留原账号。
    pub(super) async fn activate_account(&self, account: &Account, owner_key: &str) -> Result<()> {
        let mut current = self.selection.lock().await;
        if let Some(selection) = current.as_ref() {
            if selection.owner_key.as_deref() == Some(owner_key)
                && selection
                    .view
                    .account
                    .as_ref()
                    .is_some_and(|a| a.uid == account.uid)
            {
                return Ok(());
            }
            if selection.owner_key.is_none()
                && (selection.view.account.is_none()
                    || selection
                        .view
                        .account
                        .as_ref()
                        .is_some_and(|a| a.uid == account.uid))
            {
                let mut next = selection.clone();
                next.owner_key = Some(owner_key.into());
                next.view.account = Some(account.clone());
                next.view.revision += 1;
                persist(&self.data, &next)?;
                *current = Some(next);
                return Ok(());
            }
        }
        let target =
            archive_dir(&self.data, Some(owner_key), &account.uid)?.join("tiktok-queue.json");
        let legacy = archive_dir(&self.data, None, &account.uid)?.join("tiktok-queue.json");
        let migrate_legacy = !target.exists() && legacy.exists();
        let source = if migrate_legacy { &legacy } else { &target };
        let mut next: Option<Selection> = if source.exists() {
            Some(
                serde_json::from_slice(&std::fs::read(source)?)
                    .context("目标账号清单损坏，未切换账号")?,
            )
        } else {
            None
        };
        if let Some(selection) = &mut next {
            if migrate_legacy && selection.owner_key.is_none() {
                selection.owner_key = Some(owner_key.into());
            }
            ensure!(
                selection.owner_key.as_deref() == Some(owner_key)
                    && selection
                        .view
                        .account
                        .as_ref()
                        .is_some_and(|a| a.uid == account.uid),
                "目标清单账号不一致"
            );
            recover(selection);
            selection.view.revision += 1;
            if migrate_legacy {
                let directory = target.parent().context("账号归档路径无效")?;
                std::fs::create_dir_all(directory)?;
                persist(directory, selection)?;
                std::fs::remove_file(&legacy)?;
            }
        }
        if let Some(selection) = current.as_ref() {
            let uid = &selection
                .view
                .account
                .as_ref()
                .context("清单未绑定账号")?
                .uid;
            let dir = archive_dir(&self.data, selection.owner_key.as_deref(), uid)?;
            std::fs::create_dir_all(&dir)?;
            persist(&dir, selection)?;
        }
        if let Some(selection) = &next {
            persist(&self.data, selection)?;
        } else {
            let path = self.data.join("tiktok-queue.json");
            if path.exists() {
                std::fs::remove_file(path)?;
            }
        }
        *current = next;
        Ok(())
    }
    pub(super) fn remove_account_archive(&self, selection: &Selection) -> Result<()> {
        if let Some(account) = &selection.view.account {
            let path = archive_dir(&self.data, selection.owner_key.as_deref(), &account.uid)?
                .join("tiktok-queue.json");
            if path.exists() {
                std::fs::remove_file(path)?;
            }
        }
        Ok(())
    }
    pub async fn preview_path(&self, id: &str, revision: u64) -> Result<PathBuf> {
        let _guard = self.gate.try_lock().context("任务正在执行，请稍后预览")?;
        let owner = self
            .auth
            .lock()
            .await
            .as_ref()
            .map(|l| l.account.uid.clone())
            .context("请先登录 TikTok")?;
        let current = self.selection.lock().await;
        let selection = current.as_ref().context("请先选择目录")?;
        ensure!(
            selection.view.revision == revision,
            "清单已变化，请刷新后预览"
        );
        ensure!(
            selection
                .view
                .account
                .as_ref()
                .is_some_and(|a| a.uid == owner),
            "预览视频与当前账号不一致"
        );
        let file = selection
            .view
            .files
            .iter()
            .find(|f| f.id == id)
            .context("视频不在当前清单")?;
        let _file = open_video(&selection.root, file).await?;
        Ok(selection.root.join(&file.relative))
    }
}
