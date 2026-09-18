use super::*;
impl Desktop {
    pub(super) async fn upload_one(
        self: &Arc<Self>,
        app: &impl UploadEvents,
        identity: &Session,
        job: &Job,
        index: usize,
    ) -> Result<()> {
        self.running(&job.id).await?;
        self.change(app, &job.id, |j| {
            j.timing.start();
            let item = &mut j.items[index];
            item.timing.start();
            item.status = "计算校验值".into();
            item.bytes = 0;
            item.error.clear();
        })
        .await?;
        let result = self.upload(app, identity, job, index).await;
        self.change(app, &job.id, |j| {
            let item = &mut j.items[index];
            item.timing.stop(result.is_ok());
            match &result {
                Ok(file_id) => {
                    item.file_id = Some(file_id.clone());
                    item.status = "上传成功".into();
                    item.bytes = item.size;
                }
                Err(error) => {
                    item.status = "上传失败".into();
                    item.error = error.to_string();
                }
            }
        })
        .await?;
        result.map(|_| ())
    }
    async fn upload(
        self: &Arc<Self>,
        app: &impl UploadEvents,
        identity: &Session,
        job: &Job,
        index: usize,
    ) -> Result<String> {
        let item = &job.items[index];
        let content_type = mime_guess::from_path(&item.relative)
            .first_or_octet_stream()
            .essence_str()
            .to_owned();
        let path = job.root.join(&item.relative);
        // 扫描后再次校验：目录不可替换成指向外部的符号链接，文件不可静默变化。
        ensure!(
            job.root.canonicalize()? == job.root
                && path.canonicalize()?.starts_with(&job.root)
                && !path.is_symlink(),
            "文件路径发生变化，请重新扫描"
        );
        let mut file = tokio::fs::File::open(&path).await?;
        let metadata = file.metadata().await?;
        ensure!(
            metadata.len() == item.size && modified(&metadata) == item.modified,
            "文件发生变化，请重新扫描"
        );
        let mut hash = md5::Context::new();
        let mut buffer = vec![0; 1024 * 1024];
        loop {
            self.running(&job.id).await?;
            let n = file.read(&mut buffer).await?;
            if n == 0 {
                break;
            }
            hash.consume(&buffer[..n]);
        }
        let md5 = format!("{:x}", hash.finalize());
        let mut body = json!({"file_name":path.file_stem().unwrap_or_default().to_string_lossy(),"file_ext":path.extension().unwrap_or_default().to_string_lossy().to_ascii_lowercase(),"size":item.size,"md5_hash":md5});
        let base = format!("{}/files/{}", job.base(), job.storage);
        self.change(app, &job.id, |j| {
            j.items[index].status = "正在上传".into();
            j.items[index].content_type = content_type.clone();
        })
        .await?;
        let result = if job.local_storage {
            let stream = tokio_util::io::ReaderStream::new(tokio::fs::File::open(&path).await?);
            let app_copy = app.clone();
            let progress_owner = self.clone();
            let job_id = job.id.clone();
            let mut bytes = 0u64;
            let mut last = std::time::Instant::now();
            let stream = stream.then(move |chunk| {
                let checkpoint = match &chunk {
                    Ok(chunk) => {
                        bytes += chunk.len() as u64;
                        let due = last.elapsed() >= Duration::from_secs(1);
                        if due {
                            last = std::time::Instant::now();
                        }
                        due
                    }
                    Err(_) => false,
                };
                let owner = progress_owner.clone();
                let app = app_copy.clone();
                let id = job_id.clone();
                let current = bytes;
                async move {
                    if checkpoint {
                        owner
                            .change(&app, &id, |j| {
                                j.items[index].bytes = current.min(j.items[index].size);
                            })
                            .await
                            .map_err(|_| std::io::Error::other("上传进度保存失败"))?;
                    }
                    chunk
                }
            });
            let client = reqwest::Client::builder()
                .redirect(reqwest::redirect::Policy::none())
                .connect_timeout(Duration::from_secs(20))
                .timeout(Duration::from_secs(7200))
                .build()?;

            ensure!(
                item.size < 512 * 1024 * 1024 - 1024 * 1024,
                "本地存储单文件须小于 511 MB，大文件请选择对象存储"
            );
            // 先完成可能的刷新，再取得最新 token。仅向绑定的 API 地址发送 Bearer。
            self.api(
                app,
                identity,
                reqwest::Method::GET,
                "/auth/user/user_info",
                None,
            )
            .await?;
            let s = self.identity().await?;
            ensure!(
                s.uid == identity.uid && s.api_base == identity.api_base,
                "登录身份已变化"
            );
            let part = reqwest::multipart::Part::stream_with_length(
                reqwest::Body::wrap_stream(stream),
                item.size,
            )
            .file_name(
                path.file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string(),
            )
            .mime_str(&content_type)?;
            let response = client
                .post(format!("{}{base}/upload", s.api_base))
                .bearer_auth(&s.token)
                .multipart(reqwest::multipart::Form::new().part("file", part))
                .send()
                .await
                .map_err(|_| anyhow::anyhow!("上传连接失败，可重试"))?;
            let v = protocol::response(response, false).await?;
            v[0].clone()
        } else {
            let p = self
                .api(
                    app,
                    identity,
                    reqwest::Method::POST,
                    &format!("{base}/native-prepare"),
                    Some(&body),
                )
                .await?;
            if p["upload_required"] == false {
                return id_value(&p["file"]["file"]["file_id"]);
            }
            let config: S3UploadConfig = serde_json::from_value(p["config"].clone())
                .map_err(|_| anyhow::anyhow!("原生上传配置不完整，请检查剧视频存储"))?;
            let key = p["key"]
                .as_str()
                .ok_or_else(|| anyhow::anyhow!("原生上传对象路径无效"))?;
            ensure!(
                key.ends_with(&md5) && !key.split('/').any(|v| v == ".."),
                "原生上传对象路径无效"
            );
            let mime = p["content_type"]
                .as_str()
                .filter(|v| v.starts_with("video/"))
                .ok_or_else(|| anyhow::anyhow!("服务端未提供有效视频 Content-Type"))?;
            let disposition = p["content_disposition"]
                .as_str()
                .filter(|v| v.starts_with("inline"))
                .ok_or_else(|| anyhow::anyhow!("服务端未提供视频播放元数据"))?;
            let operator = config.operator()?;
            let mut writer = operator
                .writer_with(key)
                .content_type(mime)
                .content_disposition(disposition)
                .chunk(8 * 1024 * 1024)
                .concurrent(1)
                .await
                .map_err(storage_error)?;
            let transfer = async {
                let mut source = tokio::fs::File::open(&path).await?;
                let mut buffer = vec![0; 1024 * 1024];
                let mut bytes = 0_u64;
                let mut last = std::time::Instant::now();
                loop {
                    let n = source.read(&mut buffer).await?;
                    if n == 0 {
                        break;
                    }
                    writer
                        .write(buffer[..n].to_vec())
                        .await
                        .map_err(storage_error)?;
                    bytes += n as u64;
                    if last.elapsed() >= Duration::from_secs(1) {
                        self.change(app, &job.id, |j| {
                            j.items[index].bytes = bytes.min(item.size)
                        })
                        .await?;
                        last = std::time::Instant::now();
                    }
                }
                ensure!(bytes == item.size, "上传期间文件大小发生变化，请重新扫描");
                writer.close().await.map_err(storage_error)?;
                Ok::<_, anyhow::Error>(())
            }
            .await;
            if let Err(error) = transfer {
                let _ = writer.abort().await;
                return Err(error);
            }
            body["key"] = p["key"].clone();
            // Multipart ETag 不等于文件 MD5；后端按存储对象大小/MIME和目标 key 验证完成。
            body["etag"] = Value::Null;
            self.api(
                app,
                identity,
                reqwest::Method::POST,
                &format!("{base}/complete"),
                Some(&body),
            )
            .await?
        };
        let after = tokio::fs::metadata(path).await?;
        ensure!(
            after.len() == item.size && modified(&after) == item.modified,
            "上传期间文件发生变化，请重新扫描"
        );
        id_value(&result["file"]["file_id"])
    }
}

#[derive(serde::Deserialize)]
struct S3UploadConfig {
    endpoint: String,
    bucket: String,
    region: String,
    enable_virtual_host: bool,
    access_key_id: String,
    secret_access_key: String,
    session_token: String,
}
impl S3UploadConfig {
    fn operator(&self) -> Result<opendal::Operator> {
        protocol::server(&self.endpoint)?;
        ensure!(
            !self.bucket.is_empty()
                && !self.region.is_empty()
                && !self.access_key_id.is_empty()
                && !self.secret_access_key.is_empty(),
            "S3 上传配置缺少必需字段"
        );
        let http = reqwest::Client::builder()
            .redirect(reqwest::redirect::Policy::none())
            .connect_timeout(Duration::from_secs(20))
            .timeout(Duration::from_secs(120))
            .build()?;
        let mut s3 = opendal::services::S3::default()
            .endpoint(&self.endpoint)
            .bucket(&self.bucket)
            .region(&self.region)
            .access_key_id(&self.access_key_id)
            .secret_access_key(&self.secret_access_key);
        if !self.session_token.is_empty() {
            s3 = s3.session_token(&self.session_token);
        }
        if self.enable_virtual_host {
            s3 = s3.enable_virtual_host_style();
        }
        Ok(opendal::Operator::new(s3)
            .map_err(storage_error)?
            .layer(opendal::layers::HttpClientLayer::new(
                opendal::raw::HttpClient::with(http),
            ))
            .finish())
    }
}
fn storage_error(error: opendal::Error) -> anyhow::Error {
    anyhow::anyhow!(
        "S3 上传失败：{}",
        crate::protocol::safe_message(&error.to_string())
    )
}
