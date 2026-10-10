use super::*;
use std::io::{Read, Seek, SeekFrom};

impl Bundle {
    pub(super) async fn open(path: &Path) -> Result<Self> {
        let path = path.to_owned();
        // gzip/文件操作在阻塞线程执行；匿名临时文件随句柄关闭自动清理。
        let (file, metadata) = tauri::async_runtime::spawn_blocking(move || -> Result<_> {
            let input = std::fs::File::open(path)?;
            ensure!(input.metadata()?.is_file(), "请选择发行包文件");
            let mut archive = flate2::read::MultiGzDecoder::new(input);
            let size = header(&mut archive, b"release.json")?;
            ensure!((1..=65536).contains(&size), "发行包元信息大小无效");
            let mut bytes = vec![0; size as usize];
            archive
                .read_exact(&mut bytes)
                .context("发行包元信息不完整")?;
            let metadata: Metadata = serde_json::from_slice(&bytes).context("发行包元信息无效")?;
            validate(&metadata)?;
            padding(&mut archive, size)?;
            let size = header(&mut archive, b"installer")?;
            ensure!(
                size > 0 && size <= i64::MAX as u64 && size == metadata.size,
                "发行包长度不完整"
            );
            let mut file = tempfile::tempfile()?;
            ensure!(
                std::io::copy(&mut (&mut archive).take(size), &mut file)? == size,
                "发行包安装文件不完整"
            );
            padding(&mut archive, size)?;
            let mut end = [0; 1024];
            archive
                .read_exact(&mut end)
                .context("发行包缺少 tar 结束块")?;
            ensure!(end.iter().all(|v| *v == 0), "发行包包含额外文件");
            // 读到 EOF 才完成 gzip CRC 校验，同时拒绝拼接的非零内容。
            let mut tail = [0; 8192];
            let mut trailing = 0;
            loop {
                let count = archive.read(&mut tail)?;
                if count == 0 {
                    break;
                }
                trailing += count;
                ensure!(
                    trailing <= 1024 * 1024 && tail[..count].iter().all(|v| *v == 0),
                    "发行包包含额外内容"
                );
            }
            file.seek(SeekFrom::Start(0))?;
            Ok((file, metadata))
        })
        .await??;
        let modified = file.metadata()?.modified()?;
        Ok(Self {
            file: tokio::fs::File::from_std(file),
            metadata,
            modified,
        })
    }
    pub(super) async fn unchanged(&self) -> Result<()> {
        let info = self.file.metadata().await?;
        ensure!(
            info.len() == self.metadata.size && info.modified()? == self.modified,
            "上传期间安装包发生变化，请重新选择"
        );
        Ok(())
    }
}

fn validate(metadata: &Metadata) -> Result<()> {
    ensure!(
        regex::Regex::new(r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$")?
            .is_match(&metadata.version),
        "发行包版本号无效"
    );
    ensure!(
        metadata.notes.chars().count() <= 10000
            && !metadata.signature.trim().is_empty()
            && metadata.signature.len() <= 4096,
        "发行说明或签名无效"
    );
    ensure!(
        !metadata.name.is_empty()
            && !metadata.name.contains(['/', '\\'])
            && metadata.name.len() <= 255,
        "安装包文件名无效"
    );
    let valid = match metadata.target.as_str() {
        "darwin-aarch64" | "darwin-x86_64" => metadata.name.ends_with(".app.tar.gz"),
        "windows-x86_64" | "windows-aarch64" | "windows-i686" => {
            metadata.name.ends_with(".exe") || metadata.name.ends_with(".msi")
        }
        "linux-x86_64" | "linux-aarch64" | "linux-armv7" => metadata.name.ends_with(".AppImage"),
        _ => false,
    };
    ensure!(valid, "安装包格式与平台不匹配");
    Ok(())
}

fn header(reader: &mut impl Read, name: &[u8]) -> Result<u64> {
    let mut bytes = [0; 512];
    reader
        .read_exact(&mut bytes)
        .context("请选择完整的 .tgz 发行包")?;
    let header = tar::Header::from_byte_slice(&bytes);
    let checksum: u32 = bytes
        .iter()
        .enumerate()
        .map(|(i, value)| {
            if (148..156).contains(&i) {
                32
            } else {
                u32::from(*value)
            }
        })
        .sum();
    ensure!(
        header.cksum()? == checksum
            && &bytes[257..263] == b"ustar\0"
            && matches!(bytes[156], 0 | b'0')
            && header.path_bytes().as_ref() == name
            && bytes[157..257].iter().all(|v| *v == 0)
            && bytes[345..500].iter().all(|v| *v == 0),
        "发行包 tar 结构无效"
    );
    Ok(header.size()?)
}
fn padding(reader: &mut impl Read, size: u64) -> Result<()> {
    let mut bytes = vec![0; ((512 - size % 512) % 512) as usize];
    reader.read_exact(&mut bytes)?;
    ensure!(bytes.iter().all(|v| *v == 0), "发行包 tar 填充无效");
    Ok(())
}
