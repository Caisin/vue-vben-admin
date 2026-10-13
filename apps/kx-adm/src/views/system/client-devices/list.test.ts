/* eslint-disable vue/one-component-per-file, vue/require-prop-types -- 同文件定义只用于交互测试的组件桩。 */
import { createApp, nextTick } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  page: vi.fn(),
  users: vi.fn(),
  authorize: vi.fn(),
  revoke: vi.fn(),
  edit: vi.fn(),
  events: vi.fn(),
  confirm: vi.fn(),
  success: vi.fn(),
  canManage: true,
}));
vi.mock('@vben/access', () => ({
  useAccess: () => ({ hasAccessByCodes: () => state.canManage }),
}));
vi.mock('@vben/common-ui', async () => {
  const { defineComponent, h } = await import('vue');
  return {
    Page: defineComponent({
      setup:
        (_p, { slots }) =>
        () =>
          h('main', slots.default?.()),
    }),
  };
});
vi.mock('#/api/system/client-devices', () => ({ ClientDeviceApi: state }));
vi.mock('#/api/system/user', () => ({
  SystemUserApi: { options: vi.fn(async () => ({ items: [], total: 0 })) },
}));
vi.mock('#/request-errors', () => ({
  requestErrorMessage: (error: Error) => error.message,
}));
vi.mock('#/times', () => ({ Times: { formatUnix: String } }));
vi.mock('antdv-next', async () => {
  const { defineComponent, h } = await import('vue');
  const Wrap = defineComponent({
    setup:
      (_p, { slots }) =>
      () =>
        h('div', slots.default?.()),
  });
  const Button = defineComponent({
    emits: ['click'],
    setup:
      (_p, { slots, emit }) =>
      () =>
        h('button', { onClick: () => emit('click') }, slots.default?.()),
  });
  const Dialog = defineComponent({
    props: ['open'],
    emits: ['ok'],
    setup:
      (p, { slots, emit }) =>
      () =>
        p.open
          ? h('aside', [
              slots.default?.(),
              h('button', { onClick: () => emit('ok') }, '保存'),
            ])
          : null,
  });
  const Input = Object.assign(
    defineComponent({
      props: ['value'],
      emits: ['update:value'],
      setup:
        (p, { emit }) =>
        () =>
          h('input', {
            value: p.value,
            onInput: (event: Event) =>
              emit('update:value', (event.target as HTMLInputElement).value),
          }),
    }),
    { TextArea: Wrap },
  );
  const Table = defineComponent({
    props: ['dataSource', 'columns', 'pagination'],
    setup:
      (p, { slots }) =>
      () =>
        h('section', [
          ...p.dataSource.map((record: Record<string, unknown>) =>
            h(
              'article',
              p.columns.map((column: Record<string, string>) =>
                h(
                  'div',
                  column.key
                    ? slots.bodyCell?.({ column, record })
                    : String(record[column.dataIndex ?? ''] ?? ''),
                ),
              ),
            ),
          ),
          ...(p.pagination?.onChange
            ? [
                h(
                  'button',
                  { onClick: () => p.pagination.onChange(2) },
                  '第2页',
                ),
              ]
            : []),
        ]),
  });
  const Select = defineComponent({
    props: ['value', 'options'],
    emits: ['update:value', 'change', 'focus', 'search'],
    setup:
      (p, { emit }) =>
      () =>
        h(
          'select',
          {
            value: p.value ?? '',
            onFocus: () => emit('focus'),
            onChange: (event: Event) => {
              const value =
                (event.target as HTMLSelectElement).value || undefined;
              emit('update:value', value);
              emit('change', value);
            },
          },
          [
            h('option', { value: '' }, '全部'),
            ...(p.options ?? []).map(
              (option: { value: string; label: string }) =>
                h('option', { value: option.value }, option.label),
            ),
          ],
        ),
  });
  return {
    Alert: defineComponent({
      props: ['message'],
      setup:
        (p, { slots }) =>
        () =>
          h('div', [h('p', p.message), slots.action?.()]),
    }),
    Button,
    Drawer: Dialog,
    Form: Wrap,
    FormItem: Wrap,
    Input,
    Modal: Object.assign(Dialog, { confirm: state.confirm }),
    Select,
    Space: Wrap,
    Table,
    Tag: Wrap,
    message: { success: state.success },
  };
});
let unmount: (() => void) | undefined;
beforeEach(() => {
  state.users
    .mockReset()
    .mockResolvedValue({ items: [{ uid: 701, name: '张三' }], total: 1 });
});
afterEach(() => {
  unmount?.();
  document.body.innerHTML = '';
  vi.clearAllMocks();
  state.canManage = true;
});
async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await nextTick();
}
function click(label: string) {
  const button = [...document.querySelectorAll('button')].find(
    (v) => v.textContent?.trim() === label,
  );
  expect(button, `missing ${label}`).toBeDefined();
  button?.click();
}
async function mount() {
  const { default: Page } = await import('./list.vue');
  const host = document.createElement('div');
  document.body.append(host);
  const app = createApp(Page);
  app.mount(host);
  unmount = () => app.unmount();
  await flush();
}
describe('设备管理操作闭环', () => {
  it('按设备授权、刷新状态、查看审计并撤销', async () => {
    const row = {
      device_id: 'a'.repeat(64),
      name: '研发电脑',
      os: 'macos',
      app_version: '1',
      status: 'pending',
      assigned_uid: null,
      assigned_name: '',
      requested_name: '张三',
      requested_org_paths: ['甲公司 / 研发部 / 前端组', '甲公司 / 测试部'],
      last_login_name: '',
      remark: '',
    };
    state.page.mockImplementation(async () => ({
      items: [{ ...row }],
      total: 1,
    }));
    state.authorize.mockImplementation(async () => {
      row.status = 'approved';
    });
    state.revoke.mockImplementation(async () => {
      row.status = 'revoked';
    });
    state.events.mockResolvedValue({
      items: [
        {
          id: 1,
          user_name: '管理员',
          action: 'authorize',
          ip: '127.0.0.1',
          created_at: 1,
        },
      ],
      total: 1,
    });
    await mount();
    expect(document.body.textContent).toContain('待审核');
    expect(document.body.textContent).toContain('张三');
    expect(document.body.textContent).toContain('甲公司 / 研发部 / 前端组');
    expect(document.body.textContent).toContain('甲公司 / 测试部');
    click('授权');
    await state.confirm.mock.calls.at(-1)?.[0].onOk();
    await flush();
    expect(state.authorize).toHaveBeenCalledWith(row.device_id);
    expect(document.body.textContent).toContain('已授权');
    click('记录');
    await flush();
    expect(state.events).toHaveBeenCalledWith(row.device_id, 1);
    expect(document.body.textContent).toContain('管理员');
    click('撤销');
    await state.confirm.mock.calls.at(-1)?.[0].onOk();
    await flush();
    expect(state.revoke).toHaveBeenCalledWith(row.device_id);
    expect(document.body.textContent).toContain('已撤销');
    expect(state.page).toHaveBeenCalledTimes(3);
  });
  it('无操作权限时隐藏授权和编辑入口', async () => {
    state.canManage = false;
    state.page.mockResolvedValue({
      items: [
        {
          device_id: 'b',
          name: '设备',
          status: 'pending',
          assigned_name: '李四',
        },
      ],
      total: 1,
    });
    await mount();
    const labels = [...document.querySelectorAll('button')].map(
      (v) => v.textContent,
    );
    expect(labels).not.toContain('授权');
    expect(labels).not.toContain('指定使用人');
    expect(labels).toContain('记录');
  });
});

it('筛选人员或身份时从第一页查询，清空与重置恢复全部人员', async () => {
  state.page.mockResolvedValue({
    items: [
      {
        device_id: 'd',
        requested_name: '张三',
        requested_org_paths: [],
        status: 'pending',
      },
    ],
    total: 30,
  });
  await mount();
  expect(document.body.textContent).toContain('暂无组织信息');
  click('第2页');
  await flush();
  expect(state.page).toHaveBeenLastCalledWith(
    expect.objectContaining({ page: 2 }),
  );
  const person = document.querySelector<HTMLSelectElement>(
    '#client-device-person',
  );
  const role = document.querySelector<HTMLSelectElement>(
    '#client-device-person-role',
  );
  if (!person || !role) throw new Error('人员筛选控件缺失');
  person.dispatchEvent(new Event('focus'));
  await flush();
  expect(state.users).toHaveBeenCalledWith({ keyword: '', page: 1, size: 50 });
  person.value = '701';
  person.dispatchEvent(new Event('change'));
  await flush();
  expect(state.page).toHaveBeenLastCalledWith(
    expect.objectContaining({ page: 1, uid: '701', user_role: 'any' }),
  );
  role.value = 'requested';
  role.dispatchEvent(new Event('change'));
  await flush();
  expect(state.page).toHaveBeenLastCalledWith(
    expect.objectContaining({ uid: '701', user_role: 'requested' }),
  );
  person.value = '';
  person.dispatchEvent(new Event('change'));
  await flush();
  expect(state.page).toHaveBeenLastCalledWith(
    expect.objectContaining({ uid: undefined, page: 1 }),
  );
  click('重置');
  await flush();
  expect(state.page).toHaveBeenLastCalledWith(
    expect.objectContaining({
      uid: undefined,
      user_role: 'any',
      keyword: '',
      status: undefined,
      page: 1,
    }),
  );
});
it('人员选项失败可原地重试，列表失败不保留误导性的旧筛选结果', async () => {
  state.page.mockResolvedValue({ items: [], total: 0 });
  state.users.mockRejectedValueOnce(new Error('人员读取失败'));
  await mount();
  document
    .querySelector('#client-device-person')
    ?.dispatchEvent(new Event('focus'));
  await flush();
  expect(document.body.textContent).toContain('人员读取失败');
  click('重试加载人员');
  await flush();
  expect(state.users).toHaveBeenCalledTimes(2);
  state.page.mockRejectedValueOnce(new Error('设备读取失败'));
  click('查询');
  await flush();
  expect(document.body.textContent).toContain('设备读取失败');
});
