# 客户端版本发布与更新

KX ADM 使用 Tauri updater 更新整个客户端，包含网页资源和 Rust 原生能力。首个支持更新的版本为 0.1.1：用户需先手动安装此版本，以后可在客户端内升级。应用数据目录和设备标识保持原位置。

## 后台管理

后端安装包含 `adm_client:m000001_client_releases` 和 `adm:m000090_client_releases`。正常执行 ADM 安装迁移后，在管理端刷新权限，进入“系统管理 → 客户端版本”。列表权限只允许查询；维护草稿、发布、撤回由独立按钮权限控制。

1. 创建版本草稿，填写正式版本号和更新说明。
2. 为目标系统添加安装包 HTTPS 地址，选择对应的 `.sig` 文件；也可导入发行脚本生成的 JSON 清单。每个平台只提供一个包。
3. 确认地址可公开下载且不会过期，验证安装包后点击“发布”。
4. 有问题的版本点击“撤回”。已安装的客户端不会降级，修复时发布更高版本。

已发布、已撤回版本的内容不可修改。草稿支持编辑和删除，并校验修订号防止覆盖其他人的修改。后台不托管二进制，安装包应放到静态服务器或 CDN；不要填写临时签名地址、需要登录的下载页或 GitHub Release HTML 页面。

## 客户端行为

启动和每小时检查一次更新；所有桌面用户均可通过右下角“检查客户端更新”手动检查，登录页也可使用。自动检查遇到离线不会弹出错误；手动检查显示具体失败原因。发现版本后提示更新说明，由用户确认下载、验签、安装和重启。

请先保存编辑内容。上传、下载或 TikTok 预约仍在执行时拒绝更新，包括已点击暂停但在途文件尚未结束的情况。更新持有原生执行锁，在结束前不能启动这些任务。下载结束后再次检查发行信息，已撤回、服务地址变更或最新发行改变会停止安装并提示重新检查。已发出的安装过程不承诺远程撤回生效。

更新端点由当前服务完整 API 前缀追加 `/adm/client-updates/{{target}}/{{arch}}/{{current_version}}`，必须为 HTTPS。无更新返回 204；有更新返回 Tauri JSON，响应禁用缓存。端点公开且明文，不需要业务 token，客户端不向包服务器转发登录凭据。客户端只信任随应用打包的固定公钥，不从后端读取公钥。

## 构建与签名

在 `web` 根目录执行。发布脚本遵循项目现有 Cargo 依赖布局；先准备项目 Rust、Node/pnpm 及系统 Tauri 构建依赖。

```sh
rtk proxy pnpm --filter @kx/adm desktop:release version 0.1.2
rtk proxy pnpm --filter @kx/adm desktop:release check
rtk proxy env TAURI_SIGNING_PRIVATE_KEY_PATH=/secure/path/updater.key pnpm --filter @kx/adm desktop:release build
```

`version` 同步 package.json、Cargo.toml、Cargo.lock 和 tauri.conf.json；`build` 检查版本与公钥一致并使用 `--locked`。默认启用 `createUpdaterArtifacts`。也可由 CI 注入 `TAURI_SIGNING_PRIVATE_KEY`；加密私钥同时注入 `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`。不要在命令行传私钥内容，也不要把私钥加入仓库。

`updater.pub` 和 `tauri.conf.json` 保存相同的公开密钥。私钥由发布负责人离线备份，丢失后不能为已安装客户端签发新更新；不得重新生成公钥替换现有密钥后继续宣称兼容升级。更新签名和操作系统代码签名是两套机制：macOS 正式发行仍需 Developer ID 签名/公证，Windows 按发行策略配置代码签名。

每个平台在对应构建机上运行上述脚本，可额外传 `--target` 和 `--bundles`：

| 系统 | 更新平台值 | 更新文件 |
| --- | --- | --- |
| macOS Apple Silicon | darwin-aarch64 | `.app.tar.gz` 和 `.sig` |
| macOS Intel | darwin-x86_64 | `.app.tar.gz` 和 `.sig` |
| Windows x64/ARM64/x86 | windows-x86_64 / windows-aarch64 / windows-i686 | NSIS `.exe` 或 MSI `.msi` 和 `.sig` |
| Linux x64/ARM64/ARMv7 | linux-x86_64 / linux-aarch64 / linux-armv7 | `.AppImage` 和 `.sig` |

macOS 通用包可给两个架构填写同一份包/签名。Linux 使用 AppImage，不支持通过此流程更新 deb/rpm；构建机的 glibc 与 WebKitGTK 环境需兼容目标系统。Windows 推荐 NSIS，并保持安装方式一致。不能用 macOS 的构建通过替代 Windows/Linux 的安装验证。

## 发行清单

先将签名包上传到稳定 HTTPS 地址，准备更新说明文本文件；生成清单时读取相邻 `.sig`，使用内置公钥验证实际文件及签名，拒绝文件被修改或签名来自其它密钥。命令路径相对 `apps/kx-adm`，绝对路径也可用。

```sh
rtk proxy pnpm --filter @kx/adm desktop:release manifest /tmp/release.json /tmp/notes.txt darwin-aarch64 '/path/to/KX ADM.app.tar.gz' 'https://downloads.example.com/kx-adm/0.1.2/KX%20ADM.app.tar.gz'
```

可继续追加多组“平台、文件、地址”。将生成的清单导入后台草稿，再人工确认发布。脚本不会上传安装包或自动发布。

## 升级验收

使用独立测试服务发布比当前客户端高的版本，检查自动提示、下载进度、重启和实际版本号；同时验证登录恢复、设备授权、上传/下载清单恢复。至少覆盖无更新、离线、错误签名、撤回、并发编辑、运行任务时拒绝安装及空闲时成功安装。

本机 macOS 调试打包可验证 updater 产物生成，不能替代生产签名、公证或跨平台实际升级。
