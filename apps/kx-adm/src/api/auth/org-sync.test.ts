import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OrgSyncApi } from './org-sync';

const { get, post } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));

vi.mock('#/api/request', () => ({
  requestClient: { get, post },
}));

describe('orgSyncApi', () => {
  beforeEach(() => {
    get.mockReset();
    post.mockReset();
  });

  it('人员查询透传全文检索和在职状态', async () => {
    get.mockResolvedValueOnce({ items: [], total: 0 });

    await OrgSyncApi.users({
      active: true,
      keyword: '13800000000',
      page: 1,
      size: 20,
      source: 'dingtalk:app-key',
    });

    expect(get).toHaveBeenCalledWith('/auth/org-sync/users', {
      params: {
        active: true,
        keyword: '13800000000',
        page: 1,
        size: 20,
        source: 'dingtalk:app-key',
      },
    });
  });

  it('按人员同步为系统用户', async () => {
    post.mockResolvedValueOnce({ created: true, uid: 42 });

    await OrgSyncApi.sync_system_user(7);

    expect(post).toHaveBeenCalledWith(
      '/auth/org-sync/users/7/sync-system-user',
    );
  });
});
