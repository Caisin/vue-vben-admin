import { describe, expect, it } from 'vitest';

import {
  parseReleaseBundle,
  parseReleaseManifest,
  validateRelease,
} from './release-form';
const valid = {
  version: '0.1.1',
  notes: '更新说明',
  artifacts: [
    {
      target: 'darwin-aarch64',
      url: 'https://example.com/app.tar.gz',
      signature: 'signed',
    },
  ],
};
describe('发行清单导入', () => {
  it('保留平台包与签名', () => {
    expect(parseReleaseManifest(JSON.stringify(valid))).toEqual(valid);
  });
  it('拒绝缺字段、重复平台、HTTP、预发布版本和缺失签名', () => {
    for (const value of [
      null,
      {},
      { ...valid, version: '1.0.0-beta' },
      { ...valid, artifacts: [...valid.artifacts, ...valid.artifacts] },
      {
        ...valid,
        artifacts: [{ ...valid.artifacts[0], url: 'http://example.com' }],
      },
      { ...valid, artifacts: [{ ...valid.artifacts[0], signature: '' }] },
    ])
      expect(() => parseReleaseManifest(JSON.stringify(value))).toThrow(Error);
    expect(() => validateRelease({ ...valid, artifacts: [] })).toThrow(Error);
  });
});

describe('单文件发行包', () => {
  function bundle(override = {}, payload = new Uint8Array([1, 2, 3])) {
    const metadata = new TextEncoder().encode(
      JSON.stringify({
        version: '0.1.1',
        notes: '说明',
        name: 'app.app.tar.gz',
        target: 'darwin-aarch64',
        signature: 'signed',
        size: 3,
        ...override,
      }),
    );
    const header = new Uint8Array(12);
    header.set(new TextEncoder().encode('KXUPDATE'));
    new DataView(header.buffer).setUint32(8, metadata.length, true);
    return new File([header, metadata, payload], 'release.kx-update');
  }
  it('自动读取签名并保留安装包原始字节', async () => {
    const result = await parseReleaseBundle(bundle());
    expect(result.release.artifacts[0]?.signature).toBe('signed');
    expect(new Uint8Array(await result.file.arrayBuffer())).toEqual(
      new Uint8Array([1, 2, 3]),
    );
  });
  it('拒绝损坏长度、无签名、平台错配和目录路径', async () => {
    for (const value of [
      { size: 4 },
      { signature: '' },
      { target: 'windows-x86_64' },
      { name: '../app.app.tar.gz' },
    ])
      await expect(parseReleaseBundle(bundle(value))).rejects.toThrow(Error);
    await expect(
      parseReleaseBundle(new File(['installer'], 'app.exe')),
    ).rejects.toThrow(Error);
  });
});
