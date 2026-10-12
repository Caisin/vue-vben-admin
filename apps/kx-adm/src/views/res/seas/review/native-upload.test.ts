/* eslint-disable vue/one-component-per-file, vue/require-prop-types -- 测试组件桩。 */
import { createApp, h, nextTick } from 'vue';

import { afterEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  desktop: true,
  pick: vi.fn(),
  run: vi.fn(),
  jobs: vi.fn(),
  pause: vi.fn(),
  listen: vi.fn(),
}));
vi.mock('#/desktop', () => ({
  get desktop() {
    return state.desktop;
  },
}));
vi.mock('#/desktop/delivery', () => ({ nativeDelivery: state }));
vi.mock('#/request-errors', () => ({
  requestErrorMessage: (e: Error) => e.message,
}));
vi.mock('antdv-next', async () => {
  const { defineComponent, h } = await import('vue');
  return {
    Button: defineComponent({
      props: ['disabled'],
      setup:
        (p, { slots }) =>
        () =>
          h('button', { disabled: p.disabled }, slots.default?.()),
    }),
    Alert: defineComponent({
      props: ['message'],
      setup: (p) => () => h('p', p.message),
    }),
    Progress: defineComponent({ setup: () => () => h('span') }),
    Select: defineComponent({ setup: () => () => h('span') }),
  };
});
let cleanup: () => void;
async function settle() {
  for (let i = 0; i < 15; i++) {
    await Promise.resolve();
    await nextTick();
  }
}
function button(name: string) {
  const b = [...document.querySelectorAll('button')].find(
    (b) => b.textContent?.trim() === name,
  );
  if (!b) throw new Error(`missing ${name}`);
  return b;
}
const job = {
  id: 'j',
  scope: -1,
  version: 2,
  kind: 'poster',
  seq: 0,
  status: '待上传',
  files: [
    {
      name: '海报.png',
      size: 10,
      bytes: 0,
      status: '待上传',
      error: '',
      file_id: null,
    },
  ],
};
async function mount() {
  state.jobs.mockResolvedValue([]);
  state.pick.mockResolvedValue(job);
  state.listen.mockResolvedValue(() => {});
  const uploaded = vi.fn();
  const { default: Component } = await import('./native-upload.vue');
  const root = document.createElement('div');
  document.body.append(root);
  const app = createApp({
    render: () =>
      h(Component, {
        scope: -1,
        version: 2,
        kind: 'poster',
        seq: 0,
        onUploaded: uploaded,
      }),
  });
  app.mount(root);
  cleanup = () => app.unmount();
  await settle();
  return uploaded;
}
afterEach(() => {
  cleanup?.();
  document.body.innerHTML = '';
  vi.clearAllMocks();
  state.desktop = true;
});
it('原生选择和传输完成后回填登记文件，不使用浏览器文件输入', async () => {
  state.run.mockResolvedValue({
    ...job,
    status: '上传完成',
    files: [{ ...job.files[0], file_id: 8 }],
  });
  const uploaded = await mount();
  button('选择文件并上传').click();
  await settle();
  expect(state.pick).toHaveBeenCalledWith(-1, 2, 'poster', 0, true, false);
  expect(state.run).toHaveBeenCalledWith('j');
  expect(uploaded).toHaveBeenCalledWith([{ file_id: 8, name: '海报.png' }]);
  expect(document.querySelector('input[type=file]')).toBeNull();
});
it('失败保留任务，重试同一任务后回填成功文件', async () => {
  state.run.mockRejectedValueOnce(new Error('网络中断')).mockResolvedValueOnce({
    ...job,
    files: [{ ...job.files[0], file_id: 9 }],
  });
  const uploaded = await mount();
  button('选择文件并上传').click();
  await settle();
  expect(document.body.textContent).toContain('网络中断');
  expect(uploaded).not.toHaveBeenCalled();
  button('继续 / 重试').click();
  await settle();
  expect(state.run.mock.calls).toEqual([['j'], ['j']]);
  expect(uploaded).toHaveBeenCalledWith([{ file_id: 9, name: '海报.png' }]);
});
it('网页不给出文件传输入口，保持客户端说明', async () => {
  state.desktop = false;
  await mount();
  expect(document.querySelector('button')).toBeNull();
  expect(document.body.textContent).toContain('Tauri');
  expect(state.jobs).not.toHaveBeenCalled();
});

it('目录上传调用原生目录选择并保留相对文件名', async () => {
  state.run.mockResolvedValue({
    ...job,
    status: '上传完成',
    files: [{ ...job.files[0], relative_path: '第1集/截图.png', file_id: 18 }],
  });
  const uploaded = await mount();
  button('选择目录上传').click();
  await settle();
  expect(state.pick).toHaveBeenCalledWith(-1, 2, 'poster', 0, true, true);
  expect(uploaded).toHaveBeenCalledWith([
    { file_id: 18, name: '第1集/截图.png' },
  ]);
});
