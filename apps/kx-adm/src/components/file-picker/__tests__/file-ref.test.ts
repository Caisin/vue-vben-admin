import type { UploadFile } from '#/api/storage';

import { describe, expect, it } from 'vitest';

import {
  fileKindFromReference,
  normalizeFileId,
  toFileReference,
} from '../file-ref';

function stored(file_ext: string, file_name = 'sample'): UploadFile {
  return {
    created_at: 0,
    file_ext,
    file_id: 1,
    file_name,
    key: 'key',
    md5_hash: 'hash',
    size: 1,
    storage_code: 'local',
    storage_type: 'fs',
  };
}

describe('file reference preview metadata', () => {
  it('normalizes safe decimal file ids to numbers without losing large ids', () => {
    expect(normalizeFileId('107')).toBe(107);
    expect(normalizeFileId('storage:file:108')).toBe(108);
    expect(normalizeFileId({ file_id: '109' })).toBe(109);
    expect(normalizeFileId('9007199254740992')).toBe('9007199254740992');
  });

  it('detects image and video references by extension metadata', () => {
    expect(fileKindFromReference({ file_ext: 'png', file_id: 1 })).toBe(
      'image',
    );
    expect(fileKindFromReference({ file_ext: 'mp4', file_id: 2 })).toBe(
      'video',
    );
  });

  it('falls back to file name when stored extension metadata is empty', () => {
    expect(
      fileKindFromReference({
        file_ext: '',
        file_id: 1,
        file_name: 'poster.webp',
      }),
    ).toBe('image');
    expect(toFileReference(stored('', 'clip.mov')).media_type).toBe('video');
  });

  it('does not let a generic media_type hide concrete image/video metadata', () => {
    expect(
      fileKindFromReference({
        file_ext: 'jpg',
        file_id: 1,
        file_name: 'photo.jpg',
        media_type: 'file',
      }),
    ).toBe('image');
  });
});
