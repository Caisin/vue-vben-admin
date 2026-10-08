/* eslint-disable vue/one-component-per-file, vue/require-prop-types -- 页面交互测试组件桩。 */
import { createApp, h, nextTick } from 'vue';

import { afterEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  codes: new Set<string>(),
  opened: [] as string[],
  selected: {} as Record<string, unknown>,
  row: { id: 'res_reader', name: '资源查看', status: 1 },
}));
vi.mock('@vben/access', () => ({
  useAccess: () => ({
    hasAccessByCodes: (codes: string[]) =>
      codes.some((code) => state.codes.has(code)),
  }),
}));
vi.mock('#/api', () => ({ SystemRoleApi: {} }));
vi.mock('#/locales', () => ({ $t: (key: string) => key }));
vi.mock('@vben/icons', async () => {
  const { defineComponent, h } = await import('vue');
  const Icon = defineComponent({ setup: () => () => h('svg') });
  return { IconifyIcon: Icon, Plus: Icon };
});
vi.mock('./modules/form.vue', () => ({ default: { name: 'RoleForm' } }));
vi.mock('./modules/detail.vue', () => ({ default: { name: 'RoleDetail' } }));
vi.mock('./modules/users.vue', () => ({ default: { name: 'RoleUsers' } }));
vi.mock('@vben/common-ui', async () => {
  const { defineComponent, h } = await import('vue');
  return {
    Page: defineComponent({
      setup:
        (_p, { slots }) =>
        () =>
          h('main', slots.default?.()),
    }),
    useVbenDrawer: ({
      connectedComponent,
    }: {
      connectedComponent: { name: string };
    }) => {
      const name = connectedComponent.name;
      const api = {
        setData: (row: unknown) => {
          state.selected[name] = row;
          return api;
        },
        open: () => state.opened.push(name),
      };
      return [defineComponent({ setup: () => () => null }), api];
    },
  };
});
vi.mock('#/adapter/vxe-table', async () => {
  const { defineComponent, h } = await import('vue');
  return {
    useVbenVxeGrid: () => [
      defineComponent({
        setup:
          (_p, { slots }) =>
          () =>
            h('div', [
              slots.roleName?.({ row: state.row }),
              h(
                'section',
                { id: 'role-actions' },
                slots.action?.({ row: state.row }),
              ),
              slots['toolbar-tools']?.(),
            ]),
      }),
      { query: vi.fn() },
    ],
  };
});
vi.mock('antdv-next', async () => {
  const { defineComponent, h } = await import('vue');
  const Wrap = defineComponent({
    setup:
      (_p, { slots }) =>
      () =>
        h('div', slots.default?.()),
  });
  return {
    Button: defineComponent({
      setup:
        (_p, { slots }) =>
        () =>
          h('button', slots.default?.()),
    }),
    Form: Wrap,
    FormItem: Wrap,
    Input: Wrap,
    Popconfirm: Wrap,
    Tooltip: Wrap,
    Modal: defineComponent({
      props: ['open'],
      setup:
        (p, { slots }) =>
        () =>
          p.open ? h('div', slots.default?.()) : null,
    }),
    message: {},
  };
});

let unmount: (() => void) | undefined;
afterEach(() => {
  unmount?.();
  document.body.innerHTML = '';
  state.codes.clear();
  state.opened.length = 0;
  state.selected = {};
});
async function mount(codes: string[]) {
  codes.forEach((code) => state.codes.add(code));
  const { default: RoleList } = await import('./list.vue');
  const host = document.createElement('div');
  document.body.append(host);
  const app = createApp({ render: () => h(RoleList) });
  app.mount(host);
  unmount = () => app.unmount();
  await nextTick();
}

describe('角色列表行内操作', () => {
  it('名称打开角色权限编辑，操作列使用带无障碍名称的图标', async () => {
    await mount(['roles:manage', 'roles:copy', 'roles:assign-users']);
    document
      .querySelector<HTMLButtonElement>(
        'button[aria-label="编辑角色及权限：资源查看"]',
      )
      ?.click();
    expect(state.opened).toEqual(['RoleForm']);
    expect(state.selected.RoleForm).toEqual(state.row);
    const actions = [
      ...document.querySelectorAll<HTMLButtonElement>('#role-actions button'),
    ];
    expect(actions.map((button) => button.getAttribute('aria-label'))).toEqual([
      '查看详情',
      '复制角色',
      '授权用户',
      '删除角色',
    ]);
    expect(actions.every((button) => button.textContent?.trim() === '')).toBe(
      true,
    );
    actions[0]?.click();
    actions[2]?.click();
    expect(state.opened).toEqual(['RoleForm', 'RoleDetail', 'RoleUsers']);
    expect(state.selected.RoleUsers).toEqual(state.row);
  });

  it('只读用户保留角色名称和详情，没有编辑或写操作入口', async () => {
    await mount([]);
    expect(document.body.textContent).toContain('资源查看');
    expect(document.querySelector('button[aria-label^="编辑角色"]')).toBeNull();
    const actions = [
      ...document.querySelectorAll<HTMLButtonElement>('#role-actions button'),
    ];
    expect(actions.map((button) => button.getAttribute('aria-label'))).toEqual([
      '查看详情',
    ]);
    actions[0]?.click();
    expect(state.opened).toEqual(['RoleDetail']);
  });
});
