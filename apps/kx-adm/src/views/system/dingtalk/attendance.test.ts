/* eslint-disable vue/one-component-per-file, vue/require-prop-types -- 页面交互测试桩。 */
import { createApp, h, nextTick } from 'vue';

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({
  sources: vi.fn(),
  departments: vi.fn(),
  history: vi.fn(),
  create: vi.fn(),
  records: vi.fn(),
  download: vi.fn(),
}));
const save = vi.hoisted(() => vi.fn());
vi.mock('#/api/system/dingtalk-directory', () => ({
  DingtalkDirectoryApi: api,
}));
vi.mock('#/request-errors', () => ({
  requestErrorMessage: (e: Error) => e.message,
}));
vi.mock('@vben/access', () => ({
  useAccess: () => ({ hasAccessByCodes: () => true }),
}));
vi.mock('@vben/utils', () => ({ downloadFileFromBlob: save }));
vi.mock('@vben/common-ui', () => ({
  Page: { template: '<div><slot /></div>' },
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
    Empty: Wrap,
    Checkbox: Wrap,
    DatePicker: { RangePicker: Wrap },
    Select: Wrap,
    TreeSelect: Wrap,
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
const job = {
  id: 1,
  request: {
    source_id: 'a',
    include_children: true,
    date_from: '2026-10-01',
    date_to: '2026-10-07',
  },
  state: 'succeeded',
  error: '',
  member_count: 2,
  record_count: 1,
  completed: 1,
  total: 1,
  created_at: 1,
};
beforeEach(() => {
  vi.clearAllMocks();
  api.sources.mockResolvedValue([
    { code: 'dingtalk:a', name: '甲公司', enabled: true },
  ]);
  api.departments.mockResolvedValue([]);
  api.history.mockResolvedValue({ items: [], total: 0 });
  api.create.mockResolvedValue(job);
  api.records.mockResolvedValue({ items: [], total: 0 });
  api.download.mockResolvedValue(new Blob(['xlsx']));
});
afterEach(() => {
  cleanup?.();
  document.body.innerHTML = '';
});
async function mount() {
  const { default: Page } = await import('./attendance.vue');
  const root = document.createElement('div');
  document.body.append(root);
  const app = createApp({ render: () => h(Page) });
  app.mount(root);
  cleanup = () => app.unmount();
  await expect.poll(() => api.history.mock.calls.length).toBe(1);
  return root;
}
function button(root: HTMLElement, text: string) {
  const b = [...root.querySelectorAll('button')].find(
    (b) => b.textContent?.trim() === text,
  );
  if (!b) throw new Error(`缺少${text}`);
  return b;
}
it('提交所选公司和日期，完成记录可查看并下载，失败展示原因', async () => {
  const root = await mount();
  api.history.mockResolvedValue({ items: [job], total: 1 });
  button(root, '查询考勤').click();
  await expect.poll(() => api.create.mock.calls.length).toBe(1);
  expect(api.create.mock.calls[0]?.[0]).toMatchObject({
    source_id: 'a',
    include_children: true,
  });
  await expect.poll(() => root.textContent).toContain('2 人 / 1 条');
  await expect.poll(() => api.records.mock.calls.length).toBe(1);
  button(root, '查看结果').click();
  await expect.poll(() => api.records.mock.calls.length).toBe(2);
  button(root, '下载 Excel').click();
  await expect.poll(() => save.mock.calls.length).toBe(1);
  expect(api.download).toHaveBeenCalledWith(1);
  api.create.mockRejectedValueOnce(new Error('没有考勤权限'));
  await nextTick();
  button(root, '查询考勤').click();
  await expect.poll(() => root.textContent).toContain('没有考勤权限');
});
it('查询中自动轮询直到完成并加载结果', async () => {
  const root = await mount();
  api.create.mockResolvedValue({ ...job, state: 'running' });
  api.history
    .mockResolvedValueOnce({ items: [{ ...job, state: 'running' }], total: 1 })
    .mockResolvedValue({ items: [job], total: 1 });
  button(root, '查询考勤').click();
  await expect
    .poll(() => api.records.mock.calls.length, { timeout: 4000 })
    .toBe(1);
  expect(api.history.mock.calls.length).toBeGreaterThan(2);
});
