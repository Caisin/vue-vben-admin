use anyhow::{Context, Result, ensure};
use serde::Serialize;
#[cfg(target_family = "unix")]
use std::os::unix::fs::PermissionsExt;
use std::path::PathBuf;

pub const IMAGE_ENV_NAME: &str = "IMG_OPEN_AI_KEY";
pub const IMAGE_BASE_URL: &str = "https://sub2api.qinjiu8.com/";
const MAX_KEY_BYTES: usize = 4096;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ImageEnvStatus {
    pub available: bool,
    pub variable_name: &'static str,
    pub base_url: &'static str,
    pub config_path: String,
    pub message: String,
}

fn config_path() -> Result<PathBuf> {
    #[cfg(target_os = "windows")]
    {
        let root = std::env::var_os("APPDATA")
            .or_else(|| {
                std::env::var_os("USERPROFILE")
                    .map(|v| PathBuf::from(v).join("AppData/Roaming").into_os_string())
            })
            .context("无法确定 Windows 用户配置目录")?;
        return Ok(PathBuf::from(root).join("kx-adm/image-gen.ps1"));
    }
    #[cfg(not(target_os = "windows"))]
    {
        let home = std::env::var_os("HOME").context("无法确定用户目录")?;
        Ok(PathBuf::from(home).join(".config/kx-adm/image-gen.env"))
    }
}

fn key_available(value: Option<&str>) -> bool {
    value.is_some_and(|value| !value.trim().is_empty())
}

fn config_available(path: &PathBuf) -> bool {
    std::fs::read_to_string(path)
        .map(|value| value.contains(IMAGE_ENV_NAME) && !value.trim().is_empty())
        .unwrap_or(false)
}

fn status_for(value: Option<&str>, path: &PathBuf) -> ImageEnvStatus {
    let available = key_available(value) || config_available(path);
    let message = if available {
        format!("已检测到 {IMAGE_ENV_NAME} 或 Skill 配置文件，可以使用 GPT 原生 image_gen。")
    } else {
        format!(
            "未获取到 {IMAGE_ENV_NAME}，请从 {IMAGE_BASE_URL} 复制 key，保存 Skill 配置后重试。"
        )
    };
    ImageEnvStatus {
        available,
        variable_name: IMAGE_ENV_NAME,
        base_url: IMAGE_BASE_URL,
        config_path: path.to_string_lossy().into_owned(),
        message,
    }
}

pub fn env_status() -> ImageEnvStatus {
    let path = config_path().unwrap_or_else(|_| PathBuf::from("~/.config/kx-adm/image-gen.env"));
    status_for(
        std::env::var_os(IMAGE_ENV_NAME)
            .as_deref()
            .and_then(|value| value.to_str()),
        &path,
    )
}

fn validate_key(value: &str) -> Result<&str> {
    let value = value.trim();
    ensure!(!value.is_empty(), "IMG_OPEN_AI_KEY 不能为空");
    ensure!(value.len() <= MAX_KEY_BYTES, "IMG_OPEN_AI_KEY 长度无效");
    ensure!(!value.contains('\0'), "IMG_OPEN_AI_KEY 包含无效字符");
    Ok(value)
}

#[cfg(not(target_os = "windows"))]
fn shell_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\\''"))
}

#[cfg(target_os = "windows")]
fn powershell_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "''"))
}

fn config_contents(key: &str) -> String {
    #[cfg(target_os = "windows")]
    {
        return format!(
            "# Managed by KX ADM.\n$env:{IMAGE_ENV_NAME} = {}\n",
            powershell_quote(key)
        );
    }
    #[cfg(not(target_os = "windows"))]
    format!(
        "# Managed by KX ADM.\nexport {IMAGE_ENV_NAME}={}\n",
        shell_quote(key)
    )
}

fn write_config(path: &PathBuf, key: &str) -> Result<()> {
    let parent = path.parent().context("配置文件目录无效")?;
    std::fs::create_dir_all(parent).context("无法创建 Skill 配置目录")?;
    let temporary = path.with_extension("tmp");
    std::fs::write(&temporary, config_contents(key)).context("无法写入 Skill 配置文件")?;
    #[cfg(target_family = "unix")]
    {
        let mut permissions = std::fs::metadata(&temporary)?.permissions();
        permissions.set_mode(0o600);
        std::fs::set_permissions(&temporary, permissions)?;
    }
    match std::fs::rename(&temporary, path) {
        Ok(()) => {}
        #[cfg(target_os = "windows")]
        Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {
            std::fs::remove_file(path).context("无法替换 Skill 配置文件")?;
            std::fs::rename(&temporary, path).context("无法保存 Skill 配置文件")?;
        }
        Err(error) => return Err(error).context("无法保存 Skill 配置文件"),
    }
    Ok(())
}

/// 保存供下载 Skill source 的本机配置文件，并同步当前桌面进程。
/// key 不会返回给前端，也不会写入日志或 Skill 压缩包。
pub fn set_env(value: &str) -> Result<ImageEnvStatus> {
    let key = validate_key(value)?;
    let path = config_path()?;
    write_config(&path, key)?;
    unsafe { std::env::set_var(IMAGE_ENV_NAME, key) };
    Ok(status_for(Some(key), &path))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn missing_status_points_to_config_without_secret() {
        let path = PathBuf::from("/tmp/kx-image-gen.env");
        let status = status_for(None, &path);
        assert!(!status.available);
        assert_eq!(status.variable_name, IMAGE_ENV_NAME);
        assert_eq!(status.base_url, IMAGE_BASE_URL);
        assert_eq!(status.config_path, "/tmp/kx-image-gen.env");
        assert!(status.message.contains("保存 Skill 配置"));
    }

    #[test]
    fn ignores_empty_values_and_never_returns_the_key() {
        let path = PathBuf::from("/tmp/kx-image-gen.env");
        let status = status_for(Some("  "), &path);
        assert!(!status.available);
        let status = status_for(Some("secret-value"), &path);
        assert!(status.available);
        assert!(
            !serde_json::to_string(&status)
                .expect("status serializes")
                .contains("secret-value")
        );
    }

    #[test]
    fn validates_key_and_generates_a_sourceable_file() {
        assert!(validate_key("  ").is_err());
        assert!(validate_key("a\0b").is_err());
        assert_eq!(validate_key("  secret-value  ").unwrap(), "secret-value");
        assert!(config_contents("secret-value").contains(IMAGE_ENV_NAME));
        assert!(config_contents("secret-value").contains("secret-value"));
    }
}
