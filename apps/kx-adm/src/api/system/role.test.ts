import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SystemRoleApi } from '#/api/system/role';

const { get } = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock('#/api/request', () => ({
  requestClient: { get },
}));

describe('systemRoleApi', () => {
  beforeEach(() => {
    get.mockReset();
  });

  it('角色分页直接使用列表响应，不因详情接口失败而丢失整页数据', async () => {
    get.mockResolvedValueOnce({
      items: [
        {
          created_at: 1_788_000_000,
          enabled: true,
          home_perm_id: null,
          order_no: 1,
          remark: '系统管理员',
          role_id: 'admin',
          role_name: '管理员',
        },
      ],
      paging: { page: 1, size: 20 },
      total: 1,
      total_pages: 1,
    });

    await expect(
      SystemRoleApi.list({ page: 1, pageSize: 20 }),
    ).resolves.toEqual({
      items: [
        {
          apiIds: [],
          createTime: 1_788_000_000,
          homePermId: null,
          id: 'admin',
          name: '管理员',
          permissions: [],
          remark: '系统管理员',
          status: 1,
        },
      ],
      total: 1,
    });
    expect(get).toHaveBeenCalledOnce();
    expect(get).toHaveBeenCalledWith('/auth/role', {
      params: {
        page: 1,
        role_name_prefix: undefined,
        size: 20,
      },
    });
  });
});
