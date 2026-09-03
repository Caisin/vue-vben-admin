import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OrgSyncApi } from './org-sync';

const { post } = vi.hoisted(() => ({ post: vi.fn() }));

vi.mock('#/api/request', () => ({
  requestClient: { post },
}));

describe('orgSyncApi', () => {
  beforeEach(() => post.mockReset());

  it('按人员同步为系统用户', async () => {
    post.mockResolvedValueOnce({ created: true, uid: 42 });

    await OrgSyncApi.sync_system_user(7);

    expect(post).toHaveBeenCalledWith(
      '/auth/org-sync/users/7/sync-system-user',
    );
  });
});
