import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiPermissionApi } from './api-permission';

const { get, post } = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock('#/api/request', () => ({
  requestClient: { get, post },
}));

describe('apiPermissionApi', () => {
  beforeEach(() => {
    post.mockReset();
    get.mockReset();
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

  it('授权选项接口只请求一次聚合结果', async () => {
    get.mockResolvedValueOnce([]);

    await ApiPermissionApi.allGrantOptions();
    await ApiPermissionApi.unboundOptions();

    expect(get).toHaveBeenNthCalledWith(1, '/auth/api/grant-options');
    expect(get).toHaveBeenNthCalledWith(2, '/auth/api/unbound-options');
    expect(get).toHaveBeenCalledTimes(2);
  });
});
