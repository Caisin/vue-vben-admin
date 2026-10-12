/* eslint-disable vue/one-component-per-file -- 真实弹窗配合表格占位，验证原生上传与版本绑定。 */
import { createApp, nextTick } from 'vue';

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({
  detail: vi.fn(),
  submitImport: vi.fn(),
  latestImport: vi.fn(),
}));
const native = vi.hoisted(() => ({
  pick: vi.fn(),
  run: vi.fn(),
  listen: vi.fn(),
  jobs: vi.fn(),
  pause: vi.fn(),
}));
vi.mock('#/api/res/review', () => ({ reviewApi: api }));
vi.mock('#/desktop', () => ({ desktop: true }));
vi.mock('#/desktop/delivery', () => ({ nativeDelivery: native }));
vi.mock('#/request-errors', () => ({
  requestErrorMessage: (error: Error) => error.message,
}));
vi.mock('antdv-next', async () => {
  const [
    { default: Button },
    { default: Modal },
    { default: Alert },
    { defineComponent, h },
  ] = await Promise.all([
    import('antdv-next/dist/button/index'),
    import('antdv-next/dist/modal/index'),
    import('antdv-next/dist/alert/index'),
    import('vue'),
  ]);
  const Wrap = defineComponent({
    setup:
      (_p, { slots }) =>
      () =>
        h('div', slots.default?.()),
  });
  return {
    Button,
    Modal,
    Alert,
    Input: Wrap,
    InputNumber: Wrap,
    Table: Wrap,
    Tag: Wrap,
    Progress: Wrap,
    Select: Wrap,
  };
});
let cleanup: (() => void) | undefined;
beforeEach(() => {
  vi.resetAllMocks();
  api.detail.mockResolvedValue({
    can_edit: true,
    detail: {
      version: {
        id: 3,
        name: '无音乐版',
        review_state: 'draft',
        planned_episodes: 3,
      },
      items: [{ seq_no: 1 }],
    },
  });
  api.latestImport.mockResolvedValue(null);
  api.submitImport.mockResolvedValue({ results: [] });
  native.jobs.mockResolvedValue([]);
  native.listen.mockResolvedValue(() => {});
  native.pick.mockResolvedValue(null);
});
afterEach(() => {
  cleanup?.();
  document.body.innerHTML = '';
});
async function mount() {
  const { default: Batch } = await import('./film-batch.vue');
  const root = document.createElement('div');
  document.body.append(root);
  const app = createApp(Batch, { res: -9 });
  app.directive('access', {});
  const component = app.mount(root) as InstanceType<typeof Batch>;
  cleanup = () => app.unmount();
  return component;
}
async function settle() {
  for (let i = 0; i < 15; i++) {
    await Promise.resolve();
    await nextTick();
  }
}
it('点指定版本入口后直接选择目录，上传和登记都绑定该版本', async () => {
  const job = {
    id: 'directory-job',
    scope: -9,
    version: 3,
    kind: 'film',
    seq: 2,
    status: '待上传',
    files: [
      {
        name: '02.mp4',
        relative_path: '第2集/02.mp4',
        file_id: null,
        size: 10,
        bytes: 0,
        status: '待上传',
        error: '',
      },
    ],
  };
  native.pick.mockResolvedValue(job);
  native.run.mockResolvedValue({
    ...job,
    status: '上传完成',
    files: [{ ...job.files[0], file_id: 21 }],
  });
  const component = await mount();
  await component.openDirectory(3);
  await vi.waitFor(() =>
    expect(native.pick).toHaveBeenCalledWith(-9, 3, 'film', 2, true, true),
  );
  await settle();
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
    '无音乐版 · 目录上传',
  );
  const submit = [...document.querySelectorAll('button')].find(
    (b) => b.textContent?.trim() === '提交分集登记',
  );
  expect(submit?.disabled).toBe(false);
  submit?.click();
  await settle();
  expect(api.submitImport).toHaveBeenCalledWith(-9, 3, [
    { seq_no: 2, title: '第2集', file_id: 21, file_name: '第2集/02.mp4' },
  ]);
});
it('已定稿或失去编辑权限时不打开原生选择器', async () => {
  api.detail.mockResolvedValue({
    can_edit: true,
    detail: {
      version: {
        id: 3,
        name: '无音乐版',
        review_state: 'final',
        planned_episodes: 3,
      },
      items: [],
    },
  });
  const component = await mount();
  await component.openDirectory(3);
  await settle();
  expect(native.pick).not.toHaveBeenCalled();
  expect(document.body.textContent).toContain('定稿版本请先复制');
});
it('取消目录选择后不上传、不登记，可再次从入口选择', async () => {
  const component = await mount();
  await component.openDirectory(3);
  await vi.waitFor(() => expect(native.pick).toHaveBeenCalledTimes(1));
  await settle();
  expect(native.run).not.toHaveBeenCalled();
  expect(api.submitImport).not.toHaveBeenCalled();
  await component.openDirectory(3);
  await vi.waitFor(() => expect(native.pick).toHaveBeenCalledTimes(2));
});
