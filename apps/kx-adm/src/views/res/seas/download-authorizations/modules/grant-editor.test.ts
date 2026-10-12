/* eslint-disable vue/one-component-per-file, vue/require-prop-types -- 授权交互测试宿主。 */
import type { GrantRow } from '#/api/res/grant-maintenance';

import { createApp, h, nextTick, ref } from 'vue';

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const calls = vi.hoisted(() => ({ create: vi.fn(), change: vi.fn() }));
vi.mock('#/api/res/grant-maintenance', async () => {
  const actual = await import('../../../../../api/res/grant-maintenance');
  return { ...actual, grantApi: () => calls };
});
vi.mock('#/api/request', () => ({ requestClient: {} }));
vi.mock('#/request-errors', () => ({
  requestErrorMessage: (error: Error) => error.message,
}));
vi.mock('./grant-resource-picker.vue', () => ({
  default: { template: '<div>作品选择器</div>' },
}));
vi.mock('#/components/user-tree-select', async () => {
  const { defineComponent, h } = await import('vue');
  return {
    default: defineComponent({
      props: ['value'],
      emits: ['update:value'],
      setup:
        (_p, { emit }) =>
        () =>
          h(
            'button',
            { onClick: () => emit('update:value', [7, 8]) },
            '选择组织用户',
          ),
    }),
  };
});
vi.mock('./grant-fields.vue', () => ({
  default: { template: '<div>范围字段</div>' },
}));
vi.mock('antdv-next', async () => {
  const { defineComponent, h } = await import('vue');
  const Wrap = defineComponent({
    setup:
      (_p, { slots }) =>
      () =>
        h('div', slots.default?.()),
  });
  const Modal = defineComponent({
    props: ['open', 'title'],
    emits: ['ok'],
    setup:
      (p, { slots, emit }) =>
      () =>
        p.open
          ? h('section', [
              h('h2', p.title),
              slots.default?.(),
              h('button', { onClick: () => emit('ok') }, '保存授权'),
            ])
          : null,
  });
  const CheckboxGroup = defineComponent({
    props: ['value', 'options'],
    emits: ['update:value'],
    setup:
      (p, { emit }) =>
      () =>
        h(
          'div',
          p.options.map((item: { value: string; label: string }) =>
            h(
              'button',
              { onClick: () => emit('update:value', [item.value]) },
              item.label,
            ),
          ),
        ),
  });
  return {
    Form: Wrap,
    FormItem: Wrap,
    Alert: defineComponent({
      props: ['message'],
      setup: (p) => () => h('p', p.message),
    }),
    Modal,
    CheckboxGroup,
    Select: Wrap,
    Table: Wrap,
  };
});
let cleanup: (() => void) | undefined;
beforeEach(() => {
  calls.create.mockReset().mockResolvedValue(2);
  calls.change.mockReset().mockResolvedValue(2);
});
afterEach(() => {
  cleanup?.();
  document.body.innerHTML = '';
});
async function settle() {
  await nextTick();
  await Promise.resolve();
  await nextTick();
}
async function mount(targets: GrantRow[] = []) {
  const { default: Editor } = await import('./grant-editor.vue');
  const open = ref(false);
  const root = document.createElement('div');
  document.body.append(root);
  const app = createApp({
    render: () =>
      h(Editor, {
        open: open.value,
        'onUpdate:open': (v: boolean) => (open.value = v),
        delivery: true,
        targets,
        tree: [],
        treeLoading: false,
        treeError: '',
        fixedResource: {
          res_id: -1,
          name: '项目',
          code: 'WORK-A',
          versions: [{ id: 11, name: '首轮交付' }],
        },
        fixedVersion: 11,
      }),
  });
  app.mount(root);
  cleanup = () => app.unmount();
  open.value = true;
  await settle();
  return { open, root };
}
async function click(label: string) {
  const button = [...document.querySelectorAll('button')].find(
    (b) => b.textContent === label,
  );
  expect(button).toBeTruthy();
  button?.click();
  await settle();
}
const row = (id: number): GrantRow => ({
  resource_code: 'WORK-A',
  granted_by: 1,
  granted_by_name: '负责人',
  version_name: '成片',
  updated_at: 1,
  id,
  res_id: -id,
  res_name: '作品',
  uid: 7,
  user_name: '剪辑',
  snapshot: `snapshot-${id}`,
  delivery_version_id: 11,
  can_download: true,
  modules: ['film'],
  valid_from: 0,
  valid_until: 500,
  seq_from: 0,
  seq_until: 0,
});
it('组织树多用户新增明确绑定版本和模块', async () => {
  const { open } = await mount();
  await click('选择组织用户');
  await click('保存授权');
  expect(calls.create).toHaveBeenCalledWith(
    [{ res_id: -1, version_id: 11 }],
    [7, 8],
    expect.objectContaining({ modules: ['film'], can_download: true }),
  );
  expect(open.value).toBe(false);
});
it('批量修改必须选择字段，只提交选中的局部值与记录快照', async () => {
  const records = [row(1), row(2)];
  await mount(records);
  await click('保存授权');
  expect(calls.change).not.toHaveBeenCalled();
  expect(document.body.textContent).toContain('请勾选');
  await click('失效时间');
  await click('保存授权');
  expect(calls.change).toHaveBeenCalledWith(records, { valid_until: 500 });
});
it('并发冲突保留弹窗和错误，不能假报保存成功', async () => {
  calls.change.mockRejectedValue(new Error('授权已被修改，请刷新后重试'));
  const { open } = await mount([row(1)]);
  await click('保存授权');
  expect(open.value).toBe(true);
  expect(document.body.textContent).toContain('授权已被修改');
});
