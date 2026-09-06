import { describe, expect, it, vi } from 'vitest';

import { resolveFileAccessUrl } from '#/api/storage/file-url';

import { StorageFileApi } from './file';

const { download } = vi.hoisted(() => ({ download: vi.fn() }));
vi.mock('#/api/request', () => ({
  apiURL: '/api',
  plaintextRequestClient: { download },
  requestClient: {},
}));

it('downloads protected plaintext binary content without KxEd decoding', async () => {
  const blob = new Blob(['media']);
  download.mockResolvedValue(blob);
  expect(await StorageFileApi.download(7)).toBe(blob);
  expect(download).toHaveBeenCalledWith('/storage/file/content/7');
});

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
