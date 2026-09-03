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

  it('兼容旧版嵌套分组行并保留真实业务 ID', async () => {
    get.mockResolvedValueOnce({
      items: [
        {
          group: {
            id: 206,
            grp_code: 'ops',
            grp_name: '运营号码',
          },
          notification_channel_count: 1,
          sim_count: 2,
          user_count: 3,
        },
      ],
      paging: { page: 1, size: 20 },
      total: 1,
      total_pages: 1,
    });

    const result = await PhoneGroupApi.list();

    expect(result.items[0]).toMatchObject({
      id: 206,
      grp_code: 'ops',
      notification_channel_count: 1,
    });
  });
});
