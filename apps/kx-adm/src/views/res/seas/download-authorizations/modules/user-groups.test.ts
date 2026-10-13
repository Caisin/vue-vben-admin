/* eslint-disable vue/one-component-per-file, vue/require-prop-types -- 快速选择组测试宿主。 */
import { createApp, h, nextTick, ref } from 'vue';

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}));
vi.mock('#/api/res/downloads', () => ({ DownloadUserGroupApi: api }));
vi.mock('#/request-errors', () => ({
  requestErrorMessage: (e: Error) => e.message,
}));
vi.mock('antdv-next', async () => {
  const { defineComponent, h } = await import('vue');
  const Wrap = defineComponent({
    setup:
      (_p, { slots }) =>
      () =>
        h('div', slots.default?.()),
  });
  return {
    Space: Wrap,
    Popconfirm: defineComponent({
      emits: ['confirm'],
      setup:
        (_p, { slots, emit }) =>
        () =>
          h('div', { onClick: () => emit('confirm') }, slots.default?.()),
    }),
    Alert: defineComponent({
      props: ['message'],
      setup: (p) => () => h('p', p.message),
    }),
    Button: defineComponent({
      props: ['disabled'],
      setup:
        (p, { slots }) =>
        () =>
          h('button', { disabled: p.disabled }, slots.default?.()),
    }),
    Input: defineComponent({
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
    Select: defineComponent({
      props: ['value', 'options'],
      emits: ['change'],
      setup:
        (p, { emit }) =>
        () =>
          h(
            'select',
            {
              value: p.value,
              onChange: (e: Event) =>
                emit('change', (e.target as HTMLSelectElement).value),
            },
            [
              h('option', { value: '' }, '请选择'),
              ...p.options.map((o: { value: string; label: string }) =>
                h('option', { value: o.value }, o.label),
              ),
            ],
          ),
    }),
  };
});
let dispose: (() => void) | undefined;
const original = { id: 1, name: '剪辑组', uids: [7, 8, 9], revision: 1 };
beforeEach(() => {
  vi.resetAllMocks();
  api.list.mockResolvedValue([original]);
  api.create.mockResolvedValue({
    id: 2,
    name: '我的组',
    uids: [7],
    revision: 1,
  });
  api.update.mockResolvedValue({ ...original, uids: [7], revision: 2 });
  api.remove.mockResolvedValue(true);
});
afterEach(() => {
  dispose?.();
  document.body.innerHTML = '';
});
async function settle() {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
    await nextTick();
  }
}
async function mount() {
  const { default: Groups } = await import('./user-groups.vue');
  const value = ref([7]);
  const root = document.createElement('div');
  document.body.append(root);
  const app = createApp({
    render: () =>
      h(Groups, {
        value: value.value,
        'onUpdate:value': (v: number[]) => (value.value = v),
        tree: [7, 8].map((id) => ({
          value: String(id),
          title: String(id),
          selectable: true,
          disabled: id === 8,
          children: [],
        })),
      }),
  });
  app.mount(root);
  dispose = () => app.unmount();
  await settle();
  return value;
}
async function click(label: string) {
  const b = [...document.querySelectorAll('button')].find(
    (b) => b.textContent?.trim() === label,
  );
  expect(b).toBeTruthy();
  b?.click();
  await settle();
}
async function selectGroup() {
  const select = document.querySelector('select');
  if (!select) throw new Error('缺少组选择器');
  select.value = '1';
  select.dispatchEvent(new Event('change'));
  await settle();
}
it('命名保存后可再次套用，旧组跳过不可授权成员并保留明确人数提示', async () => {
  const value = await mount();
  const input = document.querySelector('input');
  if (!input) throw new Error('缺少组名称输入');
  input.value = '我的组';
  input.dispatchEvent(new Event('input'));
  await settle();
  await click('将当前选择保存为新组');
  expect(api.create).toHaveBeenCalledWith('我的组', [7]);
  expect(document.body.textContent).toContain('已保存“我的组”');
  await selectGroup();
  expect(value.value).toEqual([7]);
  expect(document.body.textContent).toContain('跳过 2 位');
  await click('覆盖当前组名称和成员');
  expect(api.update).toHaveBeenCalledWith(original, '剪辑组', [7]);
  await click('删除组');
  expect(api.remove).toHaveBeenCalledWith(
    expect.objectContaining({ revision: 2 }),
  );
  expect(value.value).toEqual([7]);
});
it('冲突保留输入和选择，刷新后使用最新修订重试', async () => {
  await mount();
  await selectGroup();
  api.update.mockRejectedValueOnce(new Error('组已变更，请刷新'));
  await click('覆盖当前组名称和成员');
  expect(document.body.textContent).toContain('组已变更，请刷新');
  expect(document.querySelector('input')?.value).toBe('剪辑组');
  api.list.mockResolvedValue([{ ...original, revision: 3 }]);
  await click('刷新组');
  await click('覆盖当前组名称和成员');
  expect(api.update).toHaveBeenLastCalledWith(
    expect.objectContaining({ revision: 3 }),
    '剪辑组',
    [7],
  );
});
it('加载失败可重试且不影响当前选择', async () => {
  api.list.mockRejectedValueOnce(new Error('离线'));
  const value = await mount();
  expect(document.body.textContent).toContain('离线');
  await click('刷新组');
  expect(api.list).toHaveBeenCalledTimes(2);
  expect(value.value).toEqual([7]);
});
