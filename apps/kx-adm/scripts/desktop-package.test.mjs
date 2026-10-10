// @vitest-environment node
import { execFile } from 'node:child_process';
import {
  copyFile,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';

import { afterEach, expect, it } from 'vitest';

const exec = promisify(execFile);
const temporary = [];

afterEach(async () => {
  await Promise.all(
    temporary.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

async function fixture(mode = 'success', host = 'aarch64-apple-darwin') {
  const root = await mkdtemp(join(tmpdir(), 'kx release test '));
  temporary.push(root);
  const scripts = join(root, 'app/scripts');
  const bin = join(root, 'bin');
  const target = join(root, 'custom target');
  const output = join(root, 'output');
  const windows = host.includes('windows');
  const bundleDir = join(
    target,
    host,
    'release/bundle',
    windows ? 'nsis' : 'macos',
  );
  const artifactName = windows ? 'Qinjiu_0.1.1_setup.exe' : 'Qinjiu.app.tar.gz';
  const dmgDir = join(target, host, 'release/bundle/dmg');
  await Promise.all([
    mkdir(scripts, { recursive: true }),
    mkdir(bin),
    mkdir(join(root, 'app/src-tauri'), { recursive: true }),
    mkdir(bundleDir, { recursive: true }),
    mkdir(dmgDir, { recursive: true }),
  ]);
  const entry = join(scripts, 'desktop-package.mjs');
  await copyFile(new URL('desktop-package.mjs', import.meta.url), entry);
  await writeFile(
    join(root, 'app/src-tauri/tauri.conf.json'),
    JSON.stringify({ version: '0.1.1' }),
  );
  const key = join(root, 'private key');
  await writeFile(key, 'fixture-key-not-a-real-secret');
  const tool = (code) => `#!/usr/bin/env node\n${code}\n`;
  await writeFile(join(bin, 'rustc'), tool(`console.log('host: ${host}');`), {
    mode: 0o755,
  });
  await writeFile(
    join(bin, 'cargo'),
    tool(
      `console.log(${JSON.stringify(JSON.stringify({ target_directory: target }))});`,
    ),
    { mode: 0o755 },
  );
  // 以隔离的构建命令验证编排；实际签名格式另由 verify-desktop-artifact 测试覆盖。
  await writeFile(
    join(scripts, 'desktop-release.mjs'),
    `
    import { appendFile, writeFile, utimes, readFile } from 'node:fs/promises';
    import process from 'node:process';
    const args = process.argv.slice(2);
    await appendFile(${JSON.stringify(join(root, 'calls.jsonl'))}, JSON.stringify(args) + '\\n');
    if (args[0] === 'build') {
      if (${JSON.stringify(mode)} === 'failed') process.exit(8);
      if (process.env.KX_TEST_EXPECTED_PASSWORD !== undefined && process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD !== process.env.KX_TEST_EXPECTED_PASSWORD) process.exit(9);
      const file = ${JSON.stringify(join(bundleDir, artifactName))};
      await writeFile(file, 'installer');
      await writeFile(file + '.sig', 'signature');
      const dmg = ${JSON.stringify(join(dmgDir, 'Qinjiu_0.1.1.dmg'))};
      if (!${windows} && ${JSON.stringify(mode)} !== 'missing-dmg') {
        await writeFile(dmg, 'disk-image');
        if (${JSON.stringify(mode)} === 'stale-dmg') await utimes(dmg, 1, 1);
      }
      if (${JSON.stringify(mode)} === 'stale') {
        await utimes(file, 1, 1);
        await utimes(file + '.sig', 1, 1);
      }
    }
    if (args[0] === 'bundle') await writeFile(args[1], JSON.stringify({ notes: await readFile(args[2], 'utf8'), target: args[3], file: args[4] }));
  `,
  );
  const env = { ...process.env, PATH: `${bin}${delimiter}${process.env.PATH}` };
  delete env.TAURI_SIGNING_PRIVATE_KEY;
  delete env.TAURI_SIGNING_PRIVATE_KEY_PATH;
  delete env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD;
  return { root, entry, env, output, key, bundleDir };
}

it('兼容 Windows CRLF 文件的版本同步同时更新 Cargo.lock', async () => {
  const root = await mkdtemp(join(tmpdir(), 'kx windows version '));
  temporary.push(root);
  const scripts = join(root, 'scripts');
  const tauri = join(root, 'src-tauri');
  await Promise.all([mkdir(scripts), mkdir(tauri)]);
  for (const name of [
    'desktop-release.mjs',
    'verify-desktop-artifact.mjs',
    'release-archive.mjs',
  ])
    await copyFile(new URL(name, import.meta.url), join(scripts, name));
  await writeFile(
    join(root, 'package.json'),
    JSON.stringify({ version: '0.1.1' }),
  );
  await writeFile(
    join(tauri, 'tauri.conf.json'),
    JSON.stringify({ version: '0.1.1' }),
  );
  await writeFile(
    join(tauri, 'Cargo.toml'),
    '[package]\r\nname = "kx-adm-desktop"\r\nversion = "0.1.1"\r\n',
  );
  await writeFile(
    join(tauri, 'Cargo.lock'),
    '[[package]]\r\nname = "kx-adm-desktop"\r\nversion = "0.1.1"\r\n\r\n[[package]]\r\nname = "other"\r\nversion = "0.1.1"\r\n',
  );
  await exec(process.execPath, [
    join(scripts, 'desktop-release.mjs'),
    'version',
    '0.1.2',
  ]);
  expect(
    JSON.parse(await readFile(join(root, 'package.json'), 'utf8')).version,
  ).toBe('0.1.2');
  expect(
    JSON.parse(await readFile(join(tauri, 'tauri.conf.json'), 'utf8')).version,
  ).toBe('0.1.2');
  expect(await readFile(join(tauri, 'Cargo.toml'), 'utf8')).toContain(
    'version = "0.1.2"\r\n',
  );
  const lock = await readFile(join(tauri, 'Cargo.lock'), 'utf8');
  expect(lock).toContain('name = "kx-adm-desktop"\r\nversion = "0.1.2"');
  expect(lock).toContain('name = "other"\r\nversion = "0.1.1"');
});

it.skipIf(process.platform === 'win32').each([
  ['x86_64', 'x86_64'],
  ['aarch64', 'aarch64'],
  ['i686', 'i686'],
])(
  '为 Windows %s 使用 NSIS 安装包和对应更新平台',
  async (arch, updaterArch) => {
    const host = `${arch}-pc-windows-msvc`;
    const f = await fixture('success', host);
    await exec(
      process.execPath,
      [f.entry, '--key', f.key, '--out-dir', f.output],
      { env: f.env },
    );
    const artifact = JSON.parse(
      await readFile(
        join(f.output, `Qinjiu-0.1.1-windows-${updaterArch}.tgz`),
        'utf8',
      ),
    );
    expect(artifact.target).toBe(`windows-${updaterArch}`);
    expect(artifact.file).toBe(join(f.bundleDir, 'Qinjiu_0.1.1_setup.exe'));
    expect(
      await readFile(
        join(f.output, `Qinjiu-0.1.1-windows-${updaterArch}.exe`),
        'utf8',
      ),
    ).toBe('installer');
    expect(await readFile(artifact.file, 'utf8')).toBe('installer');
    const text = await readFile(join(f.root, 'calls.jsonl'), 'utf8');
    const calls = text
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    expect(calls.find((args) => args[0] === 'build')).toEqual([
      'build',
      '--target',
      host,
      '--bundles',
      'nsis',
    ]);
  },
);

it.skipIf(process.platform === 'win32').each([
  {
    password: 'fixture $value with spaces & "quotes"',
    inherited: 'old-password',
  },
  { password: '', inherited: 'old-password' },
  { password: '--help', inherited: 'old-password' },
  { password: undefined, inherited: 'fixture-environment-password' },
])(
  '签名密码通过环境传递，参数覆盖环境且支持空密码：$password',
  async ({ password, inherited }) => {
    const f = await fixture();
    const expected = password ?? inherited;
    const args = [f.entry, '--key', f.key, '--out-dir', f.output];
    if (password !== undefined) args.push('--password', password);
    const result = await exec(process.execPath, args, {
      env: {
        ...f.env,
        TAURI_SIGNING_PRIVATE_KEY_PASSWORD: inherited,
        KX_TEST_EXPECTED_PASSWORD: expected,
      },
    });
    expect(await readdir(f.output)).toEqual([
      'Qinjiu-0.1.1-darwin-aarch64.dmg',
      'Qinjiu-0.1.1-darwin-aarch64.tgz',
    ]);
    const calls = await readFile(join(f.root, 'calls.jsonl'), 'utf8');
    expect(calls).not.toContain('--password');
    const exposed = [result.stdout + result.stderr, calls].some(
      (text) => expected.length > 0 && text.includes(expected),
    );
    expect(exposed).toBe(false);
  },
);

it.skipIf(process.platform === 'win32')(
  '从任意目录构建，自动识别自定义 Cargo 目录和含空格包路径',
  async () => {
    const f = await fixture();
    const result = await exec(
      process.execPath,
      [
        f.entry,
        '--version',
        '0.1.2',
        '--key',
        f.key,
        '--notes',
        '修复下载\n无需校验文件',
        '--out-dir',
        f.output,
      ],
      { cwd: tmpdir(), env: f.env },
    );
    const output = join(f.output, 'Qinjiu-0.1.2-darwin-aarch64.tgz');
    const value = JSON.parse(await readFile(output, 'utf8'));
    expect(value.notes).toBe('修复下载\n无需校验文件');
    expect(value.file).toBe(join(f.bundleDir, 'Qinjiu.app.tar.gz'));
    expect(result.stderr).toContain(output);
    expect(result.stderr).not.toContain('fixture-key-not-a-real-secret');
    expect(await readdir(f.output)).toEqual([
      'Qinjiu-0.1.2-darwin-aarch64.dmg',
      'Qinjiu-0.1.2-darwin-aarch64.tgz',
    ]);
    expect(
      await readFile(join(f.output, 'Qinjiu-0.1.2-darwin-aarch64.dmg'), 'utf8'),
    ).toBe('disk-image');
    expect(await readFile(value.file, 'utf8')).toBe('installer');
    const callText = await readFile(join(f.root, 'calls.jsonl'), 'utf8');
    const calls = callText
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    expect(calls.map((args) => args[0])).toEqual([
      'version',
      'check',
      'build',
      'bundle',
    ]);
    expect(calls.find((args) => args[0] === 'build')).toEqual([
      'build',
      '--target',
      'aarch64-apple-darwin',
      '--bundles',
      'app,dmg',
    ]);
  },
);

it.skipIf(process.platform === 'win32')(
  '缺少密钥时在修改版本及启动构建前退出',
  async () => {
    const f = await fixture();
    await expect(
      exec(process.execPath, [f.entry, '--version', '0.1.2'], { env: f.env }),
    ).rejects.toThrow(/签名私钥/);
    await expect(readFile(join(f.root, 'calls.jsonl'))).rejects.toThrow(
      /ENOENT/,
    );
  },
);

it
  .skipIf(process.platform === 'win32')
  .each(['failed', 'stale', 'missing-dmg', 'stale-dmg'])(
  '构建失败或安装包缺失、过期时不生成发行包：%s',
  async (mode) => {
    const f = await fixture(mode);
    await expect(
      exec(process.execPath, [f.entry, '--key', f.key, '--out-dir', f.output], {
        env: f.env,
      }),
    ).rejects.toThrow(/执行失败|实际找到 0 个/);
    expect(await readdir(f.output)).toEqual([]);
    expect(await readFile(join(f.root, 'calls.jsonl'), 'utf8')).not.toContain(
      '"bundle",',
    );
  },
);
