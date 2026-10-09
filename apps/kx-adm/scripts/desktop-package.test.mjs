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

async function fixture(mode = 'success') {
  const root = await mkdtemp(join(tmpdir(), 'kx release test '));
  temporary.push(root);
  const scripts = join(root, 'app/scripts');
  const bin = join(root, 'bin');
  const target = join(root, 'custom target');
  const output = join(root, 'output');
  const host = 'aarch64-apple-darwin';
  const bundleDir = join(target, host, 'release/bundle/macos');
  await Promise.all([
    mkdir(scripts, { recursive: true }),
    mkdir(bin),
    mkdir(join(root, 'app/src-tauri'), { recursive: true }),
    mkdir(bundleDir, { recursive: true }),
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
      const file = ${JSON.stringify(join(bundleDir, 'KX ADM.app.tar.gz'))};
      await writeFile(file, 'installer');
      await writeFile(file + '.sig', 'signature');
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
  return { root, entry, env, output, key, bundleDir };
}

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
    const output = join(f.output, 'kx-adm-0.1.2-darwin-aarch64.kx-update');
    const value = JSON.parse(await readFile(output, 'utf8'));
    expect(value.notes).toBe('修复下载\n无需校验文件');
    expect(value.file).toBe(join(f.bundleDir, 'KX ADM.app.tar.gz'));
    expect(result.stderr).toContain(output);
    expect(result.stderr).not.toContain('fixture-key-not-a-real-secret');
    expect(await readdir(f.output)).toEqual([
      'kx-adm-0.1.2-darwin-aarch64.kx-update',
    ]);
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

it.skipIf(process.platform === 'win32')(
  '构建失败和只有旧产物时都不生成发行包',
  async () => {
    for (const mode of ['failed', 'stale']) {
      const f = await fixture(mode);
      await expect(
        exec(
          process.execPath,
          [f.entry, '--key', f.key, '--out-dir', f.output],
          { env: f.env },
        ),
      ).rejects.toThrow(/执行失败|实际找到 0 个/);
      expect(await readdir(f.output)).toEqual([]);
      expect(await readFile(join(f.root, 'calls.jsonl'), 'utf8')).not.toContain(
        '"bundle",',
      );
    }
  },
);
