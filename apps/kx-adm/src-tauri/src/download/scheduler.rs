use anyhow::{Result, ensure};
use serde::{Deserialize, Serialize};
use std::{
    collections::VecDeque,
    path::Path,
    sync::{Arc, Mutex},
};
use tokio::sync::Notify;

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq)]
pub struct DownloadSettings {
    pub concurrency: usize,
}
impl Default for DownloadSettings {
    fn default() -> Self {
        Self { concurrency: 4 }
    }
}

struct State {
    settings: DownloadSettings,
    active: usize,
    next: u64,
    waiting: VecDeque<u64>,
}

/// 所有剧目的文件共享额度；等待者取消或传输结束时自动归还位置。
pub struct DownloadScheduler {
    state: Mutex<State>,
    changed: Notify,
}

impl DownloadScheduler {
    pub fn load(data: &Path) -> Result<Arc<Self>> {
        let path = data.join("download-settings.json");
        let settings: DownloadSettings = if path.exists() {
            serde_json::from_slice(&std::fs::read(path)?)?
        } else {
            DownloadSettings::default()
        };
        validate(settings.concurrency)?;
        Ok(Arc::new(Self {
            state: Mutex::new(State {
                settings,
                active: 0,
                next: 0,
                waiting: VecDeque::new(),
            }),
            changed: Notify::new(),
        }))
    }

    pub fn settings(&self) -> DownloadSettings {
        self.state.lock().unwrap().settings
    }

    pub fn save(&self, data: &Path, concurrency: usize) -> Result<DownloadSettings> {
        validate(concurrency)?;
        let mut state = self.state.lock().unwrap();
        let settings = DownloadSettings { concurrency };
        // 先原子替换磁盘配置，失败时运行中的上限保持不变。
        let mut temp = tempfile::NamedTempFile::new_in(data)?;
        serde_json::to_writer(temp.as_file_mut(), &settings)?;
        temp.as_file().sync_all()?;
        temp.persist(data.join("download-settings.json"))?;
        state.settings = settings;
        drop(state);
        self.changed.notify_waiters();
        Ok(settings)
    }

    pub async fn acquire(self: &Arc<Self>) -> DownloadSlot {
        let id = {
            let mut state = self.state.lock().unwrap();
            let id = state.next;
            state.next += 1;
            state.waiting.push_back(id);
            id
        };
        let mut slot = DownloadSlot {
            scheduler: self.clone(),
            id,
            active: false,
        };
        loop {
            // 先注册通知再检查条件，防止检查与 await 之间丢失释放通知。
            let notified = self.changed.notified();
            tokio::pin!(notified);
            notified.as_mut().enable();
            {
                let mut state = self.state.lock().unwrap();
                if state.active < state.settings.concurrency && state.waiting.front() == Some(&id) {
                    state.waiting.pop_front();
                    state.active += 1;
                    slot.active = true;
                    self.changed.notify_waiters();
                    return slot;
                }
            }
            notified.await;
        }
    }
}

fn validate(concurrency: usize) -> Result<()> {
    ensure!(
        (1..=32).contains(&concurrency),
        "全局下载并发数须为 1 至 32"
    );
    Ok(())
}

pub struct DownloadSlot {
    scheduler: Arc<DownloadScheduler>,
    id: u64,
    active: bool,
}
impl Drop for DownloadSlot {
    fn drop(&mut self) {
        let mut state = self.scheduler.state.lock().unwrap();
        if self.active {
            state.active -= 1;
        } else {
            state.waiting.retain(|id| *id != self.id);
        }
        drop(state);
        self.scheduler.changed.notify_waiters();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;

    #[tokio::test]
    async fn settings_persist_and_failed_saves_leave_running_limit_unchanged() -> Result<()> {
        let dir = tempfile::tempdir()?;
        let scheduler = DownloadScheduler::load(dir.path())?;
        assert_eq!(scheduler.settings().concurrency, 4);
        scheduler.save(dir.path(), 10)?;
        assert_eq!(
            DownloadScheduler::load(dir.path())?.settings().concurrency,
            10
        );
        for invalid in [0, 33] {
            assert!(scheduler.save(dir.path(), invalid).is_err());
        }
        assert!(scheduler.save(&dir.path().join("missing"), 2).is_err());
        assert_eq!(scheduler.settings().concurrency, 10);
        Ok(())
    }

    #[tokio::test]
    async fn growing_wakes_waiters_shrinking_drains_and_cancellation_frees_queue() -> Result<()> {
        let dir = tempfile::tempdir()?;
        let scheduler = DownloadScheduler::load(dir.path())?;
        scheduler.save(dir.path(), 1)?;
        let first = scheduler.acquire().await;
        let mut second = Box::pin(scheduler.acquire());
        assert!(
            tokio::time::timeout(Duration::from_millis(10), &mut second)
                .await
                .is_err()
        );
        scheduler.save(dir.path(), 2)?;
        let second = tokio::time::timeout(Duration::from_secs(1), second).await?;
        scheduler.save(dir.path(), 1)?;
        let mut cancelled = Box::pin(scheduler.acquire());
        assert!(
            tokio::time::timeout(Duration::from_millis(10), &mut cancelled)
                .await
                .is_err()
        );
        let mut third = Box::pin(scheduler.acquire());
        assert!(
            tokio::time::timeout(Duration::from_millis(10), &mut third)
                .await
                .is_err()
        );
        drop(cancelled);
        drop(first);
        assert!(
            tokio::time::timeout(Duration::from_millis(10), &mut third)
                .await
                .is_err()
        );
        drop(second);
        let _third = tokio::time::timeout(Duration::from_secs(1), third).await?;
        assert_eq!(scheduler.state.lock().unwrap().active, 1);
        Ok(())
    }
}
