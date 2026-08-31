import { describe, expect, it } from 'vitest';

import { supportsDirectUpload } from '../internal/file-picker-options';

describe('file picker upload modes', () => {
  it('only enables browser direct upload for S3-compatible storage', () => {
    for (const storageType of ['ali', 'cos', 's3', 'tos']) {
      expect(supportsDirectUpload(storageType)).toBe(true);
    }
    for (const storageType of ['fs', 'local', 'sftp', '', undefined]) {
      expect(supportsDirectUpload(storageType)).toBe(false);
    }
  });
});
