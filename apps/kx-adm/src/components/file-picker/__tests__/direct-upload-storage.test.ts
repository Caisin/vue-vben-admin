import { ref } from 'vue';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { useDirectUpload } from '../internal/use-direct-upload';
vi.mock('antdv-next', () => ({
  message: { success: vi.fn() },
  notification: { error: vi.fn() },
}));
vi.mock('#/api/storage', () => ({
  StorageFileApi: { presignUpload: vi.fn(), presignComplete: vi.fn() },
}));
vi.mock('../internal/md5', () => ({
  md5File: vi.fn().mockResolvedValue('a'.repeat(32)),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe('adapter upload storage', () => {
  it('keeps the original storage for completion when the user changes selection during upload', async () => {
    vi.useFakeTimers();
    class UploadRequest {
      getResponseHeader = vi.fn(() => 'test-etag');
      onLoad: (() => void) | undefined;
      open = vi.fn();
      setRequestHeader = vi.fn();
      status = 200;
      upload = { addEventListener: vi.fn() };
      addEventListener(type: string, callback: () => void) {
        if (type === 'load') this.onLoad = callback;
      }
      send() {
        this.onLoad?.();
      }
    }
    vi.stubGlobal('XMLHttpRequest', UploadRequest);
    const active = ref<string | undefined>('public-a');
    const prepare = vi.fn(async () => {
      active.value = 'public-b';
      return {
        upload_required: true,
        upload_url: 'https://test.invalid/upload',
        method: 'PUT',
        headers: {},
        key: 'test.png',
        expires_in: 30,
      };
    });
    const complete = vi.fn(async () => ({
      file: {
        file_id: 1,
        storage_code: 'public-a',
        storage_type: 's3',
        file_name: 'test',
        file_ext: 'png',
        key: 'test.png',
        size: 3,
        md5_hash: 'a'.repeat(32),
        created_at: 1,
        created_by: 7,
      },
      url: 'https://test.invalid/test.png',
    }));
    const upload = useDirectUpload({
      accept: () => 'image/png',
      active_group_id: ref(),
      active_storage_code: active,
      addUploaded: vi.fn(),
      reload: vi.fn(),
      presignUpload: prepare,
      presignComplete: complete,
    });
    await upload.uploadFiles([
      new File(['png'], 'test.png', { type: 'image/png' }),
    ]);
    expect(prepare).toHaveBeenCalledWith(
      expect.objectContaining({ file_name: 'test.png' }),
      'public-a',
    );
    expect(complete).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'test.png' }),
      'public-a',
    );
    expect(active.value).toBe('public-b');
  });
});
