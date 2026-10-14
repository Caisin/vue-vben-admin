/* eslint-disable vue/one-component-per-file, vue/require-prop-types -- 原始组织页面交互桩。 */
import { createApp, h } from 'vue';

import { afterEach, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({
  sources: vi.fn(),
  departments: vi.fn(),
  members: vi.fn(),
}));
vi.mock('#/api/system/dingtalk-directory', () => ({
  DingtalkDirectoryApi: api,
}));
vi.mock('#/request-errors', () => ({
  requestErrorMessage: (error: Error) => error.message,
}));
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
    Select: Wrap,
    TreeSelect: Wrap,
    Input: Wrap,
    Checkbox: Wrap,
    Empty: Wrap,
    Tag: Wrap,
    Button: defineComponent({
      setup:
        (_p, { slots }) =>
        () =>
          h('button', slots.default?.()),
    }),
    Alert: defineComponent({
      props: ['message'],
      setup: (p) => () => h('p', p.message),
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
afterEach(() => {
  cleanup?.();
  document.body.innerHTML = '';
});
it('使用钉钉来源标识读取部门和成员，原始快照可在页面展开', async () => {
  api.sources.mockResolvedValue([
    { code: 'dingtalk:company-a', name: '甲公司' },
  ]);
  api.departments.mockResolvedValue([
    {
      id: '1',
      parent_id: '0',
      name: '原始研发部',
      active: true,
      synced_at: 1,
      raw: { dept_id: 1, name: '原始研发部' },
    },
  ]);
  api.members.mockResolvedValue({
    total: 1,
    items: [
      {
        id: 'external-user',
        name: '钉钉张三',
        departments: ['1'],
        synced_at: 1,
        raw: { userid: 'external-user', mobile: 'fixture' },
      },
    ],
  });
  const { default: Directory } = await import('./directory.vue');
  const host = document.createElement('div');
  document.body.append(host);
  const app = createApp({ render: () => h(Directory) });
  app.mount(host);
  cleanup = () => app.unmount();
  await expect.poll(() => api.members.mock.calls.length).toBe(1);
  expect(api.departments).toHaveBeenCalledWith('company-a');
  expect(api.members.mock.calls[0]?.[0]).toMatchObject({
    source_id: 'company-a',
    include_children: true,
  });
  const buttons = [...host.querySelectorAll('button')].filter(
    (b) => b.textContent?.trim() === '查看原始信息',
  );
  expect(buttons).toHaveLength(2);
  buttons[1]?.click();
  await expect
    .poll(() => host.querySelector('[aria-label="钉钉原始信息"]')?.textContent)
    .toContain('external-user');
});
