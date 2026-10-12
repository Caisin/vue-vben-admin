/* eslint-disable vue/one-component-per-file, vue/require-prop-types -- 测试组件桩。 */
import { createApp, h, nextTick } from 'vue';

import { afterEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  desktop: true,
  pick: vi.fn(),
  run: vi.fn(),
  update: vi.fn(),
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
    InputNumber: defineComponent({
      props: ['value', 'disabled'],
      emits: ['update:value'],
      setup:
        (p, { emit }) =>
        () =>
          h('input', {
            type: 'number',
            value: p.value,
            disabled: p.disabled,
            onInput: (event: Event) =>
              emit(
                'update:value',
                Number((event.target as HTMLInputElement).value),
              ),
          }),
    }),
    Table: defineComponent({
      props: ['dataSource', 'columns'],
      setup:
        (p, { slots }) =>
        () =>
          h(
            'div',
            p.dataSource.map((record: unknown) =>
              h(
                'div',
                p.columns.map((column: unknown) =>
                  slots.bodyCell?.({ column, record }),
                ),
              ),
            ),
          ),
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
  status: '待确认',
  revision: 0,
  concurrency: 3,
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
  state.update.mockImplementation(
    async (_id, revision, indices, concurrency) => ({
      ...job,
      revision: revision + 1,
      concurrency,
      files: indices.map((i: number) => job.files[i]),
    }),
  );
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
  button('选择文件并扫描').click();
  await settle();
  expect(state.pick).toHaveBeenCalledWith(-1, 2, 'poster', 0, true, false);
  expect(state.run).not.toHaveBeenCalled();
  button('确认清单并上传').click();
  await settle();
  expect(state.run).toHaveBeenCalledWith('j', 1);
  expect(uploaded).toHaveBeenCalledWith([{ file_id: 8, name: '海报.png' }]);
  expect(document.querySelector('input[type=file]')).toBeNull();
});
it('失败保留任务，重试同一任务后回填成功文件', async () => {
  state.run.mockRejectedValueOnce(new Error('网络中断')).mockResolvedValueOnce({
    ...job,
    files: [{ ...job.files[0], file_id: 9 }],
  });
  const uploaded = await mount();
  button('选择文件并扫描').click();
  await settle();
  button('确认清单并上传').click();
  await settle();
  expect(document.body.textContent).toContain('网络中断');
  expect(uploaded).not.toHaveBeenCalled();
  button('确认清单并上传').click();
  await settle();
  expect(state.run.mock.calls).toEqual([
    ['j', 1],
    ['j', 2],
  ]);
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
  button('选择目录并扫描').click();
  await settle();
  expect(state.pick).toHaveBeenCalledWith(-1, 2, 'poster', 0, true, true);
  expect(state.run).not.toHaveBeenCalled();
  button('确认清单并上传').click();
  await settle();
  expect(uploaded).toHaveBeenCalledWith([
    { file_id: 18, name: '第1集/截图.png' },
  ]);
});

it('扫描后移除文件和设置并发，原生只接收保留清单', async () => {
  const uploaded = await mount();
  const two = {
    ...job,
    files: [job.files[0], { ...job.files[0], name: '不要上传.png' }],
  };
  state.pick.mockResolvedValue(two);
  state.update.mockImplementation(
    async (_id, revision, indices, concurrency) => ({
      ...two,
      revision: revision + 1,
      concurrency,
      files: indices.map((i: number) => two.files[i]),
    }),
  );
  state.run.mockResolvedValue({
    ...job,
    files: [{ ...job.files[0], file_id: 8 }],
  });
  button('选择目录并扫描').click();
  await settle();
  expect(state.run).not.toHaveBeenCalled();
  const remove = [...document.querySelectorAll('button')].filter(
    (b) => b.textContent?.trim() === '移除',
  );
  remove[1]?.click();
  await settle();
  const input = document.querySelector<HTMLInputElement>('input[type=number]');
  if (!input) throw new Error('missing concurrency');
  input.value = '5';
  input.dispatchEvent(new Event('input'));
  await settle();
  button('确认清单并上传').click();
  await settle();
  expect(state.update).toHaveBeenCalledWith('j', 0, [0], 5);
  expect(uploaded).toHaveBeenCalledWith([{ file_id: 8, name: '海报.png' }]);
  expect(document.body.textContent).not.toContain('不要上传.png');
});
it('清单保存失败不启动传输，移除全部时禁止上传', async () => {
  await mount();
  button('选择目录并扫描').click();
  await settle();
  state.update.mockRejectedValue(new Error('清单已变化'));
  button('确认清单并上传').click();
  await settle();
  expect(document.body.textContent).toContain('清单已变化');
  expect(state.run).not.toHaveBeenCalled();
  button('移除').click();
  await settle();
  expect(button('确认清单并上传').disabled).toBe(true);
});
