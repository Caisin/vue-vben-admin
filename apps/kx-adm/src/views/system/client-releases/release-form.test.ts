import { readFileSync } from 'node:fs';
import { URL as NodeURL } from 'node:url';
import { gunzipSync, gzipSync } from 'node:zlib';

import { describe, expect, it } from 'vitest';

import { releaseTgz } from '../../../../test-fixtures/release';
import { parseReleaseBundle, validateRelease } from './release-form';
const validArtifact = {
  target: 'darwin-aarch64',
  url: 'https://example.com/app.tar.gz',
  signature: 'signed',
};
const valid = {
  version: '0.1.1',
  notes: '更新说明',
  artifacts: [validArtifact],
};
describe('发行草稿校验', () => {
  it('拒绝重复平台、HTTP、预发布版本和缺失签名', () => {
    for (const value of [
      { ...valid, version: '1.0.0-beta' },
      { ...valid, artifacts: [...valid.artifacts, ...valid.artifacts] },
      {
        ...valid,
        artifacts: [{ ...validArtifact, url: 'http://example.com' }],
      },
      { ...valid, artifacts: [{ ...validArtifact, signature: '' }] },
    ])
      expect(() => validateRelease(value)).toThrow(Error);
    expect(() => validateRelease({ ...valid, artifacts: [] })).toThrow(Error);
  });
});

describe('单文件发行包', () => {
  function bundle(override = {}, payload = new Uint8Array([1, 2, 3])) {
    return new File([releaseTgz(override, payload)], 'release.tgz');
  }
  it('读取发行脚本生成的标准 TGZ fixture', async () => {
    const bytes = readFileSync(
      new NodeURL('../../../../test-fixtures/release.tgz', import.meta.url),
    );
    const result = await parseReleaseBundle(new File([bytes], 'release.tgz'));
    expect(result.release.version).toBe('1.0.0');
    expect(await result.file.text()).toBe('raw installer fixture');
  });
  it('拒绝损坏 gzip、额外条目、链接和路径', async () => {
    const bytes = releaseTgz();
    const truncated = bytes.subarray(0, -8);
    await expect(
      parseReleaseBundle(new File([truncated], 'bad.tgz')),
    ).rejects.toThrow(Error);
    for (const offset of [0, 156, 2048]) {
      const tar = gunzipSync(bytes);
      tar[offset] = 65;
      await expect(
        parseReleaseBundle(new File([gzipSync(tar)], 'bad.tgz')),
      ).rejects.toThrow(Error);
    }
  });
  it('自动读取签名并保留安装包原始字节', async () => {
    const result = await parseReleaseBundle(bundle());
    expect(result.release.artifacts[0]?.signature).toBe('signed');
    expect(new Uint8Array(await result.file.arrayBuffer())).toEqual(
      new Uint8Array([1, 2, 3]),
    );
  });
  it('上传前拒绝超过 512 MiB 的安装包', async () => {
    const size = 513 * 1024 * 1024;
    const file = new File(
      [releaseTgz({ size }, new Uint8Array([1]), size)],
      'big.tgz',
    );
    await expect(parseReleaseBundle(file)).rejects.toThrow(
      '更新安装包不能超过 512 MiB',
    );
  });
  it('拒绝损坏长度、无签名、平台错配和目录路径', async () => {
    for (const value of [
      { size: 4 },
      { signature: '' },
      { signature: null },
      { version: '1.0.0-beta' },
      { target: 'windows-x86_64' },
      { name: '../app.app.tar.gz' },
    ])
      await expect(parseReleaseBundle(bundle(value))).rejects.toThrow(Error);
    await expect(
      parseReleaseBundle(new File(['installer'], 'app.exe')),
    ).rejects.toThrow(Error);
  });
});
