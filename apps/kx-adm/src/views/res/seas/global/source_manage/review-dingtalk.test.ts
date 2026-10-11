/* eslint-disable vue/one-component-per-file, vue/require-prop-types -- 钉钉配置组件桩。 */
import { createApp, h, nextTick } from 'vue';

import { afterEach, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({
  get: vi.fn(),
  options: vi.fn(),
  save: vi.fn(),
  retry: vi.fn(),
}));
vi.mock('#/api/res/review-group', () => ({ reviewGroupApi: api }));
vi.mock('#/request-errors', () => ({
  requestErrorMessage: (e: Error) => e.message,
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
    props: ['open'],
    setup:
      (p, { slots }) =>
      () =>
        p.open ? h('section', { role: 'dialog' }, slots.default?.()) : null,
  });
  const Alert = defineComponent({
    props: ['message'],
    setup: (p) => () => h('p', p.message),
  });
  const Input = defineComponent({
    props: ['value', 'placeholder', 'disabled'],
    emits: ['update:value'],
    setup:
      (p, { emit }) =>
      () =>
        h('input', {
          value: p.value,
          placeholder: p.placeholder,
          disabled: p.disabled,
          onInput: (e: Event) =>
            emit('update:value', (e.target as HTMLInputElement).value),
        }),
  });
  const Select = defineComponent({
    props: ['value', 'options', 'disabled', 'placeholder'],
    emits: ['update:value'],
    setup:
      (p, { emit }) =>
      () =>
        h(
          'select',
          {
            value: p.value,
            disabled: p.disabled,
            'aria-label': p.placeholder,
            onChange: (e: Event) =>
              emit('update:value', (e.target as HTMLSelectElement).value),
          },
          p.options.map((o: { value: string; label: string }) =>
            h('option', { value: o.value }, o.label),
          ),
        ),
  });
  const Switch = defineComponent({
    props: ['checked'],
    emits: ['update:checked'],
    setup:
      (p, { emit }) =>
      () =>
        h('input', {
          type: 'checkbox',
          checked: p.checked,
          onChange: (e: Event) =>
            emit('update:checked', (e.target as HTMLInputElement).checked),
        }),
  });
  return {
    Button,
    Modal,
    Alert,
    Input,
    Select,
    Switch,
    Form: Wrap,
    FormItem: Wrap,
    Tag: Wrap,
    Popconfirm: Wrap,
    Table: Wrap,
  };
});
let cleanup: (() => void) | undefined;
afterEach(() => {
  cleanup?.();
  document.body.innerHTML = '';
  vi.clearAllMocks();
});
async function settle() {
  for (let i = 0; i < 12; i++) {
    await Promise.resolve();
    await nextTick();
  }
}
function button(text: string) {
  const v = [...document.querySelectorAll('button')].find(
    (b) => b.textContent?.trim() === text,
  );
  if (!v) throw new Error(`缺少按钮 ${text}`);
  return v;
}
async function mount(manage = true, configured = false) {
  api.get.mockResolvedValue({
    configured,
    revision: configured ? 4 : 0,
    app_key: configured ? 'app' : '',
    template_id: configured ? 'template' : '',
    robot_code: configured ? 'robot' : '',
    owner_uid: 7,
    title: '测试剧·审片',
    enabled: configured,
    group_created: configured,
    can_reconfigure: !configured,
    state: configured ? 'ready' : 'unconfigured',
    error: '',
    can_manage: manage,
    deliveries: [],
    delivery_total: 0,
    pending_count: 0,
    uncertain_count: 0,
  });
  api.options.mockResolvedValue({
    apps: [{ value: 'app', label: '内部应用' }],
    owners: [{ value: '7', label: '负责人' }],
  });
  api.save.mockResolvedValue(undefined);
  api.retry.mockResolvedValue(undefined);
  const { default: Component } = await import('./modules/review-dingtalk.vue');
  const host = document.createElement('div');
  document.body.append(host);
  const app = createApp({
    render: () => h(Component, { res: 42, name: '测试剧' }),
  });
  app.mount(host);
  cleanup = () => app.unmount();
  button('钉钉协作').click();
  await settle();
}
function fill(placeholder: string, text: string) {
  const input = [...document.querySelectorAll('input')].find(
    (i) => i.placeholder === placeholder,
  );
  if (!input) throw new Error('缺少字段');
  input.value = text;
  input.dispatchEvent(new Event('input'));
}
it('按剧保存应用与模板，等待真实后台回执而非立即显示建群成功', async () => {
  await mount();
  expect(api.get).toHaveBeenCalledWith(42, 1);
  fill('从钉钉开发者后台 · 场景群 · 群模板复制', 'template');
  fill('群模板中已安装的企业机器人 robotCode', 'robot');
  await settle();
  button('启用并自动建群').click();
  await settle();
  expect(api.save).toHaveBeenCalledWith(
    42,
    expect.objectContaining({
      app_key: 'app',
      template_id: 'template',
      owner_uid: '7',
      enabled: true,
    }),
  );
  expect(document.body.textContent).toContain('后台通常在下一分钟');
});
it('已建群冻结建群身份，只允许修改机器人或暂停，普通协作者不可配置', async () => {
  await mount(true, true);
  const select = document.querySelector('select');
  expect(select?.disabled).toBe(true);
  expect(document.body.textContent).toContain('本剧协作群已创建');
  cleanup?.();
  document.body.innerHTML = '';
  await mount(false, true);
  expect(document.querySelector('select')).toBeNull();
  expect(api.options).toHaveBeenCalledTimes(1);
});
it('重试带当前修订号，保存失败保留输入和错误', async () => {
  await mount(true, true);
  button('重试建群 / 成员同步').click();
  await settle();
  expect(api.retry).toHaveBeenCalledWith(42, 4, undefined);
  api.save.mockRejectedValue(new Error('配置已变化'));
  button('保存配置').click();
  await settle();
  expect(document.body.textContent).toContain('配置已变化');
});
