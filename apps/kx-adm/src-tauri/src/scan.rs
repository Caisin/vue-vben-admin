use crate::queue::Item;
use anyhow::{Result, ensure};
use std::path::Path;

pub fn episode(name: &str) -> Option<i32> {
    // 明确集数优先；多个普通数字（例如日期、清晰度）不猜测。
    for pattern in [
        r"(?i)s\d+e(\d+)",
        r"第\s*(\d+)\s*集",
        r"(?i)(?:ep|e)\s*(\d+)",
    ] {
        let re = regex::Regex::new(pattern).unwrap();
        if let Some(c) = re.captures(name) {
            return c[1].parse().ok().filter(|n| *n > 0);
        }
    }
    let re = regex::Regex::new(r"\d+").unwrap();
    let nums: Vec<_> = re.find_iter(name).collect();
    if nums.len() == 1 {
        nums[0].as_str().parse().ok().filter(|n| *n > 0)
    } else {
        None
    }
}
pub fn scan(root: &Path) -> Result<Vec<Item>> {
    ensure!(root.is_dir() && !root.is_symlink(), "请选择普通目录");
    let root = root.canonicalize()?;
    let mut items = Vec::new();
    for (count, entry) in walkdir::WalkDir::new(&root)
        .follow_links(false)
        .max_depth(20)
        .into_iter()
        .enumerate()
    {
        ensure!(count < 100_000, "目录文件过多，请选择单部剧目录");
        let entry = entry.map_err(|_| anyhow::anyhow!("目录中有无法读取的文件"))?;
        if !entry.file_type().is_file() {
            continue;
        }
        let path = entry.path();
        let ext = path
            .extension()
            .and_then(|v| v.to_str())
            .unwrap_or("")
            .to_ascii_lowercase();
        if !["mp4", "mov", "m4v", "webm", "avi", "mpeg", "mpg"].contains(&ext.as_str()) {
            continue;
        }
        ensure!(items.len() < 1000, "一部剧最多支持 1000 个视频");
        let metadata = entry.metadata()?;
        let title = path
            .file_stem()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();
        items.push(Item {
            timing: Default::default(),
            content_type: mime_guess::from_path(path)
                .first_or_octet_stream()
                .essence_str()
                .into(),
            relative: path.strip_prefix(&root)?.to_string_lossy().to_string(),
            seq: episode(&title).unwrap_or(0),
            title,
            size: metadata.len(),
            modified: crate::queue::modified(&metadata),
            file_id: None,
            status: "待确认".into(),
            error: String::new(),
            bytes: 0,
        });
    }
    items.sort_by(|a, b| natord::compare(&a.relative, &b.relative));
    ensure!(!items.is_empty(), "目录中没有支持的视频");
    Ok(items)
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn numbering() {
        assert_eq!(episode("第02集"), Some(2));
        assert_eq!(episode("S01E09"), Some(9));
        assert_eq!(episode("EP12"), Some(12));
        assert_eq!(episode("02"), Some(2));
        assert_eq!(episode("2025-01-1080p"), None);
        assert_eq!(episode("预告"), None);
    }
    #[test]
    fn scan_does_not_follow_symlinks() {
        let root = std::env::temp_dir().join(uuid::Uuid::new_v4().to_string());
        std::fs::create_dir(&root).unwrap();
        std::fs::write(root.join("10.mp4"), b"video").unwrap();
        std::fs::write(root.join("2.mp4"), b"video").unwrap();
        std::fs::write(root.join("note.txt"), b"text").unwrap();
        #[cfg(unix)]
        std::os::unix::fs::symlink(root.join("2.mp4"), root.join("3.mp4")).unwrap();
        let files = scan(&root).unwrap();
        assert_eq!(files.len(), 2);
        assert_eq!(files[0].seq, 2);
        std::fs::remove_dir_all(root).unwrap();
    }
}
