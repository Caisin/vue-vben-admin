/* eslint-disable vue/one-component-per-file -- 权限交互测试的组件桩。 */
import { createApp, h, nextTick } from 'vue';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { useColumns } from './data';
const state = vi.hoisted(() => ({ codes: new Set<string>() }));
vi.mock('@vben/access', () => ({
  useAccess: () => ({
    hasAccessByCodes: (codes: string[]) =>
      codes.some((c) => state.codes.has(c)),
  }),
}));
vi.mock('@vben/common-ui', async () => {
  const { defineComponent, h } = await import('vue');
  return {
    Page: defineComponent({
      setup:
        (_p, { slots }) =>
        () =>
          h('div', slots.default?.()),
    }),
    useVbenDrawer: () => [() => null, { setData: () => ({ open: vi.fn() }) }],
  };
});
vi.mock('@vben/icons', () => ({ Plus: () => null }));
vi.mock('antdv-next', async () => {
  const { defineComponent, h } = await import('vue');
  return {
    Button: defineComponent({
      props: { disabled: Boolean },
      setup:
        (p, { slots }) =>
        () =>
          h('button', { disabled: p.disabled }, slots.default?.()),
    }),
  };
});
vi.mock('./modules/form.vue', () => ({ default: {} }));
vi.mock('#/api/asset/asset', () => ({ AssetApi: {} }));
vi.mock('#/adapter/vxe-table', async () => {
  const { defineComponent, h } = await import('vue');
  return {
    useVbenVxeGrid: () => [
      defineComponent({
        setup:
          (_p, { slots }) =>
          () =>
            h('div', [
              slots['toolbar-tools']?.(),
              slots.nameCell?.({ row: { id: 1, name: '积分' } }),
            ]),
      }),
      {},
    ],
  };
});
let stop: (() => void) | undefined;
afterEach(() => {
  stop?.();
  document.body.innerHTML = '';
  state.codes.clear();
});
async function mount(code?: string) {
  if (code) state.codes.add(code);
  const { default: Page } = await import('./list.vue');
  const host = document.createElement('div');
  document.body.append(host);
  const app = createApp({ render: () => h(Page) });
  app.directive('access', {
    mounted(el, binding) {
      if (!state.codes.has(binding.value)) el.remove();
    },
  });
  app.mount(host);
  stop = () => app.unmount();
  await nextTick();
}
describe('资产按钮权限', () => {
  it('只读用户保留名称且不能点击编辑和创建', async () => {
    await mount();
    expect(document.body.textContent).toContain('积分');
    expect(document.body.textContent).not.toContain('新建资产');
    expect(document.querySelector('button')?.disabled).toBe(true);
  });
  it('仅新增不会自动获得编辑和状态切换', async () => {
    await mount('api:asset.item.create');
    expect(document.body.textContent).toContain('新建资产');
    const edit = [...document.querySelectorAll('button')].find(
      (b) => b.textContent === '积分',
    );
    expect(edit?.disabled).toBe(true);
    expect(
      useColumns(async () => true)?.find((c) => c.field === 'enabled')
        ?.cellRender?.attrs?.auth,
    ).toBe('api:asset.item.update');
  });
});
