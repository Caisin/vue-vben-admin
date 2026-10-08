import { describe, expect, it } from 'vitest';

import { parseReleaseManifest, validateRelease } from './release-form';
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
