import { Buffer } from 'node:buffer';
import { spawnSync } from 'node:child_process';
import { createReadStream, createWriteStream } from 'node:fs';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import process from 'node:process';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

import { verifyDesktopArtifact } from './verify-desktop-artifact.mjs';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tauriDir = resolve(app, 'src-tauri');
const json = async (path) => JSON.parse(await readFile(path, 'utf8'));
const configPath = resolve(tauriDir, 'tauri.conf.json');
const packagePath = resolve(app, 'package.json');
const cargoPath = resolve(tauriDir, 'Cargo.toml');
const lockPath = resolve(tauriDir, 'Cargo.lock');
const [command, ...args] = process.argv.slice(2);
const config = await json(configPath);
const pkg = await json(packagePath);
const cargo = await readFile(cargoPath, 'utf8');
const cargoVersion = cargo.match(/^version = "([^"]+)"/m)?.[1];
const fail = (text) => {
  throw new Error(text);
};
function run(bin, args, env = process.env) {
  const result = spawnSync(bin, args, {
    cwd: app,
    stdio: 'inherit',
    env,
    shell: process.platform === 'win32',
  });
  if (result.error || result.status !== 0) fail(`${bin} 执行失败`);
}
if (command === 'version') {
  const version = args[0];
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version ?? ''))
    fail('请输入正式版本号，例如 0.1.1');
  config.version = version;
  pkg.version = version;
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
  await writeFile(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);
  await writeFile(
    cargoPath,
    cargo.replace(/^version = "[^"]+"/m, `version = "${version}"`),
  );
  const lock = await readFile(lockPath, 'utf8');
  await writeFile(
    lockPath,
    lock.replace(
      /(name = "kx-adm-desktop"\r?\nversion = ")[^"]+"/,
      `$1${version}"`,
    ),
  );
  console.warn(`桌面版本已同步为 ${version}`);
} else {
  if (config.version !== pkg.version || config.version !== cargoVersion)
    fail('Tauri、Cargo、package 版本不一致，请先运行 desktop:release version');
  const publicText = await readFile(resolve(tauriDir, 'updater.pub'), 'utf8');
  const publicKey = publicText.trim();
  if (config.plugins?.updater?.pubkey !== publicKey)
    fail('updater.pub 与客户端配置公钥不一致');
  if (command === 'build') {
    const keyPath = process.env.TAURI_SIGNING_PRIVATE_KEY_PATH;
    const key = keyPath
      ? await readFile(keyPath, 'utf8')
      : process.env.TAURI_SIGNING_PRIVATE_KEY;
    if (!key)
      fail(
        '请设置 TAURI_SIGNING_PRIVATE_KEY_PATH 或 TAURI_SIGNING_PRIVATE_KEY',
      );
    // 各平台使用原生构建机；额外参数可指定 --target / --bundles。
    run('pnpm', ['exec', 'tauri', 'build', '--ci', ...args, '--', '--locked'], {
      ...process.env,
      TAURI_SIGNING_PRIVATE_KEY: key,
    });
  } else if (command === 'bundle') {
    const [output, notesFile, target, file] = args;
    if (!output || !notesFile || !target || !file)
      fail('bundle <输出.kx-update> <说明.txt> <平台> <安装包路径>');
    if (resolve(output) === resolve(file)) fail('输出不能覆盖安装包');
    if (
      !/^(darwin-(aarch64|x86_64)|windows-(x86_64|aarch64|i686)|linux-(x86_64|aarch64|armv7))$/.test(
        target,
      )
    )
      fail('平台无效');
    const signatureText = await readFile(`${file}.sig`, 'utf8');
    const signature = signatureText.trim();
    const fileInfo = await stat(file);
    if (!fileInfo.isFile() || fileInfo.size === 0) fail('更新包不存在或为空');
    await verifyDesktopArtifact(file, signature, publicKey);
    const metadata = Buffer.from(
      JSON.stringify({
        version: config.version,
        notes: await readFile(notesFile, 'utf8'),
        target,
        name: basename(file),
        signature,
        size: fileInfo.size,
      }),
    );
    if (metadata.length > 65_536) fail('发行说明过长');
    const header = Buffer.alloc(12);
    header.write('KXUPDATE');
    header.writeUInt32LE(metadata.length, 8);
    await writeFile(output, Buffer.concat([header, metadata]));
    await pipeline(
      createReadStream(file),
      createWriteStream(output, { flags: 'a' }),
    );
    console.warn(`发行包已保存：${output}；在后台直接上传此文件。`);
  } else if (command === 'manifest') {
    // 参数每组三项：平台、实际包路径、上传后 HTTPS 地址。不会上传或发布。
    const [output, notesFile, ...artifacts] = args;
    if (!output || !notesFile || artifacts.length === 0 || artifacts.length % 3)
      fail(
        'manifest <输出.json> <说明.txt> <平台> <包路径> <HTTPS地址> [更多平台…]',
      );
    const targets = new Set();
    const items = [];
    for (let i = 0; i < artifacts.length; i += 3) {
      const [target, file, url] = artifacts.slice(i, i + 3);
      if (
        !/^(darwin-(aarch64|x86_64)|windows-(x86_64|aarch64|i686)|linux-(x86_64|aarch64|armv7))$/.test(
          target,
        ) ||
        targets.has(target)
      )
        fail('平台无效或重复');
      targets.add(target);
      const parsed = new URL(url);
      if (
        parsed.protocol !== 'https:' ||
        parsed.username ||
        parsed.password ||
        parsed.hash
      )
        fail('下载地址需要无账号密码的 HTTPS');
      const signatureText = await readFile(`${file}.sig`, 'utf8');
      const signature = signatureText.trim();
      const info = await stat(file);
      if (!info.isFile() || info.size === 0) fail('更新包不存在或为空');
      if (
        (target.startsWith('darwin-') && !file.endsWith('.app.tar.gz')) ||
        (target.startsWith('linux-') && !file.endsWith('.AppImage')) ||
        (target.startsWith('windows-') && !/\.(exe|msi)$/.test(file))
      )
        fail('更新包格式与平台不匹配');
      if (basename(parsed.pathname) !== encodeURIComponent(basename(file)))
        console.warn(`请确认下载地址对应 ${basename(file)}`);
      await verifyDesktopArtifact(file, signature, publicKey);
      items.push({ target, url, signature });
    }
    await writeFile(
      output,
      `${JSON.stringify({ version: config.version, notes: await readFile(notesFile, 'utf8'), artifacts: items }, null, 2)}\n`,
    );
    console.warn(`发行清单已保存：${output}；上传包后可在后台导入并发布。`);
  } else if (command === 'check') {
    console.warn(`版本 ${config.version} 与公钥配置一致`);
  } else
    fail(
      '命令：version <版本> | check | build [tauri 参数] | bundle <输出.kx-update> <说明> <平台> <包路径> | manifest <输出> <说明> <平台 包路径 HTTPS地址>…',
    );
}
