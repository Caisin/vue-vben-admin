/* eslint-disable vue/one-component-per-file, vue/require-prop-types -- 授权页面交互组件桩。 */
import { createApp, h, nextTick } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  codes: new Set<string>(),
  api: {
    configUsers: vi.fn(),
    configRoles: vi.fn(),
    configOrganizations: vi.fn(),
    saveConfig: vi.fn(),
    roles: vi.fn(),
    members: vi.fn(),
    candidates: vi.fn(),
    addMembers: vi.fn(),
    removeMember: vi.fn(),
  },
  error: vi.fn(),
  success: vi.fn(),
}));
vi.mock('#/api/system/role-assignment', () => ({
  RoleAssignmentApi: state.api,
}));
vi.mock('#/request-errors', () => ({
  requestErrorMessage: (error: Error) => error.message,
}));
vi.mock('@vben/access', () => ({
  useAccess: () => ({
    hasAccessByCodes: (codes: string[]) =>
      codes.some((code) => state.codes.has(code)),
  }),
}));
vi.mock('@vben/icons', () => ({ IconifyIcon: { render: () => h('svg') } }));
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
    Checkbox: defineComponent({
      props: ['checked', 'disabled'],
      emits: ['update:checked'],
      setup:
        (p, { emit, slots }) =>
        () =>
          h('label', [
            h('input', {
              type: 'checkbox',
              checked: p.checked,
              disabled: p.disabled,
              onChange: (event: Event) =>
                emit(
                  'update:checked',
                  (event.target as HTMLInputElement).checked,
                ),
            }),
            slots.default?.(),
          ]),
    }),
    Tree: defineComponent({
      props: ['checkedKeys'],
      emits: ['check'],
      setup:
        (p, { emit }) =>
        () =>
          h(
            'button',
            {
              'aria-label': '选择公司乙',
              onClick: () =>
                emit('check', {
                  checked: [...(p.checkedKeys ?? []), 'company:b'],
                }),
            },
            '公司乙',
          ),
    }),
    Empty: Wrap,
    Tag: Wrap,
    Tooltip: Wrap,
    Input: defineComponent({
      props: ['value'],
      emits: ['update:value', 'pressEnter'],
      setup:
        (p, { emit }) =>
        () =>
          h('input', {
            value: p.value,
            onInput: (e: Event) =>
              emit('update:value', (e.target as HTMLInputElement).value),
            onKeydown: (e: KeyboardEvent) => {
              if (e.key === 'Enter') emit('pressEnter');
            },
          }),
    }),
    Select: defineComponent({
      props: ['value', 'options', 'mode'],
      emits: ['update:value'],
      setup:
        (p, { emit }) =>
        () =>
          h(
            'select',
            {
              multiple: p.mode === 'multiple',
              value: p.value,
              onChange: (e: Event) => {
                const select = e.target as HTMLSelectElement;
                emit(
                  'update:value',
                  p.mode === 'multiple'
                    ? [...select.selectedOptions].map((o) => o.value)
                    : select.value,
                );
              },
            },
            (p.options ?? []).map((o: { label: string; value: string }) =>
              h(
                'option',
                {
                  value: o.value,
                  selected: Array.isArray(p.value)
                    ? p.value.includes(o.value)
                    : p.value === o.value,
                },
                o.label,
              ),
            ),
          ),
    }),
    Modal: defineComponent({
      props: ['open', 'title', 'okButtonProps'],
      emits: ['ok'],
      setup:
        (p, { slots, emit }) =>
        () =>
          p.open
            ? h('section', { 'data-modal': p.title }, [
                slots.default?.(),
                h(
                  'button',
                  {
                    'data-confirm': true,
                    disabled: p.okButtonProps?.disabled,
                    onClick: () => emit('ok'),
                  },
                  '保存',
                ),
              ])
            : null,
    }),
    Popconfirm: defineComponent({
      props: ['title'],
      emits: ['confirm'],
      setup:
        (p, { emit, slots }) =>
        () =>
          h('div', [
            slots.default?.(),
            h(
              'button',
              {
                'aria-label': `确认${p.title}`,
                onClick: () => emit('confirm'),
              },
              '确认移除',
            ),
          ]),
    }),
    Table: defineComponent({
      props: ['columns', 'dataSource', 'rowSelection', 'pagination'],
      emits: ['change'],
      setup:
        (p, { slots, emit }) =>
        () =>
          h('div', [
            ...(p.dataSource ?? []).map((row: { id: number; name: string }) =>
              h('article', [
                p.rowSelection
                  ? h('input', {
                      type: 'checkbox',
                      'aria-label': `选择${row.name}`,
                      checked: p.rowSelection.selectedRowKeys.includes(
                        String(row.id),
                      ),
                      onChange: (e: Event) =>
                        p.rowSelection.onChange(
                          (e.target as HTMLInputElement).checked
                            ? [
                                ...p.rowSelection.selectedRowKeys,
                                String(row.id),
                              ]
                            : p.rowSelection.selectedRowKeys.filter(
                                (id: string) => id !== String(row.id),
                              ),
                        ),
                    })
                  : null,
                ...(p.columns ?? []).map(
                  (column: { dataIndex?: string; key: string }) =>
                    h('div', slots.bodyCell?.({ column, record: row })),
                ),
              ]),
            ),
            h(
              'button',
              {
                'aria-label': p.rowSelection ? '候选下一页' : '成员下一页',
                onClick: () =>
                  emit('change', {
                    current: p.pagination.current + 1,
                    pageSize: 20,
                  }),
              },
              '下一页',
            ),
          ]),
    }),
    message: { error: state.error, success: state.success, warning: vi.fn() },
  };
});

let unmount: (() => void) | undefined;
async function flush() {
  await nextTick();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await nextTick();
}
async function mount(name: 'config' | 'index') {
  const module =
    name === 'config'
      ? await import('./config.vue')
      : await import('./index.vue');
  const component = module.default;
  const host = document.createElement('div');
  document.body.append(host);
  const app = createApp(component);
  app.mount(host);
  unmount = () => app.unmount();
  await flush();
}
function click(selector: string) {
  const button = document.querySelector<HTMLButtonElement>(selector);
  expect(button).not.toBeNull();
  button?.click();
}
const upload = { role_id: 'upload', role_name: '资源上传', enabled: true };
beforeEach(() => {
  state.api.configOrganizations.mockResolvedValue([
    { key: 'company:a', title: '公司甲', children: [] },
    { key: 'company:b', title: '公司乙', children: [] },
  ]);
  state.api.configUsers.mockResolvedValue({
    items: [{ id: 50, name: '张三', roles: [], enabled: true }],
    total: 1,
  });
  state.api.configRoles.mockResolvedValue([upload]);
  state.api.saveConfig.mockResolvedValue(undefined);
  state.api.roles.mockResolvedValue([upload]);
  state.api.members.mockResolvedValue({ items: [], total: 0 });
  state.api.candidates.mockImplementation((_role, params) =>
    Promise.resolve({
      items: [
        {
          id: params.page === 1 ? 51 : 52,
          name: params.page === 1 ? '李四' : '王五',
          enabled: true,
        },
      ],
      total: 21,
    }),
  );
  state.api.addMembers.mockResolvedValue(undefined);
  state.api.removeMember.mockResolvedValue(undefined);
});
afterEach(() => {
  unmount?.();
  document.body.innerHTML = '';
  state.codes.clear();
  vi.resetAllMocks();
});

describe('角色分配配置和执行闭环', () => {
  it('管理员配置用户可分配角色，失败保留选择，成功刷新', async () => {
    state.codes.add('roles:configure-distribution');
    await mount('config');
    click('button[aria-label="配置可分配角色：张三"]');
    await flush();
    const select = document.querySelector<HTMLSelectElement>(
      '#distributable-roles',
    );
    expect(select).not.toBeNull();
    if (!select) throw new Error('缺少角色选择器');
    select.value = 'upload';
    select.dispatchEvent(new Event('change'));
    await flush();
    state.api.saveConfig.mockRejectedValueOnce(new Error('配置冲突'));
    click('[data-confirm]');
    await flush();
    expect(state.error).toHaveBeenCalledWith('配置冲突');
    expect(document.querySelector('[data-modal]')).not.toBeNull();
    expect(select.value).toBe('upload');
    click('[data-confirm]');
    await flush();
    expect(state.api.saveConfig).toHaveBeenLastCalledWith(50, ['upload'], [], {
      mode: 'managed',
      organization_keys: [],
      revision: 0,
    });
    expect(document.querySelector('[data-modal]')).toBeNull();
    expect(state.api.configUsers).toHaveBeenCalledTimes(2);
  });

  it('配置组织全选与指定组织，并保存加载时的修订号', async () => {
    state.codes.add('roles:configure-distribution');
    state.api.configUsers.mockResolvedValue({
      items: [
        {
          id: 50,
          name: '张三',
          enabled: true,
          roles: [],
          scope: {
            mode: 'selected',
            organization_keys: ['company:a'],
            revision: 4,
          },
        },
      ],
      total: 1,
    });
    await mount('config');
    click('button[aria-label="配置可分配角色：张三"]');
    await flush();
    const checkbox = [...document.querySelectorAll('label')]
      .find((label) => label.textContent?.trim() === '全选')
      ?.querySelector('input');
    expect(checkbox).toBeDefined();
    checkbox?.click();
    await flush();
    click('[data-confirm]');
    await flush();
    expect(state.api.saveConfig).toHaveBeenLastCalledWith(50, [], [], {
      mode: 'all',
      organization_keys: [],
      revision: 4,
    });
    click('button[aria-label="配置可分配角色：张三"]');
    await flush();
    click('button[aria-label="选择公司乙"]');
    await flush();
    click('[data-confirm]');
    await flush();
    expect(state.api.saveConfig).toHaveBeenLastCalledWith(50, [], [], {
      mode: 'selected',
      organization_keys: ['company:a', 'company:b'],
      revision: 4,
    });
  });

  it('分配者跨页选人，添加失败保留选择，重试成功后刷新成员', async () => {
    state.codes.add('roles:distribute');
    await mount('index');
    const add = [
      ...document.querySelectorAll<HTMLButtonElement>('button'),
    ].find((b) => b.textContent?.trim() === '添加用户');
    expect(add).toBeDefined();
    add?.click();
    await flush();
    click('input[aria-label="选择李四"]');
    await flush();
    click('button[aria-label="候选下一页"]');
    await flush();
    click('input[aria-label="选择王五"]');
    await flush();
    state.api.addMembers.mockRejectedValueOnce(new Error('范围已变更'));
    click('[data-confirm]');
    await flush();
    expect(state.api.addMembers).toHaveBeenCalledWith('upload', ['51', '52']);
    expect(document.querySelector('[data-modal]')).not.toBeNull();
    expect(document.body.textContent).toContain('已选 2 人');
    click('[data-confirm]');
    await flush();
    expect(document.querySelector('[data-modal]')).toBeNull();
    expect(state.api.members).toHaveBeenCalledTimes(2);
  });

  it('只有菜单读取权限时不提供添加或移除入口', async () => {
    state.api.members.mockResolvedValue({
      items: [{ id: 51, name: '李四', enabled: true }],
      total: 1,
    });
    await mount('index');
    expect(document.body.textContent).not.toContain('添加用户');
    expect(document.querySelector('button[aria-label="移除角色"]')).toBeNull();
    expect(state.api.candidates).not.toHaveBeenCalled();
  });
});
