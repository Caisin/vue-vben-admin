import type { UploadFile } from '#/api/storage';

import { describe, expect, it } from 'vitest';

import {
  acceptsBrowserFile,
  acceptsStoredFile,
  normalizeAccept,
} from '../file-type';

function stored(file_ext: string): UploadFile {
  return {
    created_at: 0,
    created_by: 7,
    file_ext,
    file_id: 1,
    file_name: 'sample',
    key: 'key',
    md5_hash: 'hash',
    size: 1,
    storage_code: 'local',
    storage_type: 'fs',
  };
}

describe('file picker accept rules', () => {
  it('normalizes comma and array inputs', () => {
    expect(normalizeAccept(' image/*, .PDF, image/* ')).toEqual([
      'image/*',
      '.pdf',
    ]);
    expect(normalizeAccept(['.PNG', ' application/pdf '])).toEqual([
      '.png',
      'application/pdf',
    ]);
  });

  it('matches stored files by extension and known mime', () => {
    expect(acceptsStoredFile(stored('png'), 'image/*')).toBe(true);
    expect(acceptsStoredFile(stored('pdf'), 'application/pdf')).toBe(true);
    expect(acceptsStoredFile(stored('custom'), '.custom')).toBe(true);
    expect(acceptsStoredFile(stored('custom'), 'application/*')).toBe(false);
  });

  it('uses browser mime with an extension fallback', () => {
    const image = new File(['x'], 'photo.PNG', { type: '' });
    expect(acceptsBrowserFile(image, 'image/*')).toBe(true);
    expect(acceptsBrowserFile(image, 'application/pdf')).toBe(false);
    expect(acceptsBrowserFile(image, '*/*')).toBe(true);
  });
});
