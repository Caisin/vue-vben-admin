// @vitest-environment node
import { Buffer } from 'node:buffer';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { gunzipSync } from 'node:zlib';

import { expect, it } from 'vitest';

import { writeReleaseArchive } from './release-archive.mjs';

it('生成可由标准 tar 解包的 TGZ 并保留原始安装包字节', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'kx-tgz '));
  try {
    const source = join(dir, 'app.exe');
    const output = join(dir, 'release.tgz');
    const payload = Buffer.from([0, 1, 2, 255, 0, 42]);
    const metadata = {
      version: '1.0.0',
      name: 'app.exe',
      signature: 'signed',
      target: 'windows-x86_64',
      notes: '说明',
      size: payload.length,
    };
    await writeFile(source, payload);
    await writeReleaseArchive(output, metadata, source);
    const exec = promisify(execFile);
    const listing = await exec('tar', ['-tzf', output]);
    expect(listing.stdout.trim().split(/\r?\n/)).toEqual([
      'release.json',
      'installer',
    ]);
    const info = await exec('tar', ['-xOzf', output, 'release.json']);
    expect(JSON.parse(info.stdout)).toEqual(metadata);
    const installer = await exec('tar', ['-xOzf', output, 'installer'], {
      encoding: 'buffer',
    });
    expect(installer.stdout).toEqual(payload);
    const compressed = await readFile(output);
    expect(gunzipSync(compressed).length % 512).toBe(0);
    await expect(
      writeReleaseArchive(
        output,
        { ...metadata, size: payload.length + 1 },
        source,
      ),
    ).rejects.toThrow('打包期间安装包发生变化');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
