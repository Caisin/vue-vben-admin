import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SystemMenuApi } from '#/api/system/menu';

import {
  invalidatePermissionCatalog,
  readPermissionCatalog,
} from './permission-catalog-cache';

const { get, put } = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
}));

vi.mock('#/api/request', () => ({
  requestClient: { get, put },
}));

describe('systemMenuApi', () => {
  beforeEach(() => {
    invalidatePermissionCatalog();
    get.mockReset();
    put.mockReset();
  });

  it('将菜单和完整 API 绑定一次提交，并解码关联结果', async () => {
    const loadCatalog = vi.fn(async () => ({ menus: [], apis: [] }));
    await readPermissionCatalog(() => 'menu-test', loadCatalog);
    put.mockResolvedValueOnce({
      id: 2,
      pid: 0,
      name: 'Page',
      perm_type: 'menu',
      title: '页面',
      enabled: true,
      auth_code: '',
      meta: {},
      api_ids: [7, 8],
    });
    const result = await SystemMenuApi.update('2', {
      pid: '0',
      name: 'Page',
      type: 'menu',
      meta: { title: '页面' },
      status: 1,
      path: '/page',
      authCode: '',
      apiIds: ['7', '8'],
    });
    expect(put).toHaveBeenCalledWith(
      '/auth/menu/2',
      expect.objectContaining({ api_ids: [7, 8] }),
    );
    expect(result.apiIds).toEqual(['7', '8']);
    await readPermissionCatalog(() => 'menu-test', loadCatalog);
    expect(loadCatalog).toHaveBeenCalledTimes(2);
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
        apiIds: [],
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
