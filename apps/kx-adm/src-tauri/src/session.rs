use anyhow::{Result, ensure};
use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    path::PathBuf,
    sync::Arc,
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tauri::{AppHandle, Emitter};

pub trait SessionEvents: Send + Sync {
    fn updated(&self, session: &Session) -> Result<()>;
    fn cleared(&self, generation: u64) -> Result<()>;
}
impl SessionEvents for AppHandle {
    fn updated(&self, s: &Session) -> Result<()> {
        self.emit_to("main", "desktop-session-updated", s)?;
        Ok(())
    }
    fn cleared(&self, g: u64) -> Result<()> {
        self.emit_to("main", "desktop-session-cleared", g)?;
        Ok(())
    }
}
pub enum Vault {
    System,
    #[cfg(test)]
    Memory(Mutex<Option<String>>),
}
impl Vault {
    async fn credential(&self, value: Option<String>, read: bool) -> Result<Option<String>> {
        match self {
            Self::System => credential(value, read).await,
            #[cfg(test)]
            Self::Memory(v) => {
                let mut v = v.lock().await;
                if read {
                    Ok(v.clone())
                } else {
                    *v = value;
                    Ok(None)
                }
            }
        }
    }
}

use crate::protocol;
use tokio::sync::Mutex;

pub fn now() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Session {
    pub token: String,
    pub uid: String,
    pub expires_at: i64,
    pub api_base: String,
    pub generation: u64,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Bootstrap {
    pub api_base: String,
    pub session: Option<Session>,
}
pub struct Auth {
    pub session: Option<Session>,
    pub base: String,
    pub generation: u64,
}
pub struct Desktop {
    pub vault: Vault,
    pub auth: Mutex<Auth>,
    pub http: reqwest::Client,
    pub data: PathBuf,
    pub queue: Mutex<Vec<crate::queue::Job>>,
    pub active: Mutex<std::collections::HashSet<String>>,
    pub upload_pool: kx_tk_pool::TkPool,
}

async fn credential(value: Option<String>, read: bool) -> Result<Option<String>> {
    tokio::task::spawn_blocking(move || {
        let entry = keyring::Entry::new("com.qinjiu.kx-adm", "upload-session")?;
        if read {
            return match entry.get_password() {
                Ok(v) => Ok(Some(v)),
                Err(keyring::Error::NoEntry) => Ok(None),
                Err(e) => Err(e.into()),
            };
        }
        if let Some(v) = value {
            entry.set_password(&v)?;
        } else {
            match entry.delete_credential() {
                Ok(()) | Err(keyring::Error::NoEntry) => {}
                Err(e) => return Err(e.into()),
            }
        }
        Ok(None)
    })
    .await?
}
fn token_session(token: String, base: String, generation: u64) -> Result<Session> {
    ensure!(token.len() < 32768, "令牌过长");
    let part = token
        .split('.')
        .nth(1)
        .ok_or_else(|| anyhow::anyhow!("令牌格式无效"))?;
    let value: Value = serde_json::from_slice(&URL_SAFE_NO_PAD.decode(part)?)?;
    let uid = value["uid"]
        .as_i64()
        .filter(|v| *v > 0)
        .ok_or_else(|| anyhow::anyhow!("令牌身份无效"))?;
    Ok(Session {
        token,
        uid: uid.to_string(),
        expires_at: value["exp"]
            .as_i64()
            .ok_or_else(|| anyhow::anyhow!("令牌有效期无效"))?,
        api_base: base,
        generation,
    })
}
impl Desktop {
    pub fn new(data: PathBuf) -> Result<Arc<Self>> {
        std::fs::create_dir_all(&data)?;
        let base = std::fs::read_to_string(data.join("server.txt"))
            .ok()
            .and_then(|v| protocol::server(&v).ok())
            .unwrap_or_else(|| "http://localhost:8883".into());
        let jobs = crate::queue::load(&data)?;
        Ok(Arc::new(Self {
            vault: Vault::System,
            auth: Mutex::new(Auth {
                session: None,
                base,
                generation: 0,
            }),
            http: reqwest::Client::builder()
                .redirect(reqwest::redirect::Policy::none())
                .connect_timeout(Duration::from_secs(20))
                .timeout(Duration::from_secs(60))
                .build()?,
            data,
            queue: Mutex::new(jobs),
            active: Mutex::new(Default::default()),
            upload_pool: kx_tk_pool::TkPool::new(8),
        }))
    }
    pub async fn bootstrap(&self) -> Result<Bootstrap> {
        let mut a = self.auth.lock().await;
        if a.generation == 0 && !self.data.join("session-disabled").exists() {
            if let Some(v) = self.vault.credential(None, true).await? {
                let mut s: Session = serde_json::from_str(&v)?;
                if s.api_base == a.base {
                    s.generation = 1;
                    a.session = Some(s);
                }
            }
            a.generation = 1;
        }
        a.generation = a.generation.max(1);
        Ok(Bootstrap {
            api_base: a.base.clone(),
            session: a.session.clone(),
        })
    }
    async fn send(
        &self,
        s: &Session,
        method: reqwest::Method,
        path: &str,
        body: Option<&Value>,
    ) -> Result<Value> {
        let mut req = self
            .http
            .request(method, format!("{}{path}", s.api_base))
            .bearer_auth(&s.token)
            .header("security", "true");
        if let Some(body) = body {
            req = req
                .header("content-type", "application/json")
                .body(kx_ed::KxEd::en(&serde_json::to_vec(body)?).await?);
        }
        protocol::response(
            req.send()
                .await
                .map_err(|_| anyhow::anyhow!("无法连接服务"))?,
            true,
        )
        .await
    }
    async fn save(&self, app: &impl SessionEvents, a: &mut Auth, s: Session) -> Result<Session> {
        self.vault
            .credential(Some(serde_json::to_string(&s)?), false)
            .await?;
        if self.data.join("session-disabled").exists() {
            std::fs::remove_file(self.data.join("session-disabled"))?;
        }
        a.generation = s.generation;
        a.session = Some(s.clone());
        app.updated(&s)?;
        Ok(s)
    }
    async fn refresh_locked(&self, app: &impl SessionEvents, a: &mut Auth) -> Result<Session> {
        let s = a
            .session
            .clone()
            .ok_or_else(|| anyhow::anyhow!("请先登录并同步桌面会话"))?;
        let result = self
            .send(&s, reqwest::Method::POST, "/auth/user/refresh_token", None)
            .await;
        let body = match result {
            Ok(v) => v,
            Err(e) => {
                if e.to_string() == "unauthorized" {
                    self.clear_locked(app, a).await?;
                }
                return Err(e);
            }
        };
        let token = body["access_token"]
            .as_str()
            .ok_or_else(|| anyhow::anyhow!("刷新响应无效"))?;
        let next = token_session(token.into(), a.base.clone(), a.generation + 1)?;
        ensure!(next.uid == s.uid, "刷新身份不一致");
        self.save(app, a, next).await
    }
    pub async fn refresh(
        &self,
        app: &impl SessionEvents,
        expected: Option<String>,
    ) -> Result<Session> {
        let mut a = self.auth.lock().await;
        if let Some(s) = &a.session
            && expected.as_ref().is_some_and(|t| *t != s.token)
        {
            return Ok(s.clone());
        }
        self.refresh_locked(app, &mut a).await
    }
    pub async fn import(&self, app: &impl SessionEvents, token: String) -> Result<Session> {
        let mut a = self.auth.lock().await;
        let s = token_session(token, a.base.clone(), a.generation + 1)?;
        self.send(&s, reqwest::Method::GET, "/auth/user/user_info", None)
            .await?;
        if a.session.as_ref().is_some_and(|old| old.uid != s.uid) {
            self.pause_all().await?;
        }
        self.save(app, &mut a, s).await
    }
    async fn clear_locked(&self, app: &impl SessionEvents, a: &mut Auth) -> Result<()> {
        // 先使内存身份失效，即便系统凭据库暂时不可用也不继续上传。
        a.session = None;
        a.generation += 1;
        app.cleared(a.generation)?;
        std::fs::write(self.data.join("session-disabled"), b"logged-out")?;
        self.pause_all().await?;
        self.vault.credential(None, false).await?;
        Ok(())
    }
    pub async fn clear(&self, app: &impl SessionEvents) -> Result<()> {
        self.clear_locked(app, &mut *self.auth.lock().await).await
    }
    pub async fn configure(&self, app: &impl SessionEvents, base: String) -> Result<()> {
        let base = protocol::server(&base)?;
        let mut a = self.auth.lock().await;
        self.clear_locked(app, &mut a).await?;
        std::fs::write(self.data.join("server.txt"), &base)?;
        a.base = base;
        Ok(())
    }
    pub async fn identity(&self) -> Result<Session> {
        self.auth
            .lock()
            .await
            .session
            .clone()
            .ok_or_else(|| anyhow::anyhow!("请先登录并同步桌面会话"))
    }
    pub async fn api(
        &self,
        app: &impl SessionEvents,
        identity: &Session,
        method: reqwest::Method,
        path: &str,
        body: Option<&Value>,
    ) -> Result<Value> {
        let mut a = self.auth.lock().await;
        let s = a
            .session
            .clone()
            .ok_or_else(|| anyhow::anyhow!("登录已退出，任务已暂停"))?;
        ensure!(
            s.uid == identity.uid && s.api_base == identity.api_base,
            "登录身份已变化，任务已暂停"
        );
        let s = if s.expires_at <= now() + 60 {
            self.refresh_locked(app, &mut a).await?
        } else {
            s
        };
        let result = self.send(&s, method.clone(), path, body).await;
        if result
            .as_ref()
            .is_err_and(|e| e.to_string() == "unauthorized")
        {
            let s = self.refresh_locked(app, &mut a).await?;
            return self.send(&s, method, path, body).await;
        }
        result
    }
    pub async fn tick(&self, app: &impl SessionEvents) {
        let mut a = self.auth.lock().await;
        if a.session
            .as_ref()
            .is_some_and(|s| s.expires_at <= now() + 60)
        {
            let _ = self.refresh_locked(app, &mut a).await;
        }
    }
}

#[cfg(test)]
mod tests;
