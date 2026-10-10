/* eslint-disable vue/one-component-per-file, vue/require-prop-types -- 测试组件桩。 */
import { createApp, h, nextTick } from 'vue';

import { afterEach, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({
  members: vi.fn(),
  member: vi.fn(),
  users: vi.fn(),
  versions: vi.fn(),
}));
vi.mock('#/api/res/review', () => ({
  reviewApi: api,
  roleLabels: { editor: '剪辑', writer: '编剧', director: '导演' },
}));
vi.mock('#/request-errors', () => ({
  requestErrorMessage: (error: Error) => error.message,
}));
vi.mock('./modules/review-workbench.vue', () => ({
  default: {
    props: ['res', 'name'],
    template: '<div data-testid="workbench">审核 {{res}} {{name}}</div>',
  },
}));
vi.mock('antdv-next', async () => {
  const { defineComponent, h } = await import('vue');
  const Wrap = defineComponent({
    setup:
      (_, { slots }) =>
      () =>
        h('div', slots.default?.()),
  });
  const Button = defineComponent({
    props: ['disabled'],
    setup:
      (p, { slots }) =>
      () =>
        h('button', { disabled: p.disabled }, slots.default?.()),
  });
  const Modal = defineComponent({
    props: ['open', 'title'],
    emits: ['update:open'],
    setup:
      (p, { slots, emit }) =>
      () =>
        p.open
          ? h('section', { role: 'dialog' }, [
              h('h2', p.title),
              slots.default?.(),
              h(
                'button',
                { onClick: () => emit('update:open', false) },
                '关闭',
              ),
            ])
          : null,
  });
  const Select = defineComponent({
    props: ['value', 'options', 'placeholder'],
    emits: ['update:value'],
    setup:
      (p, { emit }) =>
      () =>
        h(
          'select',
          {
            'aria-label': p.placeholder || '角色',
            value: p.value,
            onChange: (event: Event) =>
              emit('update:value', (event.target as HTMLSelectElement).value),
          },
          [
            h('option', { value: '' }, '请选择'),
            ...p.options.map((o: { label: string; value: string }) =>
              h('option', { value: o.value }, o.label),
            ),
          ],
        ),
  });
  const Table = defineComponent({
    props: ['dataSource'],
    setup:
      (p, { slots }) =>
      () =>
        h(
          'div',
          p.dataSource.map((record: unknown) =>
            slots.bodyCell?.({ column: { key: 'name' }, record }),
          ),
        ),
  });
  const Alert = defineComponent({
    props: ['message'],
    setup: (p) => () => h('p', p.message),
  });
  return { Button, Modal, Select, Table, Alert, Popconfirm: Wrap };
});
let cleanup: () => void;
afterEach(() => {
  cleanup?.();
  document.body.innerHTML = '';
  vi.clearAllMocks();
});
async function settle() {
  for (let i = 0; i < 15; i++) {
    await Promise.resolve();
    await nextTick();
  }
}
function button(text: string) {
  const result = [...document.querySelectorAll('button')].find(
    (b) => b.textContent?.trim() === text,
  );
  if (!result) throw new Error(`缺少按钮 ${text}`);
  return result;
}
async function mount(canManage = true, type = 'drama') {
  api.members.mockResolvedValue({ members: [], users: {}, can_manage: true });
  api.users.mockResolvedValue({ items: [{ id: 7, name: '小林' }], total: 1 });
  api.member.mockResolvedValue(undefined);
  const { default: Actions } =
    await import('./modules/review-entry-actions.vue');
  const host = document.createElement('div');
  document.body.append(host);
  const app = createApp({
    render: () =>
      h(Actions, {
        resource: { id: 42, res_name: '测试作品', res_type: type },
        canManage,
      }),
  });
  app.mount(host);
  cleanup = () => app.unmount();
  await settle();
}
it('列表直接管理协作者，无版本也可保存并立即看到结果', async () => {
  await mount();
  expect(api.members).not.toHaveBeenCalled();
  button('协作者').click();
  await settle();
  expect(api.members).toHaveBeenCalledWith(42);
  expect(api.versions).not.toHaveBeenCalled();
  expect(document.body.textContent).toContain('测试作品 · 作品协作者');
  const user = document.querySelector('select[aria-label="搜索并选择协作者"]');
  if (!(user instanceof HTMLSelectElement)) throw new Error('缺少用户选择');
  user.value = '7';
  user.dispatchEvent(new Event('change'));
  await settle();
  api.members.mockResolvedValue({
    members: [{ uid: 7, res_id: 42, role: 'editor' }],
    users: { 7: '小林' },
    can_manage: true,
  });
  button('添加 / 更新').click();
  await settle();
  expect(api.member).toHaveBeenCalledWith(42, '7', 'editor');
  expect(api.members).toHaveBeenCalledTimes(2);
  expect(document.body.textContent).toContain('小林');
  button('关闭').click();
  await settle();
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(button('作品审核')).toBeTruthy();
});
it('审核按钮在当前列表打开正确作品，关闭后保留列表入口', async () => {
  await mount();
  button('作品审核').click();
  await settle();
  expect(document.querySelector('[data-testid="workbench"]')?.textContent).toBe(
    '审核 42 测试作品',
  );
  button('关闭').click();
  await settle();
  expect(document.querySelector('[data-testid="workbench"]')).toBeNull();
  expect(button('协作者')).toBeTruthy();
});
it('普通用户没有成员管理按钮，非短剧不显示审核入口', async () => {
  await mount(false);
  expect(
    [...document.querySelectorAll('button')].some(
      (b) => b.textContent === '协作者',
    ),
  ).toBe(false);
  expect(button('作品审核')).toBeTruthy();
  cleanup();
  document.body.innerHTML = '';
  await mount(true, 'novel');
  expect(document.querySelector('button')).toBeNull();
});
it('读取失败显示错误且允许重试，不伪装为空成员', async () => {
  await mount();
  api.members.mockRejectedValueOnce(new Error('读取失败'));
  button('协作者').click();
  await settle();
  expect(document.body.textContent).toContain('读取失败');
  button('重新读取').click();
  await settle();
  expect(api.members).toHaveBeenCalledTimes(2);
});
