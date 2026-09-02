import { describe, expect, it } from 'vitest';

import { normalizeArtifactFileId } from './artifact-upload';

describe('normalizeArtifactFileId', () => {
  it('将文件选择器字符串 ID 转为安全整数', () => {
    expect(normalizeArtifactFileId('107')).toBe(107);
    expect(normalizeArtifactFileId({ file_id: '108' })).toBe(108);
  });

  it('拒绝空值、非数字和超出安全整数的 ID', () => {
    expect(normalizeArtifactFileId('')).toBeUndefined();
    expect(normalizeArtifactFileId('not-an-id')).toBeUndefined();
    expect(normalizeArtifactFileId('9007199254740992')).toBeUndefined();
  });
});
