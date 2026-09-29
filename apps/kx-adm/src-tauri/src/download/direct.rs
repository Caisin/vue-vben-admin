use super::*;

/// 只保存回报身份和结果，不包含临时地址或令牌。
#[derive(Clone, Serialize, Deserialize)]
pub struct DownloadReceipt {
    pub log_id: i64,
    pub status: String,
    pub bytes: i64,
}

#[derive(Deserialize)]
pub(super) struct DownloadLink {
    pub mode: String,
    pub url: String,
    pub log_id: Option<i64>,
}

impl Desktop {
    pub(super) async fn fetch_download(
        &self,
        session: &Session,
        job: &DownloadJob,
        file: &DownloadFile,
        link: &DownloadLink,
    ) -> Result<reqwest::Response> {
        let response = match link.mode.as_str() {
            "direct" => {
                let url =
                    url::Url::parse(&link.url).map_err(|_| anyhow::anyhow!("下载地址无效"))?;
                ensure!(
                    matches!(url.scheme(), "http" | "https")
                        && url.username().is_empty()
                        && url.password().is_none(),
                    "下载地址无效"
                );
                // 绝不把后台 Bearer/security 头发给对象存储，签名仅存在于这次内存请求。
                self.http
                    .get(url)
                    .send()
                    .await
                    .map_err(|e| anyhow::anyhow!("连接对象存储失败：{}", e.without_url()))?
            }
            "proxy" => {
                let current = self.identity().await?;
                ensure!(
                    current.uid == session.uid && current.api_base == session.api_base,
                    "登录身份已变化"
                );
                let mut request = self
                    .http
                    .get(format!(
                        "{}/api/res/downloads/{}/{}?task_id={}",
                        current.api_base, job.res_id, file.file_id, job.task_id
                    ))
                    .bearer_auth(&current.token)
                    .header("security", "true")
                    .header("x-kx-client", "tauri");
                for (name, value) in self.device.headers(&current.token) {
                    request = request.header(name, value);
                }
                request
                    .send()
                    .await
                    .map_err(|e| anyhow::anyhow!("请求本地存储失败：{}", e.without_url()))?
            }
            _ => anyhow::bail!("不支持的下载模式"),
        };
        if !response.status().is_success()
            || response
                .headers()
                .get(reqwest::header::CONTENT_TYPE)
                .and_then(|v| v.to_str().ok())
                .is_some_and(|v| v.contains("application/json"))
        {
            if link.mode == "direct" {
                anyhow::bail!("对象存储返回 HTTP {}", response.status().as_u16());
            }
            return match protocol::response(response, false).await {
                Err(e) => Err(e).context("下载接口返回错误"),
                Ok(_) => Err(anyhow::anyhow!("下载接口未返回文件内容")),
            };
        }
        Ok(response)
    }
    pub(super) async fn save_download_receipt(
        &self,
        id: &str,
        index: usize,
        receipt: Option<DownloadReceipt>,
    ) -> Result<()> {
        let mut queue = self.download_queue.lock().await;
        queue
            .iter_mut()
            .find(|j| j.id == id)
            .and_then(|j| j.files.get_mut(index))
            .context("下载文件不存在")?
            .pending_receipt = receipt;
        persist(&self.data, &queue)
    }
    pub(super) async fn report_download_receipt(
        &self,
        app: &impl DownloadEvents,
        session: &Session,
        job: &DownloadJob,
        file: &DownloadFile,
        receipt: &DownloadReceipt,
    ) -> Result<()> {
        self.api(app, session, reqwest::Method::POST,
            &format!("/api/res/downloads/{}/{}/receipt", job.res_id, file.file_id),
            Some(&json!({"task_id":job.task_id,"log_id":receipt.log_id,"status":receipt.status,"bytes":receipt.bytes})))
            .await?;
        Ok(())
    }
}
