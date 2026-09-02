import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SystemRoleApi } from '#/api/system/role';

const { get, post } = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock('#/api/request', () => ({
  requestClient: { get, post },
}));

describe('systemRoleApi', () => {
  beforeEach(() => {
    get.mockReset();
    post.mockReset();
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

  it('复制角色调用事务复制接口并保留返回的授权集合', async () => {
    post.mockResolvedValueOnce({
      api_ids: [21],
      created_at: 1_788_000_001,
      enabled: true,
      home_perm_id: 11,
      order_no: 2,
      permission_ids: [11, 12],
      remark: '复制角色',
      role_id: 'msg_admin_copy',
      role_name: 'MSG 管理员副本',
    });

    await expect(
      SystemRoleApi.copy('msg_admin', {
        id: 'msg_admin_copy',
        name: 'MSG 管理员副本',
      }),
    ).resolves.toMatchObject({
      apiIds: ['21'],
      id: 'msg_admin_copy',
      name: 'MSG 管理员副本',
      permissions: ['11', '12'],
    });
    expect(post).toHaveBeenCalledWith('/auth/role/msg_admin/copy', {
      role_id: 'msg_admin_copy',
      role_name: 'MSG 管理员副本',
    });
  });
});
