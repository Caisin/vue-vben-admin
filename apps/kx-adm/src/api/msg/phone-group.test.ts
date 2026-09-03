import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PhoneGroupApi } from './phone-group';

const { get, put } = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
}));

vi.mock('#/api/request', () => ({
  requestClient: { get, put },
}));

describe('phoneGroupApi', () => {
  beforeEach(() => {
    get.mockReset();
    put.mockReset();
  });

  it('读取并替换分组钉钉通知通道', async () => {
    get.mockResolvedValueOnce({ channel_ids: [10, 20], options: [] });
    put.mockResolvedValueOnce({ channel_ids: [10, 20], options: [] });

    await PhoneGroupApi.notificationChannels(7);
    await PhoneGroupApi.replaceNotificationChannels(7, [10, 20]);

    expect(get).toHaveBeenCalledWith(
      '/msg/phone-groups/7/notification-channels',
    );
    expect(put).toHaveBeenCalledWith(
      '/msg/phone-groups/7/notification-channels',
      { channel_ids: [10, 20] },
    );
  });
});
