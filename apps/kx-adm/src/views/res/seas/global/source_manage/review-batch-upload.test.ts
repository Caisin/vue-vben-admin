/* eslint-disable vue/one-component-per-file, vue/require-prop-types -- 测试组件桩。 */
import { createApp, h, nextTick } from 'vue';

import { afterEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  upload: vi.fn(),
  submitImport: vi.fn(),
  latestImport: vi.fn(),
}));
vi.mock('#/api/res/review', () => ({ reviewApi: state }));
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
  const Modal = defineComponent({
    props: ['open'],
    setup:
      (p, { slots }) =>
      () =>
        p.open ? h('section', slots.default?.()) : null,
  });
  const Button = defineComponent({
    props: ['disabled'],
    setup:
      (p, { slots }) =>
      () =>
        h('button', { disabled: p.disabled }, slots.default?.()),
  });
  const Alert = defineComponent({
    props: ['message'],
    setup: (p) => () => h('p', p.message),
  });
  return {
    Modal,
    Button,
    Alert,
    Input: Wrap,
    InputNumber: Wrap,
    Progress: Wrap,
    Table: Wrap,
    Tag: Wrap,
  };
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
  const element = [...document.querySelectorAll('button')].find((b) =>
    b.textContent?.includes(text),
  );
  if (!element) throw new Error(`缺少按钮 ${text}`);
  return element;
}
async function mount() {
  state.latestImport.mockResolvedValue(null);
  const { default: Component } =
    await import('./modules/review-batch-upload.vue');
  const host = document.createElement('div');
  document.body.append(host);
  const app = createApp({
    render: () =>
      h(Component, {
        res: 1,
        version: 10,
        items: [],
        planned: 12,
        disabled: false,
      }),
  });
  app.mount(host);
  cleanup = () => app.unmount();
  await settle();
  button('整版 / 补集上传').click();
  await settle();
}
async function select(names: string[]) {
  const input = document.querySelector('input[type=file]');
  if (!(input instanceof HTMLInputElement)) throw new Error('缺少文件选择');
  Object.defineProperty(input, 'files', {
    value: names.map(
      (name) => new File(['video'], name, { type: 'video/mp4' }),
    ),
    configurable: true,
  });
  input.dispatchEvent(new Event('change'));
  await settle();
}
it('重复集数必须先修正，不能开始上传', async () => {
  await mount();
  await select(['01.mp4', '第1集.mp4']);
  expect(document.body.textContent).toContain('第 1 集重复');
  expect(button('确认映射').disabled).toBe(true);
  expect(state.upload).not.toHaveBeenCalled();
});
it('中途上传失败保留成功文件，重试只传失败文件并提交持久任务', async () => {
  await mount();
  await select(['01.mp4', '02.mp4']);
  state.upload
    .mockResolvedValueOnce([{ file: { file_id: 101 } }])
    .mockRejectedValueOnce(new Error('网络中断'))
    .mockResolvedValueOnce([{ file: { file_id: 102 } }]);
  state.submitImport.mockResolvedValue({
    id: 5,
    entries: [],
    results: [],
    dispatch_error: '',
  });
  button('确认映射').click();
  await settle();
  expect(document.body.textContent).toContain('网络中断');
  expect(state.submitImport).not.toHaveBeenCalled();
  button('继续上传并登记').click();
  await settle();
  expect(state.upload).toHaveBeenCalledTimes(3);
  expect(state.submitImport).toHaveBeenCalledWith(1, 10, [
    { seq_no: 1, title: '第 1 集', file_id: 101, file_name: '01.mp4' },
    { seq_no: 2, title: '第 2 集', file_id: 102, file_name: '02.mp4' },
  ]);
});
