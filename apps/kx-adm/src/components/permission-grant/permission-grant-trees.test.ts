/* eslint-disable vue/one-component-per-file, vue/require-prop-types -- 权限树交互组件桩。 */
import type { ApiPermission } from '#/api/system/api-permission';
import type { SystemMenu } from '#/api/system/menu';

import { createApp, h, nextTick, reactive } from 'vue';

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@vben/common-ui', async () => {
  const { defineComponent, h } = await import('vue');
  return {
    Tree: defineComponent({
      props: ['treeData', 'modelValue', 'disabled', 'autoCheckParent'],
      emits: ['update:modelValue'],
      setup:
        (p, { emit }) =>
        () =>
          h(
            'button',
            {
              'data-tree': true,
              'data-auto-parent': String(p.autoCheckParent),
              disabled: p.disabled,
              onClick: () => emit('update:modelValue', ['menu']),
            },
            '选择页面',
          ),
    }),
  };
});
vi.mock('@vben/icons', () => ({ IconifyIcon: { render: () => null } }));
vi.mock('antdv-next', async () => {
  const { defineComponent, h } = await import('vue');
  const Wrap = defineComponent({
    setup:
      (_p, { slots }) =>
      () =>
        h('div', slots.default?.()),
  });
  return {
    Spin: Wrap,
    Space: Wrap,
    Tag: Wrap,
    Button: defineComponent({
      emits: ['click'],
      setup:
        (_p, { slots, emit }) =>
        () =>
          h('button', { onClick: () => emit('click') }, slots.default?.()),
    }),
    InputSearch: defineComponent({
      props: ['value'],
      emits: ['update:value'],
      setup:
        (p, { emit }) =>
        () =>
          h('input', {
            value: p.value,
            onInput: (e: Event) =>
              emit('update:value', (e.target as HTMLInputElement).value),
          }),
    }),
  };
});
let unmount: (() => void) | undefined;
afterEach(() => {
  unmount?.();
  document.body.innerHTML = '';
});
const menus: SystemMenu[] = [
  {
    id: 'menu',
    pid: '0',
    type: 'menu',
    status: 1,
    name: 'Menu',
    meta: { title: '页面' },
    path: '/demo',
    authCode: '',
    apiIds: ['1'],
    children: [
      {
        id: 'write',
        pid: 'menu',
        type: 'button',
        status: 1,
        name: 'Write',
        meta: { title: '编辑' },
        path: '',
        authCode: 'write',
        apiIds: ['1', '2'],
      },
    ],
  },
];
const apis = [
  {
    id: 1,
    enabled: true,
    api_name: '列表读取',
    api_method: 'GET',
    api_path: '/demo',
  },
  {
    id: 2,
    enabled: true,
    api_name: '保存内容',
    api_method: 'POST',
    api_path: '/demo',
  },
] as ApiPermission[];
async function mount(readonly = false) {
  const { default: Component } = await import('./permission-grant-trees.vue');
  const state = reactive({ ids: ['menu', 'write'] });
  const host = document.createElement('div');
  document.body.append(host);
  const app = createApp({
    render: () =>
      h(Component, {
        menus,
        apis,
        readonly,
        permissionIds: state.ids,
        'onUpdate:permissionIds': (ids: string[]) => {
          state.ids = ids;
        },
      }),
  });
  app.mount(host);
  unmount = () => app.unmount();
  await nextTick();
  return state;
}
function click(text: string) {
  (
    [...document.querySelectorAll('button')].find(
      (b) => b.textContent === text,
    ) as HTMLButtonElement
  )?.click();
}

describe('菜单功能树交互', () => {
  it('uses one tree, deduplicates dependent APIs and never selects parent automatically', async () => {
    const state = await mount();
    expect(document.querySelectorAll('[data-tree]')).toHaveLength(1);
    expect(
      document.querySelector<HTMLElement>('[data-tree]')?.dataset.autoParent,
    ).toBe('false');
    expect(document.querySelector('summary')?.textContent).toContain('2');
    expect(document.querySelector('details code')).toBeNull();
    const details = document.querySelector('details');
    if (!details) throw new Error('缺少 API 明细');
    details.open = true;
    details.dispatchEvent(new Event('toggle'));
    await nextTick();
    expect(document.querySelectorAll('details code')).toHaveLength(2);
    click('选择页面');
    await nextTick();
    expect(state.ids).toEqual(['menu']);
    expect(document.body.textContent).not.toContain('保存内容');
    expect(document.body.textContent).toContain('列表读取');
  });
  it('clears only searched grants and preserves hidden page authorization', async () => {
    const state = await mount();
    const search = document.querySelector('input');
    if (!search) throw new Error('缺少权限搜索框');
    search.value = '编辑';
    search.dispatchEvent(new Event('input'));
    await nextTick();
    click('清空当前结果');
    await nextTick();
    // 搜索结果包括结构祖先，但页面本身不匹配时不得撤掉它。
    expect(state.ids).toEqual(['menu']);
  });
  it('readonly detail cannot change grants', async () => {
    const state = await mount(true);
    expect(
      document.querySelector('[data-tree]')?.hasAttribute('disabled'),
    ).toBe(true);
    expect(document.body.textContent).not.toContain('清空当前结果');
    click('选择页面');
    await nextTick();
    expect(state.ids).toEqual(['menu', 'write']);
  });
});
