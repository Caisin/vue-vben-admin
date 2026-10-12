use super::{File, Job};
use anyhow::{Result, ensure};
use futures_util::{StreamExt, stream::FuturesUnordered};
use std::{collections::VecDeque, future::Future};
use tokio::sync::mpsc;

type Progress = (usize, String, u64);

/// 一个协调器保存整体快照，避免多个并发文件相互覆盖磁盘回执。
pub(super) async fn run_files<F, Fut, N>(job: &mut Job, mut upload: F, mut notify: N) -> Result<()>
where
    F: FnMut(usize, File, mpsc::Sender<Progress>) -> Fut,
    Fut: Future<Output = Result<i64>>,
    N: FnMut(&Job, bool) -> Result<()>,
{
    ensure!((1..=8).contains(&job.concurrency), "并发设置无效");
    let mut pending = job
        .files
        .iter()
        .enumerate()
        .filter(|(_, f)| f.file_id.is_none())
        .map(|(i, _)| i)
        .collect::<VecDeque<_>>();
    let (sender, mut progress) = mpsc::channel::<Progress>(128);
    let mut running = FuturesUnordered::new();
    let mut failure = None;
    loop {
        while failure.is_none() && running.len() < job.concurrency {
            let Some(index) = pending.pop_front() else {
                break;
            };
            job.files[index].status = "上传中".into();
            job.files[index].bytes = 0;
            job.files[index].error.clear();
            let future = upload(index, job.files[index].clone(), sender.clone());
            running.push(async move { (index, future.await) });
        }
        if running.is_empty() {
            break;
        }
        tokio::select! {
            Some((index,result)) = running.next() => {
                let file=&mut job.files[index];
                match result {
                    Ok(id) => { file.file_id=Some(id);file.bytes=file.size;file.status="已上传".into();file.error.clear(); }
                    Err(error) => {file.status="待重试".into();file.error=error.to_string();if failure.is_none() {failure=Some(error);}}
                }
                if let Err(error)=notify(job,true) && failure.is_none() {failure=Some(error);}
            }
            Some((index,stage,bytes)) = progress.recv() => {
                let file=&mut job.files[index];
                // 完成回执优先，忽略在途发送但晚到的进度消息。
                if file.file_id.is_none() && file.error.is_empty() {
                    file.status=stage;
                    file.bytes=bytes.min(file.size);
                    if let Err(error)=notify(job,false) && failure.is_none() {failure=Some(error);}
                }
            }
        }
    }
    failure.map_or(Ok(()), Err)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{
        Arc,
        atomic::{AtomicUsize, Ordering},
    };
    fn fixture(root: &std::path::Path) -> Job {
        let files = (0..5)
            .map(|i| {
                let p = root.join(format!("{i}.mp4"));
                std::fs::write(&p, b"video").unwrap();
                super::super::selected_file(p, "film").unwrap()
            })
            .collect();
        Job {
            id: "queue".into(),
            api_base: "https://example.test".into(),
            uid: "7".into(),
            scope: -1,
            version: 2,
            kind: "film".into(),
            seq: 1,
            files,
            status: "待确认".into(),
            concurrency: 2,
            revision: 0,
        }
    }
    #[tokio::test]
    async fn concurrency_is_bounded_receipts_persist_and_retries_skip_successes() -> Result<()> {
        let dir = tempfile::tempdir()?;
        let mut job = fixture(dir.path());
        let active = Arc::new(AtomicUsize::new(0));
        let peak = Arc::new(AtomicUsize::new(0));
        let d = super::super::Desktop::new(dir.path().join("queue"))?;
        run_files(
            &mut job,
            |i, _file, _progress| {
                let active = active.clone();
                let peak = peak.clone();
                async move {
                    let count = active.fetch_add(1, Ordering::SeqCst) + 1;
                    peak.fetch_max(count, Ordering::SeqCst);
                    tokio::time::sleep(std::time::Duration::from_millis(5)).await;
                    active.fetch_sub(1, Ordering::SeqCst);
                    Ok(100 + i as i64)
                }
            },
            |j, persist| {
                if persist {
                    super::super::store(&d, j)?;
                }
                Ok(())
            },
        )
        .await?;
        assert_eq!(peak.load(Ordering::SeqCst), 2);
        assert!(
            super::super::load(&d)?[0]
                .files
                .iter()
                .all(|f| f.file_id.is_some())
        );
        run_files(
            &mut job,
            |_, _, _| async {
                panic!("successful files must not be retried");
                #[allow(unreachable_code)]
                Ok(0)
            },
            |_, _| Ok(()),
        )
        .await?;
        Ok(())
    }
    #[tokio::test]
    async fn failure_stops_new_files_but_keeps_inflight_success() -> Result<()> {
        let dir = tempfile::tempdir()?;
        let mut job = fixture(dir.path());
        let started = Arc::new(AtomicUsize::new(0));
        let result = run_files(
            &mut job,
            |i, _, _| {
                let started = started.clone();
                async move {
                    started.fetch_add(1, Ordering::SeqCst);
                    if i == 0 {
                        anyhow::bail!("offline");
                    }
                    tokio::time::sleep(std::time::Duration::from_millis(5)).await;
                    Ok(101)
                }
            },
            |_, _| Ok(()),
        )
        .await;
        assert!(result.is_err());
        assert_eq!(started.load(Ordering::SeqCst), 2);
        assert_eq!(job.files[1].file_id, Some(101));
        assert!(
            job.files[2..]
                .iter()
                .all(|f| f.file_id.is_none() && f.error.is_empty())
        );
        Ok(())
    }
    #[test]
    fn configuration_persists_only_retained_files_and_rejects_stale_or_invalid_inputs() -> Result<()>
    {
        let dir = tempfile::tempdir()?;
        let mut job = fixture(dir.path());
        job.files[1].file_id = Some(88);
        for (indices, concurrency) in [(vec![], 3), (vec![0, 0], 3), (vec![5], 3), (vec![0], 9)] {
            assert!(super::super::configure_job(&mut job, 0, &indices, concurrency).is_err());
            assert_eq!(job.files.len(), 5);
        }
        super::super::configure_job(&mut job, 0, &[1, 3], 4)?;
        assert_eq!(job.files.len(), 2);
        assert_eq!(job.files[0].file_id, Some(88));
        assert_eq!(job.concurrency, 4);
        assert!(super::super::configure_job(&mut job, 0, &[0], 3).is_err());
        let d = super::super::Desktop::new(dir.path().join("queue"))?;
        super::super::store(&d, &job)?;
        let restored = super::super::load(&d)?.remove(0);
        assert_eq!(restored.files[1].name, "3.mp4");
        assert_eq!(restored.concurrency, 4);
        let mut old = serde_json::to_value(&job)?;
        old.as_object_mut().unwrap().remove("concurrency");
        old.as_object_mut().unwrap().remove("revision");
        let legacy: Job = serde_json::from_value(old)?;
        assert_eq!(legacy.concurrency, 3);
        assert_eq!(legacy.revision, 0);
        Ok(())
    }
}
