use serde::Serialize;

pub const IMAGE_ENV_NAME: &str = "IMG_OPEN_AI_KEY";
pub const IMAGE_BASE_URL: &str = "https://sub2api.qinjiu8.com/";

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ImageEnvStatus {
    pub available: bool,
    pub variable_name: &'static str,
    pub base_url: &'static str,
    pub message: String,
}

fn status_for(value: Option<&str>) -> ImageEnvStatus {
    let available = value.is_some_and(|value| !value.trim().is_empty());
    let message = if available {
        format!("已检测到 {IMAGE_ENV_NAME}，可以使用 GPT 原生 image_gen。")
    } else {
        format!(
            "未获取到 {IMAGE_ENV_NAME}，请从 {IMAGE_BASE_URL} 复制 key，设置环境变量后重启电脑再试。"
        )
    };
    ImageEnvStatus {
        available,
        variable_name: IMAGE_ENV_NAME,
        base_url: IMAGE_BASE_URL,
        message,
    }
}

pub fn env_status() -> ImageEnvStatus {
    status_for(
        std::env::var_os(IMAGE_ENV_NAME)
            .as_deref()
            .and_then(|value| value.to_str()),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reports_missing_variable_with_restart_guidance() {
        let status = status_for(None);
        assert!(!status.available);
        assert_eq!(status.variable_name, IMAGE_ENV_NAME);
        assert_eq!(status.base_url, IMAGE_BASE_URL);
        assert!(status.message.contains("设置环境变量"));
        assert!(status.message.contains("重启电脑"));
    }

    #[test]
    fn ignores_empty_values_and_never_returns_the_key() {
        let status = status_for(Some("  "));
        assert!(!status.available);
        let status = status_for(Some("secret-value"));
        assert!(status.available);
        assert!(
            !serde_json::to_string(&status)
                .expect("status serializes")
                .contains("secret-value")
        );
    }
}
