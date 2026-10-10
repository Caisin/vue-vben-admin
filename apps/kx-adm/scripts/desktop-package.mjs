#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import {
  access,
  copyFile,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tauri = join(app, 'src-tauri');
const release = join(app, 'scripts/desktop-release.mjs');
const help = `用法：./build-desktop-release.sh [选项]
Windows：build-desktop-release.cmd [选项]

  --version 0.1.2        同步版本号；省略则使用当前版本
  --notes "更新说明"      更新说明；默认使用“版本 <版本号>”
  --key /path/key        原有 Tauri 更新签名私钥路径
  --password "密码"      签名私钥密码；优先于密码环境变量，支持空字符串
  --out-dir /path        输出目录；默认项目根目录 dist/kx-adm
  --help                显示帮助

密钥也可使用 TAURI_SIGNING_PRIVATE_KEY_PATH 或 TAURI_SIGNING_PRIVATE_KEY。
省略 --password 时使用 TAURI_SIGNING_PRIVATE_KEY_PASSWORD。
脚本仅构建本机平台，自动验证签名并生成 .tgz，不上传或发布。
输出目录同时保留 macOS 的 .dmg 或 Windows 的 .exe 安装包。
需要已安装 pnpm、Rust、Tauri 系统依赖及 web 的项目依赖。`;

function run(command, args, env, capture = false) {
  const result = spawnSync(command, args, {
    cwd: tauri,
    env,
    encoding: 'utf8',
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  });
  if (result.error || result.status !== 0) {
    // 不回显环境变量或原始构建输出，避免错误信息携带签名私钥。
    throw new Error(
      `${command === process.execPath ? '发行步骤' : command} 执行失败（${result.status ?? '无法启动'}）`,
    );
  }
  return result.stdout ?? '';
}

async function currentArtifact(
  directory,
  suffix,
  started,
  requireSignature = false,
) {
  const candidates = [];
  for (const name of await readdir(directory)) {
    if (!name.endsWith(suffix)) continue;
    const path = join(directory, name);
    const info = await stat(path);
    if (!info.isFile() || info.size === 0 || info.mtimeMs < started - 1000)
      continue;
    if (requireSignature) {
      const signature = await stat(`${path}.sig`).catch(() => undefined);
      if (!signature?.isFile() || signature.mtimeMs < started - 1000) continue;
    }
    candidates.push(path);
  }
  if (candidates.length !== 1)
    throw new Error(
      `本次构建应生成一个${requireSignature ? '带签名的' : ''} ${suffix} 包，实际找到 ${candidates.length} 个：${directory}`,
    );
  return candidates[0];
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--help') {
    console.warn(help);
    return;
  }
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i];
    const value = args[i + 1];
    if (
      !['--key', '--notes', '--out-dir', '--password', '--version'].includes(
        key,
      ) ||
      value === undefined ||
      key in options
    )
      throw new Error(`参数无效：${key}；使用 --help 查看用法`);
    options[key] = value;
  }
  const config = JSON.parse(
    await readFile(join(tauri, 'tauri.conf.json'), 'utf8'),
  );
  const version = options['--version'] ?? config.version;
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version))
    throw new Error('请输入正式版本号，例如 0.1.2');
  const notes = options['--notes'] ?? `版本 ${version}`;
  if ([...notes].length > 10_000) throw new Error('更新说明不能超过 10000 字');
  const env = { ...process.env };
  // 密码仅通过环境交给签名构建，不拼入子进程命令或写入发行包。
  if (options['--password'] !== undefined)
    env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD = options['--password'];
  const keyPath = options['--key'] ?? env.TAURI_SIGNING_PRIVATE_KEY_PATH;
  if (keyPath) {
    env.TAURI_SIGNING_PRIVATE_KEY_PATH = resolve(keyPath);
    await access(env.TAURI_SIGNING_PRIVATE_KEY_PATH);
  } else if (!env.TAURI_SIGNING_PRIVATE_KEY) {
    throw new Error(
      '请通过 --key 指定原有签名私钥，或设置 TAURI_SIGNING_PRIVATE_KEY_PATH',
    );
  }
  const host = run('rustc', ['-vV'], env, true).match(/^host: (\S+)$/m)?.[1];
  const match = host?.match(
    /^(aarch64|x86_64|i686|armv7)[^-]*-(apple-darwin|pc-windows-msvc|unknown-linux-(?:gnu|musl).*)$/,
  );
  if (!match) throw new Error(`不支持的本机构建目标：${host ?? '未知'}`);
  const arch = match[1];
  let platform = 'linux';
  if (host.includes('apple-darwin')) platform = 'darwin';
  else if (host.includes('windows')) platform = 'windows';
  const target = `${platform}-${arch}`;
  const bundle = { darwin: 'app,dmg', windows: 'nsis', linux: 'appimage' }[
    platform
  ];
  const suffix = { darwin: '.app.tar.gz', windows: '.exe', linux: '.AppImage' }[
    platform
  ];
  // Cargo metadata 尊重 .cargo/config 与 CARGO_TARGET_DIR，不猜测 target 所在目录。
  const metadata = JSON.parse(
    run(
      'cargo',
      ['metadata', '--locked', '--no-deps', '--format-version', '1'],
      env,
      true,
    ),
  );
  const bundleRoot = join(metadata.target_directory, host, 'release', 'bundle');
  const bundleDir = join(
    bundleRoot,
    { darwin: 'macos', windows: 'nsis', linux: 'appimage' }[platform],
  );
  const outDir = resolve(
    options['--out-dir'] ?? join(app, '../../..', 'dist/kx-adm'),
  );
  const output = join(outDir, `Qinjiu-${version}-${target}.tgz`);
  await mkdir(outDir, { recursive: true });
  // 预检通过后才修改项目版本，构建失败保留新版本供修复后重试。
  if (options['--version'])
    run(process.execPath, [release, 'version', version], env);
  run(process.execPath, [release, 'check'], env);
  console.warn(`开始构建 ${version} · ${target}`);
  const started = Date.now();
  run(
    process.execPath,
    [release, 'build', '--target', host, '--bundles', bundle],
    env,
  );
  // 不误选旧产物；更新包与安装包均要求来自本次构建。
  const artifact = await currentArtifact(bundleDir, suffix, started, true);
  let installer;
  let installerOutput;
  if (platform === 'darwin') {
    installer = await currentArtifact(join(bundleRoot, 'dmg'), '.dmg', started);
    installerOutput = join(outDir, `Qinjiu-${version}-${target}.dmg`);
  } else if (platform === 'windows') {
    installer = artifact;
    installerOutput = join(outDir, `Qinjiu-${version}-${target}.exe`);
  }
  const temporary = await mkdtemp(join(outDir, '.kx-desktop-release-'));
  try {
    const notesFile = join(temporary, 'notes.txt');
    const staged = join(temporary, 'release.tgz');
    await writeFile(notesFile, notes);
    run(
      process.execPath,
      [release, 'bundle', staged, notesFile, target, artifact],
      env,
    );
    // 保留 Cargo 原产物；复制完成后再替换安装包，最后落盘更新包。
    if (installer && installerOutput) {
      const stagedInstaller = join(temporary, 'installer');
      await copyFile(installer, stagedInstaller);
      await rename(stagedInstaller, installerOutput);
    }
    await rename(staged, output);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
  console.warn(`完成。后台上传此文件：\n${output}`);
  if (installerOutput) console.warn(`独立安装包：\n${installerOutput}`);
}

await main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
