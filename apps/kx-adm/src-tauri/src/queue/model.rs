use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::{
    path::PathBuf,
    time::{Instant, SystemTime, UNIX_EPOCH},
};
pub fn default_concurrency() -> usize {
    3
}
pub fn millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}
#[derive(Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Timing {
    pub elapsed_ms: u64,
    pub started_at: Option<u64>,
    pub finished_at: Option<u64>,
    pub active: bool,
    #[serde(skip)]
    pub clock: Option<Instant>,
}
impl Timing {
    pub fn start(&mut self) {
        if self.clock.is_none() {
            self.clock = Some(Instant::now());
            self.started_at.get_or_insert(millis());
            self.finished_at = None;
            self.active = true;
        }
    }
    pub fn checkpoint(&mut self) {
        if let Some(clock) = self.clock {
            self.elapsed_ms = self
                .elapsed_ms
                .saturating_add(clock.elapsed().as_millis() as u64);
            self.clock = Some(Instant::now());
        }
    }
    pub fn stop(&mut self, completed: bool) {
        self.checkpoint();
        self.clock = None;
        self.active = false;
        if completed {
            self.finished_at = Some(millis());
        }
    }
    pub fn snapshot(&self) -> Self {
        let mut value = self.clone();
        value.checkpoint();
        value
    }
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Item {
    #[serde(default)]
    pub timing: Timing,
    #[serde(default)]
    pub content_type: String,
    pub relative: String,
    pub seq: i32,
    pub title: String,
    pub size: u64,
    pub modified: u64,
    pub file_id: Option<String>,
    pub status: String,
    pub error: String,
    pub bytes: u64,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Job {
    #[serde(default)]
    pub timing: Timing,
    #[serde(default = "default_concurrency")]
    pub concurrency: usize,
    #[serde(default)]
    pub version_name: String,
    pub id: String,
    pub api_base: String,
    pub uid: String,
    pub res: String,
    pub version: String,
    pub storage: String,
    pub local_storage: bool,
    pub root: PathBuf,
    pub name: String,
    pub status: String,
    pub error: String,
    pub items: Vec<Item>,
    pub import_id: Option<String>,
}
impl Job {
    pub fn view(&self) -> Value {
        let mut v = serde_json::to_value(self).unwrap();
        v.as_object_mut().unwrap().remove("root");
        v["timing"] = serde_json::to_value(self.timing.snapshot()).unwrap();
        for (value, item) in v["items"]
            .as_array_mut()
            .unwrap()
            .iter_mut()
            .zip(&self.items)
        {
            value["timing"] = serde_json::to_value(item.timing.snapshot()).unwrap();
        }
        v["snapshotAt"] = json!(millis());
        v["targetDirectory"] = json!(format!("res/{}/versions/{}/", self.res, self.version));
        v
    }
    pub(super) fn base(&self) -> String {
        format!("/adm/res/{}/versions/{}", self.res, self.version)
    }
}
#[derive(Deserialize)]
pub struct Edit {
    pub seq: i32,
    pub title: String,
}
