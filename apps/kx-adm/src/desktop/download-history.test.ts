/* eslint-disable vue/one-component-per-file, vue/require-prop-types -- 组件测试的 UI 桩。 */
import { createApp, h, nextTick } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import DownloadHistory from './download-history.vue';

const native = vi.hoisted(() => ({
  list: vi.fn(),
  setConcurrency: vi.fn(),
  listen: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  pickDirectory: vi.fn(),
}));
vi.mock('./index', () => ({ desktop: true, desktopDownloads: native }));
vi.mock('#/api/res/downloads', () => ({
  ResDownloadApi: { mineTasks: vi.fn(async () => ({ items: [] })) },
}));
vi.mock('#/components/file-picker/internal/upload-error', () => ({
  uploadErrorMessage: (error: Error) => error.message,
}));
vi.mock('antdv-next', async () => {
  const { defineComponent, h } = await import('vue');
  const Wrap = defineComponent({
    setup:
      (_props, { slots }) =>
      () =>
        h('div', slots.default?.()),
  });
  return {
    Form: Wrap,
    FormItem: Wrap,
    Progress: Wrap,
    Tag: Wrap,
    Alert: defineComponent({
      props: ['message'],
      setup: (props) => () => h('div', props.message),
    }),
    Button: defineComponent({
      setup:
        (_props, { slots }) =>
        () =>
          h('button', slots.default?.()),
    }),
    InputNumber: defineComponent({
      props: ['value', 'disabled'],
      emits: ['change'],
      setup:
        (props, { emit }) =>
        () =>
          h('input', {
            type: 'number',
            value: props.value,
            disabled: props.disabled,
            onChange: (event: Event) =>
              emit('change', Number((event.target as HTMLInputElement).value)),
          }),
    }),
    Input: defineComponent({
      props: ['value'],
      setup: (props) => () => h('input', { value: props.value }),
    }),
    Switch: defineComponent({
      props: ['checked'],
      emits: ['update:checked'],
      setup:
        (props, { emit }) =>
        () =>
          h('button', {
            onClick: () => emit('update:checked', !props.checked),
          }),
    }),
    Modal: defineComponent({
      props: ['open', 'okText', 'footer'],
      emits: ['ok'],
      setup:
        (props, { emit, slots }) =>
        () =>
          props.open
            ? h('section', [
                slots.default?.(),
                props.footer === null
                  ? null
                  : h('button', { onClick: () => emit('ok') }, props.okText),
              ])
            : null,
    }),
    Table: defineComponent({
      props: ['dataSource', 'columns'],
      setup:
        (props, { slots }) =>
        () =>
          h(
            'div',
            props.dataSource.flatMap((record: unknown) =>
              props.columns.map((column: unknown) =>
                slots.bodyCell?.({ column, record }),
              ),
            ),
          ),
    }),
  };
});
let unmount: (() => void) | undefined;
const original = String.raw`E:\AIGC1677_剧名`;
const destination = String.raw`F:\重新下载`;
beforeEach(() => {
  vi.clearAllMocks();
  native.list.mockResolvedValue([
    {
      id: 'job-1',
      resId: 1,
      versionId: 2,
      taskId: 3,
      targetDirectory: original,
      status: '已完成',
      files: [],
      concurrency: 4,
      error: '',
    },
  ]);
  native.listen.mockResolvedValue(() => {});
  native.resume.mockResolvedValue(undefined);
  native.pickDirectory.mockResolvedValue(destination);
});
afterEach(() => {
  unmount?.();
  document.body.innerHTML = '';
});
async function mount() {
  const host = document.createElement('div');
  document.body.append(host);
  const app = createApp({ render: () => h(DownloadHistory, { open: true }) });
  app.mount(host);
  unmount = () => app.unmount();
  await expect.poll(() => document.body.textContent).toContain('重新下载');
}
function button(text: string) {
  const found = [...document.querySelectorAll('button')].find(
    (node) => node.textContent?.replaceAll(/\s/g, '') === text,
  );
  expect(found, `按钮 ${text}`).toBeTruthy();
  if (!found) throw new Error(`缺少按钮 ${text}`);
  return found;
}
async function click(text: string) {
  button(text).click();
  await nextTick();
}
function directory() {
  return document.querySelector<HTMLInputElement>('#restart-download-directory')
    ?.value;
}
describe('下载中心重新下载', () => {
  it('下载弹窗调整并发并显示保存失败，成功后刷新任务', async () => {
    await mount();
    const input = document.querySelector<HTMLInputElement>(
      'input[type="number"]',
    );
    if (!input) throw new Error('缺少并发设置');
    expect(input.value).toBe('4');
    native.setConcurrency.mockRejectedValueOnce(new Error('任务仍在停止中'));
    input.value = '2';
    input.dispatchEvent(new Event('change'));
    await expect
      .poll(() => document.body.textContent)
      .toContain('任务仍在停止中');
    native.setConcurrency.mockResolvedValueOnce(undefined);
    input.value = '2';
    input.dispatchEvent(new Event('change'));
    await expect.poll(() => native.setConcurrency.mock.calls.length).toBe(2);
    expect(native.setConcurrency).toHaveBeenLastCalledWith('job-1', 2);
  });
  it('取消选择保持原目录，选择新目录并显式覆盖后提交，成功刷新', async () => {
    await mount();
    await click('重新下载');
    expect(directory()).toBe(original);
    native.pickDirectory.mockResolvedValueOnce(null);
    await click('修改目录');
    await expect.poll(() => native.pickDirectory.mock.calls.length).toBe(1);
    expect(directory()).toBe(original);
    await click('修改目录');
    await expect.poll(directory).toBe(destination);
    document
      .querySelector<HTMLButtonElement>('#restart-download-overwrite')
      ?.click();
    await nextTick();
    await click('覆盖重新下载');
    await expect
      .poll(() => native.resume.mock.calls)
      .toEqual([['job-1', true, destination]]);
    await expect.poll(() => native.list.mock.calls.length).toBeGreaterThan(1);
  });
  it('默认保留文件且原目录无需重新传入，失败保留弹窗供重试', async () => {
    await mount();
    await click('重新下载');
    native.resume.mockRejectedValueOnce(new Error('任务仍在停止中'));
    await click('开始下载');
    await expect
      .poll(() => document.body.textContent)
      .toContain('任务仍在停止中');
    expect(directory()).toBe(original);
    expect(native.resume).toHaveBeenLastCalledWith('job-1', false, undefined);
    await click('开始下载');
    await expect.poll(() => native.resume.mock.calls.length).toBe(2);
  });
  it('目录选择失败显示原因且不会启动下载', async () => {
    await mount();
    await click('重新下载');
    native.pickDirectory.mockRejectedValueOnce(new Error('无法读取目录'));
    await click('修改目录');
    await expect
      .poll(() => document.body.textContent)
      .toContain('无法读取目录');
    expect(directory()).toBe(original);
    expect(native.resume).not.toHaveBeenCalled();
  });
});
