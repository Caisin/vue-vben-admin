/* eslint-disable vue/one-component-per-file, vue/require-prop-types -- 同文件定义只用于交互测试的组件桩。 */
import { createApp, nextTick } from 'vue';

import { afterEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  page: vi.fn(),
  storageOptions: vi.fn(async () => [
    { code: 'system', storage_name: '系统存储', storage_type: 's3' },
  ]),
  upload: vi.fn(),
  create: vi.fn(),
  action: vi.fn(),
  remove: vi.fn(),
  edit: vi.fn(),
  events: vi.fn(),
  confirm: vi.fn(),
  success: vi.fn(),
  canManage: true,
  native: false,
  nativeUpload: vi.fn(),
}));
vi.mock('#/desktop', () => ({
  get desktop() {
    return state.native;
  },
}));
vi.mock('#/desktop/release-upload', () => ({
  uploadDesktopRelease: state.nativeUpload,
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
vi.mock('#/api/system/client-releases', () => ({ ClientReleaseApi: state }));
vi.mock('#/api/system/user', () => ({
  SystemUserApi: { options: vi.fn(async () => ({ items: [], total: 0 })) },
}));
vi.mock('#/api/request', () => ({
  plaintextRequestClient: { upload: state.upload },
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
    props: ['dataSource', 'columns'],
    setup:
      (p, { slots }) =>
      () =>
        h(
          'section',
          p.dataSource.map((record: Record<string, unknown>) =>
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
        ),
  });
  return {
    Alert: Wrap,
    Button,
    Drawer: Dialog,
    Form: Wrap,
    FormItem: Wrap,
    Input,
    Modal: Object.assign(Dialog, { confirm: state.confirm }),
    Select: Wrap,
    Space: Wrap,
    Progress: Wrap,
    Table,
    Tag: Wrap,
    message: { success: state.success },
  };
});
let unmount: (() => void) | undefined;
afterEach(() => {
  unmount?.();
  document.body.innerHTML = '';
  vi.clearAllMocks();
  state.canManage = true;
  state.native = false;
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
describe('版本管理闭环', () => {
  const row = {
    version: '0.1.1',
    notes: '说明',
    artifacts: [
      {
        target: 'darwin-aarch64',
        url: 'https://example.com/app.tar.gz',
        signature: 'signed',
      },
    ],
    status: 'draft',
    revision: 1,
    published_at: null,
  };
  it('桌面选择原生直传，不经过 multipart 上传并可保存草稿', async () => {
    state.native = true;
    state.page.mockResolvedValue({ items: [], total: 0 });
    state.create.mockResolvedValue({});
    state.nativeUpload.mockResolvedValue({
      version: '0.1.2',
      notes: '直传',
      artifacts: [
        {
          target: 'windows-x86_64',
          signature: 'signed',
          url: '',
          file_id: '42',
        },
      ],
    });
    await mount();
    click('新建版本');
    await flush();
    expect(document.querySelector('input[aria-label="上传发行包"]')).toBeNull();
    click('选择发行包并直传');
    await flush();
    expect(state.nativeUpload).toHaveBeenCalledWith(
      'system',
      expect.any(Object),
      expect.any(Function),
    );
    expect(state.upload).not.toHaveBeenCalled();
    click('保存');
    await flush();
    expect(state.create).toHaveBeenCalledWith(
      expect.objectContaining({
        version: '0.1.2',
        artifacts: [expect.objectContaining({ file_id: '42' })],
      }),
    );
  });
  it('只选单个发行包即可上传系统存储并保存草稿', async () => {
    state.page.mockResolvedValue({ items: [], total: 0 });
    state.create.mockResolvedValue({});
    state.upload.mockResolvedValue([
      { file: { file_id: 42 }, url: '/storage/file/content/42' },
    ]);
    await mount();
    click('新建版本');
    await flush();
    const metadata = new TextEncoder().encode(
      JSON.stringify({
        version: '0.1.1',
        notes: '说明',
        name: 'app.app.tar.gz',
        target: 'darwin-aarch64',
        signature: 'signed',
        size: 3,
      }),
    );
    const header = new Uint8Array(12);
    header.set(new TextEncoder().encode('KXUPDATE'));
    new DataView(header.buffer).setUint32(8, metadata.length, true);
    const file = new File(
      [header, metadata, new Uint8Array([1, 2, 3])],
      'release.kx-update',
    );
    const input = document.querySelector(
      'input[aria-label="上传发行包"]',
    ) as HTMLInputElement;
    Object.defineProperty(input, 'files', {
      value: [file],
      configurable: true,
    });
    input.dispatchEvent(new Event('change'));
    await flush();
    expect(state.upload).toHaveBeenCalledWith(
      '/storage/file/upload/system',
      { file: expect.any(File) },
      { timeout: 30 * 60 * 1000 },
    );
    expect(document.body.textContent).toContain('已上传至系统存储');
    expect(document.querySelector('input[accept=".sig"]')).toBeNull();
    expect(
      document.querySelector('input[aria-label="导入发行清单"]'),
    ).toBeNull();
    click('保存');
    await flush();
    expect(state.create).toHaveBeenCalledWith({
      version: '0.1.1',
      notes: '说明',
      artifacts: [
        { target: 'darwin-aarch64', signature: 'signed', url: '', file_id: 42 },
      ],
    });
  });
  it('打开草稿、保存并刷新，然后发布与撤回', async () => {
    const current = { ...row };
    state.page.mockImplementation(async () => ({
      items: [{ ...current }],
      total: 1,
    }));
    state.edit.mockImplementation(async () => {
      current.revision++;
    });
    state.action.mockImplementation(async (_row, action) => {
      current.status = action === 'publish' ? 'published' : 'withdrawn';
      current.revision++;
    });
    await mount();
    click('0.1.1');
    await flush();
    expect(document.querySelector('aside')?.textContent).toContain(
      'https://example.com/app.tar.gz',
    );
    click('保存');
    await flush();
    expect(state.edit).toHaveBeenCalledWith(
      expect.objectContaining({ version: '0.1.1', revision: 1 }),
      expect.objectContaining({ notes: '说明' }),
    );
    expect(document.querySelector('aside')).toBeNull();
    click('发布');
    await state.confirm.mock.calls.at(-1)?.[0].onOk();
    await flush();
    expect(document.body.textContent).toContain('已发布');
    click('撤回');
    await state.confirm.mock.calls.at(-1)?.[0].onOk();
    await flush();
    expect(document.body.textContent).toContain('已撤回');
    expect(state.page).toHaveBeenCalledTimes(4);
  });
  it('保存失败保留弹窗和输入', async () => {
    state.page.mockResolvedValue({ items: [{ ...row }], total: 1 });
    state.edit.mockRejectedValue(new Error('版本已变更'));
    await mount();
    click('0.1.1');
    await flush();
    click('保存');
    await flush();
    expect(document.querySelector('aside')).not.toBeNull();
    expect(state.page).toHaveBeenCalledTimes(1);
    expect(state.success).not.toHaveBeenCalled();
  });
  it('只读用户不能新建、发布、撤回或写入', async () => {
    state.canManage = false;
    state.page.mockResolvedValue({ items: [{ ...row }], total: 1 });
    await mount();
    const text = document.body.textContent;
    expect(text).not.toContain('新建版本');
    expect(text).not.toContain('删除草稿');
    click('0.1.1');
    await flush();
    click('保存');
    await flush();
    expect(state.edit).not.toHaveBeenCalled();
  });
});
