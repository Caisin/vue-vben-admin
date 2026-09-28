use anyhow::{Context, Result, ensure};
use std::{
    io::ErrorKind,
    path::{Path, PathBuf},
};

pub(super) fn target_path(directory: &Path, name: &str) -> Result<PathBuf> {
    ensure!(
        !name.is_empty() && name != "." && name != ".." && !name.contains(['/', '\\', ':']),
        "本地文件名无效"
    );
    Ok(directory.join(name))
}

pub(super) async fn existing_file(path: &Path) -> Result<Option<u64>> {
    match tokio::fs::symlink_metadata(path).await {
        Ok(meta) => {
            ensure!(
                meta.file_type().is_file(),
                "目标路径不是普通文件，请检查下载目录"
            );
            Ok(Some(meta.len()))
        }
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(None),
        Err(error) => Err(error).context("检查本地文件失败"),
    }
}

/// 返回 true 表示本次写入成功，false 表示下载期间目标出现，已保留目标。
pub(super) async fn install(temp: &Path, target: &Path, overwrite: bool) -> Result<bool> {
    if overwrite {
        existing_file(target).await?;
        tokio::fs::rename(temp, target)
            .await
            .context("替换本地文件失败")?;
        return Ok(true);
    }
    // 同目录 hard-link 的创建是原子的，不存在先检查再 rename 的覆盖窗口。
    match tokio::fs::hard_link(temp, target).await {
        Ok(()) => Ok(true),
        Err(error) if error.kind() == ErrorKind::AlreadyExists => {
            existing_file(target).await?;
            Ok(false)
        }
        Err(error) => Err(error).context("保存本地文件失败"),
    }
}
