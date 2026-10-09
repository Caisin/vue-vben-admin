# 客户端版本发布与更新

KX ADM 使用 Tauri updater 更新整个客户端，包含网页资源和 Rust 原生能力。首个支持更新的版本为 0.1.1：用户需先手动安装此版本，以后可在客户端内升级。应用数据目录和设备标识保持原位置。

## 后台管理

后端安装包含 `adm_client:m000001_client_releases` 和 `adm:m000090_client_releases`。正常执行 ADM 安装迁移后，在管理端刷新权限，进入“系统管理 → 客户端版本”。列表权限只允许查询；维护草稿、发布、撤回由独立按钮权限控制。

1. 创建版本草稿，填写正式版本号和更新说明。
2. 选择系统 storage，上传发行脚本生成的单个 `.kx-update` 文件。页面自动读取版本、说明、平台和签名，将原始安装包上传 storage，无需单独上传校验文件。多个平台分别上传同版本发行包。
3. 验证安装包后点击“发布”；旧版 HTTPS 发行清单仍可导入。
4. 有问题的版本点击“撤回”。已安装的客户端不会降级，修复时发布更高版本。

已发布、已撤回版本的内容不可修改。草稿支持编辑和删除，并校验修订号防止覆盖其他人的修改。新上传的安装包由系统 storage 托管，发行记录持久保存文件 ID；客户端通过登录保护的发行下载接口读取，不保存临时签名地址。此接口仅允许读取已发布版本引用的文件，支持本地和对象存储。历史外部 HTTPS 地址继续支持。

## 客户端行为

登录后和每小时检查一次更新；所有桌面用户均可通过右下角“检查客户端更新”手动检查，登录页不检查更新也不显示更新入口，登录成功后才检查。自动检查遇到离线不会弹出错误；手动检查显示具体失败原因。发现版本后提示更新说明，由用户确认下载、验签、安装和重启。

请先保存编辑内容。上传、下载或 TikTok 预约仍在执行时拒绝更新，包括已点击暂停但在途文件尚未结束的情况。更新持有原生执行锁，在结束前不能启动这些任务。下载结束后再次检查发行信息，已撤回、服务地址变更或最新发行改变会停止安装并提示重新检查。已发出的安装过程不承诺远程撤回生效。

更新端点由当前服务完整 API 前缀追加 `/adm/client-updates/{{target}}/{{arch}}/{{current_version}}`，必须为 HTTPS。无更新返回 204；有更新返回 Tauri JSON，响应禁用缓存。端点仅登录可用且保持明文；客户端携带登录令牌和设备证明检查更新，通过 `x-kx-update-base` 提供当前完整 HTTPS API 地址以生成同源发行下载链接。新上传包走同源受保护下载接口，外部历史包不携带登录凭据。检查与下载均禁止重定向。旧匿名更新客户端需要手动安装新客户端一次。客户端只信任随应用打包的固定公钥，不从后端读取公钥。

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

## 一键构建发行包

项目根目录提供可直接执行的 `build-desktop-release.sh`：

```sh
rtk proxy ./build-desktop-release.sh --version 0.1.2 --notes "修复更新与下载管理" --key /secure/path/updater.key --password '私钥密码'
```

如果已配置 `TAURI_SIGNING_PRIVATE_KEY_PATH` 或 `TAURI_SIGNING_PRIVATE_KEY`，可以省略 `--key`。`--password` 优先于 `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`；省略参数则沿用环境变量，显式 `--password ''` 传入空密码。脚本通过环境将密码传给构建子进程，不写入发行包。省略 `--version` 使用项目当前版本，省略 `--notes` 使用默认版本说明。

脚本自动同步版本、签名构建本机平台、定位 Cargo 实际产物目录，并验证签名后生成根目录 `dist/kx-adm/kx-adm-<版本>-<平台>.kx-update`；可通过 `--out-dir` 改输出目录。临时文件在同一输出目录清理，打包成功后才替换同名产物。构建失败或只有旧产物时直接报错，不生成可上传文件；版本同步后构建失败会保留新版本，修复后重新执行即可。

macOS 使用 app 更新包、Windows 使用 NSIS、Linux 使用 AppImage。各平台在本机构建机执行；Windows 在 CMD 或 PowerShell 中使用根目录的 `build-desktop-release.cmd`，无需 Git Bash。需要预先安装 web 项目依赖、pnpm、Rust 与对应 Tauri 系统构建依赖。脚本不上传或发布版本。

Windows 示例（项目根目录执行，CMD 与 PowerShell 均适用）：

```powershell
.\build-desktop-release.cmd --version 0.1.2 --notes "修复更新与下载管理" --key "C:\keys\updater.key" --password "私钥密码"
```

Windows 构建机需要 Node.js、pnpm、Rust MSVC 工具链、Visual Studio Build Tools 的“使用 C++ 的桌面开发”与 Windows SDK；安装 web 依赖后再运行脚本。脚本根据 Rust host 自动选择 x64、ARM64 或 x86，构建 NSIS `.exe` 并生成 `dist\kx-adm\kx-adm-<版本>-windows-<架构>.kx-update`。版本同步兼容 Git 在 Windows 检出时使用的 CRLF 换行。

## 单文件发行包

构建仍生成签名，但上传操作不再单独选择 `.sig`。在构建机执行：

```sh
rtk proxy pnpm --filter @kx/adm desktop:release bundle /tmp/release.kx-update /tmp/notes.txt darwin-aarch64 '/path/to/KX ADM.app.tar.gz'
```

脚本验证安装包和相邻签名后，把有界元信息和原始安装包合为一个 `.kx-update` 文件。后台选择此文件即可上传。签名私钥仍只在构建机；更新客户端保留固定公钥验签。后台升级需要 `adm:m000096_release_download_ux` 以补齐发行存储选项权限。

## 旧版发行清单

先将签名包上传到稳定 HTTPS 地址，准备更新说明文本文件；生成清单时读取相邻 `.sig`，使用内置公钥验证实际文件及签名，拒绝文件被修改或签名来自其它密钥。命令路径相对 `apps/kx-adm`，绝对路径也可用。

```sh
rtk proxy pnpm --filter @kx/adm desktop:release manifest /tmp/release.json /tmp/notes.txt darwin-aarch64 '/path/to/KX ADM.app.tar.gz' 'https://downloads.example.com/kx-adm/0.1.2/KX%20ADM.app.tar.gz'
```

可继续追加多组“平台、文件、地址”。将生成的清单导入后台草稿，再人工确认发布。脚本不会上传安装包或自动发布。

## 升级验收

使用独立测试服务发布比当前客户端高的版本，检查自动提示、下载进度、重启和实际版本号；同时验证登录恢复、设备授权、上传/下载清单恢复。至少覆盖无更新、离线、错误签名、撤回、并发编辑、运行任务时拒绝安装及空闲时成功安装。

本机 macOS 调试打包可验证 updater 产物生成，不能替代生产签名、公证或跨平台实际升级。
