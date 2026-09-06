import { describe, expect, it, vi } from 'vitest';

import { buildRoutes } from './menu';

vi.mock('#/api/request', () => ({
  requestClient: { get: vi.fn() },
}));

type PermissionInput = Parameters<typeof buildRoutes>[0][number];

function permission(
  input: Partial<PermissionInput> & Pick<PermissionInput, 'id' | 'name'>,
): PermissionInput {
  return {
    auth_code: '',
    component: '',
    enabled: true,
    meta: {},
    order_no: 1,
    path: `/${input.name}`,
    perm_type: 'catalog',
    pid: 0,
    title: input.name,
    ...input,
  };
}

describe('buildRoutes', () => {
  it('创作会话参数变化不创建第二个工作台页签', () => {
    const routes = buildRoutes([
      permission({
        component: '/aigc-gateway/chat',
        id: 1,
        name: 'AigcChat',
        perm_type: 'menu',
      }),
    ]);
    expect(routes[0]?.meta?.fullPathKey).toBe(false);
  });
  it('保留根布局并让子目录作为纯路由分组', () => {
    const routes = buildRoutes([
      permission({ component: 'BasicLayout', id: 1, name: 'Root' }),
      permission({ id: 2, name: 'Nested', pid: 1 }),
      permission({
        component: '/res/page/index',
        id: 3,
        name: 'Page',
        perm_type: 'menu',
        pid: 2,
      }),
    ]);

    expect(routes[0]?.component).toBe('BasicLayout');
    expect(routes[0]?.children?.[0]?.component).toBeUndefined();
    expect(routes[0]?.children?.[0]?.children?.[0]?.component).toBe(
      '/res/page/index',
    );
  });
});
