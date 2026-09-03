import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DeveloperAccountApi } from './index';

const { post, upload } = vi.hoisted(() => ({
  post: vi.fn(),
  upload: vi.fn(),
}));

vi.mock('#/api/request', () => ({
  plaintextRequestClient: { upload },
  requestClient: { post },
}));

describe('developerAccountApi apple devices', () => {
  beforeEach(() => {
    post.mockReset();
    upload.mockReset();
  });

  it('允许创建未关联账号的设备并上传截图', async () => {
    post.mockResolvedValueOnce({ id: 7 });
    upload.mockResolvedValueOnce({ file: { file_id: 9 } });
    const file = new File(['png'], 'device.png', { type: 'image/png' });

    await DeveloperAccountApi.createAppleDevice({
      developer_account_id: null,
      device_no: 'device-1',
    });
    await DeveloperAccountApi.uploadAppleDeviceScreenshot(file);

    expect(post).toHaveBeenCalledWith('/developer-account/apple-devices', {
      developer_account_id: null,
      device_no: 'device-1',
    });
    expect(upload).toHaveBeenCalledWith(
      '/developer-account/apple-devices/screenshot',
      { file },
    );
  });
});
