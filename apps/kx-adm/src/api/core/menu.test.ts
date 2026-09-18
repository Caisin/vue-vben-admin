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
  it('菜单构建在未提供 toSorted 的 WebView 中仍然可用', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(
      Array.prototype,
      'toSorted',
    );
    if (!descriptor) throw new Error('测试环境应提供原生 toSorted');
    // oxlint-disable-next-line no-extend-native -- 模拟旧 WebView，finally 恢复原生实现。
    Object.defineProperty(Array.prototype, 'toSorted', {
      ...descriptor,
      value: undefined,
    });
    try {
      await import('../../runtime-polyfills');
      const items = [
        permission({ id: 3, name: 'Last', pid: 1, order_no: 2 }),
        permission({ id: 1, name: 'Root' }),
        permission({ id: 2, name: 'First', pid: 1, order_no: 1 }),
      ];
      const routes = buildRoutes(items);
      expect(routes[0]?.children?.map((route) => route.name)).toEqual([
        'First',
        'Last',
      ]);
      expect(items.map((item) => item.id)).toEqual([3, 1, 2]);
    } finally {
      // oxlint-disable-next-line no-extend-native -- 恢复测试前的运行环境。
      Object.defineProperty(Array.prototype, 'toSorted', descriptor);
    }
  });
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
