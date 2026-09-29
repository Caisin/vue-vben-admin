/* eslint-disable vue/one-component-per-file, vue/require-prop-types -- 测试组件桩。 */
import { createApp, h, nextTick, ref } from 'vue';

import { afterEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  codes: new Set<string>(),
  list: vi.fn(),
  detail: vi.fn(),
  manifest: vi.fn(),
}));
vi.mock('@vben/access', () => ({
  useAccess: () => ({
    hasAccessByCodes: (codes: string[]) =>
      codes.some((c) => state.codes.has(c)),
  }),
}));
vi.mock('#/api/res/versions', () => ({ ResourceVersionApi: state }));
vi.mock('#/api/res/version-files', () => ({ versionVideoAdapter: vi.fn() }));
vi.mock('#/components/file-picker', () => ({
  FileUrlInput: { template: '<i />' },
}));
vi.mock('#/components/file-picker/internal/upload-error', () => ({
  uploadErrorMessage: String,
}));
vi.mock('#/request-errors', () => ({ requestErrorMessage: String }));
vi.mock('#/desktop', () => ({ desktop: true, desktopDownloads: {} }));
vi.mock('#/desktop/directory-upload.vue', () => ({
  default: { template: '<i>目录上传</i>' },
}));
vi.mock('#/desktop/download-history.vue', () => ({
  default: { template: '<i />' },
}));
vi.mock('./modules/download-permissions.vue', () => ({
  default: { template: '<i />' },
}));
vi.mock('./modules/novel-import.vue', () => ({
  default: { template: '<i />' },
}));
vi.mock('./modules/novel-reader.vue', () => ({
  default: { template: '<i />' },
}));
vi.mock('./modules/version-preview.vue', () => ({
  default: { template: '<i>视频预览</i>' },
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
    setup:
      (_p, { slots }) =>
      () =>
        h('button', slots.default?.()),
  });
  const Input = Object.assign(Wrap, { TextArea: Wrap });
  return {
    Alert: Wrap,
    Button,
    Empty: Wrap,
    Form: Wrap,
    FormItem: Wrap,
    Input,
    InputNumber: Wrap,
    Modal,
    Popconfirm: Wrap,
    Spin: Wrap,
    Table: Wrap,
  };
});
let unmount: (() => void) | undefined;
afterEach(() => {
  unmount?.();
  document.body.innerHTML = '';
  vi.clearAllMocks();
  state.codes.clear();
});
async function mount(code: string) {
  state.codes.add(code);
  const version = {
    id: 3,
    res_id: 2,
    name: '原版',
    lang: 'zh',
    remark: '',
    revision: 1,
    created_at: 1,
    updated_at: 1,
  };
  const detail = {
    version,
    items: [
      {
        id: 4,
        seq_no: 1,
        title: '第一集',
        link: 'storage:file:5',
        content: '',
        remark: '',
        duration: 1,
      },
    ],
  };
  state.list.mockResolvedValue([version]);
  state.manifest.mockResolvedValue(detail);
  state.detail.mockResolvedValue(detail);
  const { default: Versions } = await import('./modules/resource-versions.vue');
  const open = ref(false);
  const host = document.createElement('div');
  document.body.append(host);
  const app = createApp({
    setup: () => () =>
      h(Versions, {
        resource: { id: 2, res_name: '测试剧', res_type: 'drama' },
        open: open.value,
      }),
  });
  app.mount(host);
  unmount = () => app.unmount();
  open.value = true;
  await nextTick();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await nextTick();
}
function buttons() {
  return [...document.querySelectorAll('button')].map((b) =>
    b.textContent?.trim(),
  );
}
describe('版本弹层权限闭环', () => {
  it('下载角色读取目录并显示下载，不调用完整内容或暴露上传授权按钮', async () => {
    await mount('res:content:download');
    expect(state.manifest).toHaveBeenCalledWith(2, 3);
    expect(state.detail).not.toHaveBeenCalled();
    expect(buttons()).toContain('下载当前版本');
    for (const title of [
      '新增版本',
      '下载权限',
      '修改版本信息',
      '删除版本',
      '手动添加分集',
    ])
      expect(buttons()).not.toContain(title);
    expect(document.body.textContent).not.toContain('目录上传');
    expect(document.body.textContent).not.toContain('视频预览');
  });
  it('上传角色读取内容并提供创建和上传入口，不提供授权及删除', async () => {
    await mount('res:content:upload');
    expect(state.detail).toHaveBeenCalledWith(2, 3);
    expect(state.manifest).not.toHaveBeenCalled();
    expect(buttons()).toContain('新增版本');
    expect(buttons()).toContain('修改版本信息');
    expect(document.body.textContent).toContain('目录上传');
    for (const title of ['下载权限', '删除版本', '下载当前版本'])
      expect(buttons()).not.toContain(title);
  });
  it('授权角色读取目录并提供下载权限入口', async () => {
    await mount('res:download:authorize');
    expect(state.manifest).toHaveBeenCalledWith(2, 3);
    expect(buttons()).toContain('下载权限');
    expect(buttons()).not.toContain('新增版本');
  });
});
