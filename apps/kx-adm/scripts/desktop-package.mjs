#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import {
  access,
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

  --version 0.1.2        同步版本号；省略则使用当前版本
  --notes "更新说明"      更新说明；默认使用“版本 <版本号>”
  --key /path/key        原有 Tauri 更新签名私钥路径
  --out-dir /path        输出目录；默认项目根目录 dist/kx-adm
  --help                显示帮助

密钥也可使用 TAURI_SIGNING_PRIVATE_KEY_PATH 或 TAURI_SIGNING_PRIVATE_KEY。
加密私钥的密码使用 TAURI_SIGNING_PRIVATE_KEY_PASSWORD。
脚本仅构建本机平台，自动验证签名并生成 .kx-update，不上传或发布。
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

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.warn(help);
    return;
  }
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i];
    const value = args[i + 1];
    if (
      !['--key', '--notes', '--out-dir', '--version'].includes(key) ||
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
  const bundle = { darwin: 'app', windows: 'nsis', linux: 'appimage' }[
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
  const bundleDir = join(
    metadata.target_directory,
    host,
    'release',
    'bundle',
    { darwin: 'macos', windows: 'nsis', linux: 'appimage' }[platform],
  );
  const outDir = resolve(
    options['--out-dir'] ?? join(app, '../../..', 'dist/kx-adm'),
  );
  const output = join(outDir, `kx-adm-${version}-${target}.kx-update`);
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
  const candidates = [];
  for (const name of await readdir(bundleDir)) {
    if (!name.endsWith(suffix)) continue;
    const path = join(bundleDir, name);
    const info = await stat(path);
    const signature = await stat(`${path}.sig`).catch(() => undefined);
    // 不误选输出目录中的旧版本；允许文件系统一秒的时间精度误差。
    if (
      info.isFile() &&
      info.size > 0 &&
      info.mtimeMs >= started - 1000 &&
      signature?.isFile() &&
      signature.mtimeMs >= started - 1000
    )
      candidates.push(path);
  }
  if (candidates.length !== 1)
    throw new Error(
      `本次构建应生成一个带签名的 ${suffix} 包，实际找到 ${candidates.length} 个：${bundleDir}`,
    );
  const temporary = await mkdtemp(join(outDir, '.kx-desktop-release-'));
  try {
    const notesFile = join(temporary, 'notes.txt');
    const staged = join(temporary, 'release.kx-update');
    await writeFile(notesFile, notes);
    run(
      process.execPath,
      [release, 'bundle', staged, notesFile, target, candidates[0]],
      env,
    );
    // bundle 校验成功后才替换输出，失败不会留下一个看似可上传的半成品。
    await rename(staged, output);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
  console.warn(`完成。后台上传此文件：\n${output}`);
}

await main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
