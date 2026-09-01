import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SystemMenuApi } from '#/api/system/menu';

const { get } = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock('#/api/request', () => ({
  requestClient: { get },
}));

describe('systemMenuApi', () => {
  beforeEach(() => {
    get.mockReset();
  });

  it('兼容分页结构的菜单权限响应', async () => {
    get.mockResolvedValueOnce({
      items: [
        {
          auth_code: 'system',
          component: 'BasicLayout',
          enabled: true,
          id: 1,
          meta: { title: 'system.title' },
          name: 'System',
          path: '/system',
          perm_type: 'catalog',
          pid: 0,
          title: '系统',
        },
      ],
      total: 1,
    });

    await expect(SystemMenuApi.list()).resolves.toEqual([
      {
        authCode: 'system',
        component: 'BasicLayout',
        id: '1',
        meta: { title: '系统' },
        name: 'System',
        path: '/system',
        pid: '0',
        redirect: undefined,
        status: 1,
        type: 'catalog',
      },
    ]);
  });
});
