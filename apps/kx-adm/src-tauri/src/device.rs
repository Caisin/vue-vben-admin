use anyhow::{Result, ensure};
use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
use ring::signature::{Ed25519KeyPair, KeyPair};
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::{io::Write, path::Path};
#[derive(Clone, Serialize)]
pub struct Proof {
    pub device_id: String,
    pub public_key: String,
    pub timestamp: i64,
    pub signature: String,
}
#[derive(Serialize)]
pub struct DeviceInfo {
    pub device_id: String,
    pub name: String,
    pub os: String,
    pub app_version: String,
}
#[derive(Serialize)]
pub struct DingTalkDevice {
    pub proof: Proof,
    pub name: String,
    pub os: String,
    pub app_version: String,
}
pub struct Device {
    id: String,
    key: Ed25519KeyPair,
}
fn digest(data: &[u8]) -> String {
    Sha256::digest(data)
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect()
}
impl Device {
    pub fn load(dir: &Path) -> Result<Self> {
        let uid = machine_uid::get()
            .map_err(|_| anyhow::anyhow!("无法读取系统设备编号，禁止使用临时编号登录"))?;
        Self::load_for_machine(dir, &uid)
    }
    fn load_for_machine(dir: &Path, uid: &str) -> Result<Self> {
        ensure!(!uid.trim().is_empty(), "设备编号为空");
        std::fs::create_dir_all(dir)?;
        let path = dir.join("device-key.pk8");
        if !path.exists() {
            let pkcs = Ed25519KeyPair::generate_pkcs8(&ring::rand::SystemRandom::new())
                .map_err(|_| anyhow::anyhow!("创建设备密钥失败"))?;
            let mut options = std::fs::OpenOptions::new();
            options.write(true).create_new(true);
            #[cfg(unix)]
            {
                use std::os::unix::fs::OpenOptionsExt;
                options.mode(0o600);
            }
            match options.open(&path) {
                Ok(mut f) => {
                    f.write_all(pkcs.as_ref())?;
                    f.sync_all()?;
                }
                Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => {}
                Err(e) => return Err(e.into()),
            }
        }
        let bytes = std::fs::read(path)?;
        let key = Ed25519KeyPair::from_pkcs8(&bytes)
            .map_err(|_| anyhow::anyhow!("设备密钥损坏，请联系管理员重新登记"))?;
        Ok(Self {
            id: digest(format!("kx-adm-device-v1:{uid}").as_bytes()),
            key,
        })
    }
    pub fn info(&self) -> DeviceInfo {
        DeviceInfo {
            device_id: self.id.clone(),
            name: std::env::var("COMPUTERNAME")
                .or_else(|_| std::env::var("HOSTNAME"))
                .unwrap_or_else(|_| "KX ADM".into()),
            os: std::env::consts::OS.into(),
            app_version: env!("CARGO_PKG_VERSION").into(),
        }
    }
    pub fn dingtalk_device(&self, exchange_code: &str) -> DingTalkDevice {
        let info = self.info();
        DingTalkDevice {
            proof: self.proof(exchange_code),
            name: info.name,
            os: info.os,
            app_version: info.app_version,
        }
    }
    pub fn proof(&self, token: &str) -> Proof {
        let timestamp = crate::session::now();
        let message = format!(
            "kx-device-v1\n{}\n{timestamp}\n{}",
            self.id,
            digest(token.as_bytes())
        );
        Proof {
            device_id: self.id.clone(),
            public_key: URL_SAFE_NO_PAD.encode(self.key.public_key().as_ref()),
            timestamp,
            signature: URL_SAFE_NO_PAD.encode(self.key.sign(message.as_bytes()).as_ref()),
        }
    }
    pub fn headers(&self, token: &str) -> std::collections::HashMap<String, String> {
        let p = self.proof(token);
        std::collections::HashMap::from([
            ("x-kx-client".into(), "tauri".into()),
            ("x-kx-device-id".into(), p.device_id),
            ("x-kx-device-public-key".into(), p.public_key),
            ("x-kx-device-time".into(), p.timestamp.to_string()),
            ("x-kx-device-signature".into(), p.signature),
        ])
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn stable_machine_id_and_persisted_key_sign_token() -> Result<()> {
        let dir = std::env::temp_dir().join(format!("kx-device-test-{}", uuid::Uuid::new_v4()));
        let a = Device::load_for_machine(&dir, "fixture-machine")?;
        let b = Device::load_for_machine(&dir, "fixture-machine")?;
        assert_eq!(a.info().device_id, b.info().device_id);
        let proof = a.proof("token");
        assert_eq!(proof.public_key, b.proof("token").public_key);
        assert_ne!(proof.signature, b.proof("other-token").signature);
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            assert_eq!(
                std::fs::metadata(dir.join("device-key.pk8"))?
                    .permissions()
                    .mode()
                    & 0o777,
                0o600
            );
        }
        std::fs::remove_dir_all(dir)?;
        Ok(())
    }
}
