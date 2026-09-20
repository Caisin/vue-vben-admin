# KX ADM 桌面端

Tauri 2 桌面壳复用 kx-adm 页面，支持整剧目录后台扫描、上传、分集登记和令牌自动续期。此目录是独立 Rust workspace，通过 hekx registry 依赖 kx-ed，不使用父仓本地路径；Web 仍可独立构建。

## 运行

在 web 仓库根目录执行：

```sh
rtk proxy pnpm --filter @kx/adm tauri:dev
rtk proxy pnpm --filter @kx/adm tauri:build
```

需要配置可访问的 Cargo `hekx` registry（kx-ed 依赖来自该 registry），以及 Rust、项目要求的 Node/pnpm 和操作系统的 Tauri 编译依赖：macOS 的 Xcode Command Line Tools；Windows 的 MSVC 工具链与 WebView2；Linux 的 WebKitGTK 4.1、GTK、AppIndicator 开发/运行环境。正式发布的签名和公证使用部署环境提供的凭据，本仓不包含签名密钥。

## 使用

先在“存储设置 → 业务模块 → 剧视频存储”指定专用 Storage；未配置不能上传，独立于文件分享等默认存储。更换配置不迁移已有视频，旧队列需重新扫描创建任务。

1. 登录页展开“桌面端服务连接”，填写 API 服务完整前缀，例如 `https://example.com/api`。远程服务使用 HTTPS；开发允许本机 HTTP。
2. 页面正常登录，当前 Bearer token 自动保存至主窗口 localStorage。上传窗口可“同步当前登录”。服务端当前没有独立 refresh token：原生使用 Bearer 调用 refresh_token 换新，并推送到页面和 localStorage。
3. 资源管理 → 短剧 → 版本与内容 → 整剧目录上传，使用已配置的剧视频存储并选择当前版本目录；每个版本选择自己的目录，不能把多版本父目录混作一个版本。
4. 检查扫描清单的集数、标题；无法识别的集数需手动填写，重复集数不能提交。设置“同时上传集数”（1–8，默认 3），确认后原生通过 kx-tk-pool 并发上传，后台任务将视频登记到指定版本。
5. 可暂停和重试，已完成文件复用。登记冲突不会覆盖已有分集，需要在版本内容中处理冲突再重试。

扫描包含子目录、跳过符号链接，仅接收 mp4/mov/m4v/webm/avi/mpeg/mpg；每批最多 1000 个视频、目录深度最多 20。命名可用 `第01集`、`EP01`、`S01E02` 或单数字文件名。服务端文件路径固定为所选存储的 `upload_dir/res/{资源ID}/versions/{版本ID}/{md5}`。

关闭上传弹窗不影响任务；关闭主窗口隐藏到托盘，托盘可重新打开或退出。退出应用后队列恢复为暂停，未完成的单个文件需重传；不是分块断点续传。已上传文件 ID 和服务端任务编号保存在应用数据目录，不保存明文 token。退出登录或更换账号会暂停旧队列，只有原服务与原 UID 可以继续。

本地存储受服务端请求大小限制，单视频需小于 511 MB；大视频请选择支持直传的对象存储。Tauri 通过受保护的后端 native-prepare 接口获取 S3 配置，使用 OpenDAL 直传；对象存储请求使用 S3 签名，不携带系统 Bearer。配置和密钥只在原生内存中使用，不保存进任务文件或发送给 WebView。源视频在上传期间不要移动或修改。

后端需包含资源版本及目录上传接口、RES m000004 的 `res.video_directory_import` 执行器并启用任务运行时；Auth refresh_token 必须允许在刷新窗口内校验已过期的 access token。

## TikTok 原生 API 批量预约发布

登录 KX 后从左侧“TikTok → 发布工作台”进入。账号保存到 KX 后端数据库，同一 KX 用户跨设备共享；上传和预约使用本机 API 客户端，没有官网入口或隐藏网页窗口。

1. 在多行文本域粘贴完整 Cookie，可选填来源浏览器 User-Agent。原生直接请求用户信息，返回有效 UID 后登录成功。输入不做格式或重复名称校验，保留重复项和顺序，仅适配 `Cookie:` 前缀与分行粘贴。
2. 支持多账号选择、修改备注、更新 Cookie 与停用。Cookie 加密保存在后端，不使用系统钥匙串。旧本机账号可点击“迁移旧账号”，保存成功后才清除旧 localStorage；退出当前会话不删除云端账号。
3. 选择目录，勾选视频并安排发布时间。支持 MP4/MOV/WebM、子目录、最多 50 个文件、单个最多 30 GB。原生按 8 MiB 分片直传并校验 CRC32，不将整个视频载入网页内存。
4. 保存预约计划，检查账号、描述、时间和可见范围后确认提交。时间至少提前 15 分钟、按 5 分钟对齐，最远 10 天。上传耗时导致时间过期时保留 Vid 并提示调整，不转成立即发布。
5. 音乐版权和内容检测默认关闭；可逐条开启并保存计划，开启后等待结果通过才预约。检测失败、发现问题或超过 15 分钟会停止队列；暂停可中断等待，重试复用上传素材并重新检测。
6. 同时上传视频数可设为 1–8，默认 3，由 `kx-tk-pool` 控制。上传、合并、VOD 提交和预约都是 Rust HTTP 请求；清单按 KX 用户和 TikTok 账号分别归档。已上传素材可复用，未完成分片不跨重启续传。

新版菜单和账号接口需后端完成 `cookie_mgr:m000004_tiktok_accounts` 与 `adm:m000070_tiktok_studio` 迁移，再刷新权限。视频概览展示当前清单的状态、上传字节和预约分布，可点击状态筛选并预览源视频。
6. 已预约条目显示平台视频 ID。网络超时或缺失回执的结果未知项必须先核对，录入已预约的视频 ID，或确认未预约后重试。暂停停止后续操作，已发出的预约请求仍等待回执；移除本地清单不取消远端预约。

预约接口按 2026-09-19 官网 HAR 改为 `/tiktok/web/project/post/v1/` 与 `post_type: 3`，补齐视频编辑元数据，保留数字来源枚举。错误回执显示平台说明和请求编号。抓包时预约请求被拦截，尚未取得真实账号的原生预约成功回执；网页动态签名与 ticket-guard 的原生兼容性仍未验证。接口如要求额外签名或触发风控，会显示失败，不回退网页操作。

## 开发验证

```sh
rtk proxy cargo test --manifest-path apps/kx-adm/src-tauri/Cargo.toml --lib
rtk proxy cargo clippy --manifest-path apps/kx-adm/src-tauri/Cargo.toml --all-targets -- -D warnings
rtk proxy pnpm exec vitest run --dom apps/kx-adm/src/desktop/index.test.ts
rtk proxy pnpm --filter @kx/adm build:desktop
rtk proxy pnpm --filter @kx/adm exec tauri build --debug --bundles app
```

最后一个命令用于 macOS 本地 `.app` 验证。自动测试使用临时目录、内存会话和 loopback HTTP，不访问真实账号或业务存储。发布前另行验证各平台登录恢复、目录选择、托盘恢复与生产对象存储。

原生业务 API 客户端直接使用 `reqwest::Client`；请求 JSON 通过 `kx_ed::KxEd::en` 加密，响应通过 `KxEd::de` 解密，桌面端不再维护独立加解密算法。

每个目录卡片显示对应版本、源目录名、目标目录、上传字节进度、成功/失败集数和累计耗时，每集也记录耗时。目录耗时按实际上传工作时间计，不叠加并发分集耗时，不包含暂停停机时间。全部目录共享最多 8 个在途文件，同版本同时只能执行一个目录任务。暂停等待在途分集结束，后续集停止启动。

版本与内容 → 播放预览：每个版本提供独立播放列表，每页 50 集；可点选集数、上一集/下一集、自动下一集，并重新加载失效的播放地址。服务端补齐新视频的 Content-Type / inline 元数据；旧对象通过签名 GET 覆盖视频 MIME 与播放 disposition，无需重传。浏览器不支持的编码仍需另行转码。

对象存储上传参考 management-platform-web 的 S3 Operator 构建方式，支持 endpoint、bucket、region、virtual-host、AccessKey 和 SessionToken。视频使用 OpenDAL writer 写入，缓冲块 8 MiB，每文件内部并发为 1，总文件并发由 tk-pool 管理；大文件可通过 S3 multipart 上传。仍需升级 ADM 并执行 m000068 的原生上传权限增量。

## 维护上传目录

选择目录后自动进入可编辑清单；可以修改目录显示名、并发数、分集序号和标题，或移除不需要上传的条目，点击“保存修改”持久化。运行中的任务先暂停并等待在途分集结束；已提交服务端登记的分集请在版本内容页维护。移除目录只删除本地任务记录，不删除本地视频或服务器文件。

“收起明细”只显示目录总进度、大小、数量、耗时和状态，展开状态会保存。草稿与后台进度分开管理，刷新不会覆盖正在编辑的清单。存储配置变化且目录尚无成功文件时，可以点击“使用当前存储”保留扫描清单继续上传。

S3 Endpoint 支持完整 HTTPS 地址或纯域名（自动补 HTTPS），AWS 默认 Endpoint 可由 region 生成。相对路径、URL 内的账号密码和查询参数会显示明确错误。

## 登录信息保存

KX 登录信息保存在主窗口 localStorage（键 `kx-adm.desktop-session.v1`），包含服务地址和登录 token，不保存登录密码。原生端只持有内存副本，重启后从 localStorage 读取并向当前服务验证；过期 token 先走服务端刷新窗口，不能本地延长有效期。退出登录或切换服务地址清除缓存，后台轮换的新 token 自动写回。

应用不再调用系统钥匙串，不会为读取旧凭据请求授权。旧版只存于钥匙串的会话不会自动迁移，升级后需重新登录一次；此后正常启动会恢复 KX localStorage 会话。TikTok Cookie 改由 KX 后端数据库加密保存，按所选账号加载到原生内存，不写入 KX token 缓存。Linux 不再要求 Secret Service。
