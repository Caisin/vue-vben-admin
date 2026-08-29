import { describe, expect, it } from 'vitest';

import { resolveFileAccessUrl } from '#/api/storage/file-url';

describe('resolveFileAccessUrl', () => {
  it('prefixes backend-relative local file routes with the configured API base', () => {
    expect(resolveFileAccessUrl('/storage/file/content/7', '/api')).toBe(
      '/api/storage/file/content/7',
    );
    expect(
      resolveFileAccessUrl(
        '/storage/file/content/7',
        'https://api.example.com/v1/',
      ),
    ).toBe('https://api.example.com/v1/storage/file/content/7');
  });

  it('keeps absolute, data, and blob URLs unchanged', () => {
    for (const url of [
      'https://cdn.example.com/a.png',
      '//cdn.example.com/a.png',
      'data:image/png;base64,AA==',
      'blob:https://admin.example.com/id',
    ]) {
      expect(resolveFileAccessUrl(url, '/api')).toBe(url);
    }
  });
});
