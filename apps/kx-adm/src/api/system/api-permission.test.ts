import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiPermissionApi } from './api-permission';

const { post } = vi.hoisted(() => ({
  post: vi.fn(),
}));

vi.mock('#/api/request', () => ({
  requestClient: { post },
}));

describe('apiPermissionApi', () => {
  beforeEach(() => {
    post.mockReset();
  });

  it('按 API ID 查询时发送后端要求的数组参数', async () => {
    post.mockResolvedValueOnce({ items: [], total: 0 });

    await ApiPermissionApi.list({ ids: [1, 2], page: 1, size: 100 });

    expect(post).toHaveBeenCalledWith('/auth/api', {
      ids: [1, 2],
      page: 1,
      size: 100,
    });
  });
});
