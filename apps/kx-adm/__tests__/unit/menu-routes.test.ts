import { describe, expect, it, vi } from 'vitest';

import { buildRoutes } from '../../src/api/core/menu';

vi.mock('#/api/request', () => ({
  requestClient: { get: vi.fn() },
}));

describe('res dynamic menu routes', () => {
  it('keeps button permissions out of the route tree', () => {
    const routes = buildRoutes([
      permission({
        component: 'BasicLayout',
        id: 1,
        name: 'System',
        path: '/system',
        perm_type: 'catalog',
        pid: 0,
      }),
      permission({
        component: '/system/user/list',
        id: 2,
        name: 'SystemUser',
        path: '/system/user',
        perm_type: 'menu',
        pid: 1,
      }),
      permission({
        auth_code: 'user:mfa:reset',
        id: 3,
        name: 'SystemUserMfaReset',
        perm_type: 'button',
        pid: 2,
      }),
    ]);

    expect(routes).toHaveLength(1);
    expect(routes[0]?.children).toHaveLength(1);
    expect(routes[0]?.children?.[0]?.name).toBe('SystemUser');
    expect(routes[0]?.children?.[0]?.children).toBeUndefined();
  });
});

function permission(
  overrides: Partial<Parameters<typeof buildRoutes>[0][number]>,
): Parameters<typeof buildRoutes>[0][number] {
  return {
    auth_code: '',
    component: '',
    enabled: true,
    id: 0,
    meta: {},
    name: '',
    order_no: 0,
    path: '',
    perm_type: 'menu',
    pid: 0,
    redirect: null,
    title: '',
    ...overrides,
  };
}
