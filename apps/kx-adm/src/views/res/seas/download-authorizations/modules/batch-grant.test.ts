/* eslint-disable vue/one-component-per-file, vue/require-prop-types -- 授权预览组件测试桩。 */
import { createApp, h, nextTick, ref } from 'vue';

import { afterEach, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ previewBatch: vi.fn(), saveBatch: vi.fn() }));
vi.mock('#/api/res/downloads', () => ({
  ResDownloadApi: api,
  DeliveryBatchApi: {},
}));
vi.mock('#/api/res/grant-maintenance', () => ({ grantModules: [] }));
vi.mock('#/components/user-tree-select', () => ({
  default: { template: '<div />' },
}));
vi.mock('./user-groups.vue', () => ({ default: { template: '<div />' } }));
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
  const TextArea = defineComponent({
    props: ['value'],
    emits: ['update:value'],
    setup:
      (p, { emit }) =>
      () =>
        h('textarea', {
          value: p.value,
          onInput: (e: Event) =>
            emit('update:value', (e.target as HTMLTextAreaElement).value),
        }),
  });
  return {
    Alert: defineComponent({
      props: ['message'],
      setup: (p) => () => h('p', p.message),
    }),
    Button: defineComponent({
      setup:
        (_p, { slots }) =>
        () =>
          h('button', slots.default?.()),
    }),
    CheckboxGroup: Wrap,
    DatePicker: { RangePicker: Wrap },
    Form: Wrap,
    FormItem: Wrap,
    Input: { TextArea },
    InputNumber: Wrap,
    Select: Wrap,
    Space: Wrap,
    Tag: Wrap,
    Modal: defineComponent({
      props: ['open'],
      setup:
        (p, { slots }) =>
        () =>
          p.open ? h('section', slots.default?.()) : null,
    }),
    message: { success: vi.fn() },
    Table: defineComponent({
      props: ['dataSource', 'columns'],
      setup:
        (p, { slots }) =>
        () =>
          h(
            'div',
            p.dataSource.flatMap((record: unknown) =>
              p.columns.map((column: unknown) =>
                slots.bodyCell?.({ record, column }),
              ),
            ),
          ),
    }),
  };
});
let cleanup: (() => void) | undefined;
afterEach(() => {
  cleanup?.();
  document.body.innerHTML = '';
});

it('单条匹配只显示一个移除，多条变为单条后隐藏移除全部，提交只包含保留项', async () => {
  const matches = [1, 2].map((res_id) => ({
    res_id,
    res_name: `剧${res_id}`,
    resource_code: 'DR1',
    seq_num: 10,
  }));
  api.previewBatch.mockResolvedValue({
    lines: [
      {
        line: 1,
        input: 'DR1',
        status: 'matched',
        message: '匹配2部剧',
        matches,
      },
    ],
    matched_res_ids: [1, 2],
    granted_count: 0,
    granted_user_count: 0,
    revoked_count: 0,
  });
  api.saveBatch.mockResolvedValue({
    lines: [],
    matched_res_ids: [1, 2],
    granted_count: 1,
    granted_user_count: 1,
    revoked_count: 0,
  });
  api.previewBatch.mockResolvedValueOnce({
    lines: [
      {
        line: 1,
        input: 'DR1',
        status: 'matched',
        message: '匹配1部剧',
        matches: matches.slice(0, 1),
      },
    ],
    matched_res_ids: [1],
    granted_count: 0,
    granted_user_count: 0,
    revoked_count: 0,
  });
  const { default: BatchGrant } = await import('./batch-grant.vue');
  const open = ref(false);
  const host = document.createElement('div');
  document.body.append(host);
  const app = createApp({
    render: () =>
      h(BatchGrant, {
        open: open.value,
        initialUids: [7],
        userTree: [
          {
            value: '7',
            title: '用户',
            selectable: true,
            disabled: false,
            children: [],
          },
        ],
        userTreeLoading: false,
        userTreeError: '',
      }),
  });
  app.mount(host);
  cleanup = () => app.unmount();
  open.value = true;
  await nextTick();
  await nextTick();
  const input = host.querySelector('textarea');
  if (!input) throw new Error('缺少编码输入框');
  input.value = 'DR1';
  input.dispatchEvent(new Event('input'));
  await nextTick();
  const button = (text: string) => {
    const found = [...host.querySelectorAll('button')].find(
      (b) => b.textContent?.replaceAll(/\s/g, '') === text,
    );
    if (!found) throw new Error(`缺少按钮 ${text}`);
    return found;
  };
  button('预览匹配').click();
  await expect
    .poll(() => host.querySelectorAll('button[aria-label^="移除剧目"]').length)
    .toBe(1);
  expect(
    host.querySelectorAll('button[aria-label="移除 DR1 全部剧目"]'),
  ).toHaveLength(0);
  button('预览匹配').click();
  await expect
    .poll(() => host.querySelectorAll('button[aria-label^="移除剧目"]').length)
    .toBe(2);
  expect(
    host.querySelectorAll('button[aria-label="移除 DR1 全部剧目"]'),
  ).toHaveLength(1);
  host
    .querySelector<HTMLButtonElement>('button[aria-label="移除剧目 剧2 #2"]')
    ?.click();
  await nextTick();
  expect(host.querySelectorAll('button[aria-label^="移除剧目"]')).toHaveLength(
    1,
  );
  expect(
    host.querySelectorAll('button[aria-label="移除 DR1 全部剧目"]'),
  ).toHaveLength(0);
  button('确认向1人授权1部剧').click();
  await expect.poll(() => api.saveBatch.mock.calls.length).toBe(1);
  expect(api.saveBatch.mock.calls[0]?.[0]).toMatchObject({
    expected_res_ids: [1, 2],
    selected_res_ids: [1],
  });
});
