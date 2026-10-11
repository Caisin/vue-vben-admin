/* eslint-disable vue/one-component-per-file, vue/require-prop-types -- 测试组件桩。 */
import { createApp, h, nextTick, ref } from 'vue';

import { afterEach, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({
  list: vi.fn(),
  play: vi.fn(),
  restore: vi.fn(),
  setState: vi.fn(),
}));
vi.mock('#/api/res/episode-history', () => ({ episodeHistoryApi: api }));
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
    props: ['open', 'title', 'okText', 'okButtonProps'],
    emits: ['ok', 'cancel'],
    setup:
      (p, { slots, emit }) =>
      () =>
        p.open
          ? h('section', { role: 'dialog' }, [
              h('h2', p.title),
              slots.default?.(),
              p.okText
                ? h(
                    'button',
                    {
                      disabled: p.okButtonProps?.disabled,
                      onClick: () => emit('ok'),
                    },
                    p.okText,
                  )
                : null,
              h('button', { onClick: () => emit('cancel') }, '关闭'),
            ])
          : null,
  });
  const TextArea = defineComponent({
    props: ['value', 'placeholder'],
    emits: ['update:value'],
    setup:
      (p, { emit }) =>
      () =>
        h('textarea', {
          value: p.value,
          placeholder: p.placeholder,
          onInput: (e: Event) =>
            emit('update:value', (e.target as HTMLTextAreaElement).value),
        }),
  });
  const Alert = defineComponent({
    props: ['message'],
    setup: (p) => () => h('p', p.message),
  });
  return {
    Modal,
    Button,
    TextArea,
    Alert,
    Empty: Wrap,
    Spin: Wrap,
    Tag: Wrap,
    Pagination: Wrap,
  };
});
let cleanup: (() => void) | undefined;
let changed = vi.fn();
afterEach(() => {
  cleanup?.();
  document.body.innerHTML = '';
  vi.clearAllMocks();
  vi.restoreAllMocks();
});
async function settle() {
  for (let i = 0; i < 12; i++) {
    await Promise.resolve();
    await nextTick();
  }
}
function buttons(text: string) {
  return [...document.querySelectorAll('button')].filter(
    (b) => b.textContent?.trim() === text,
  );
}
function button(text: string) {
  const b = buttons(text)[0];
  if (!b) throw new Error(`缺少${text}`);
  return b;
}
const current = {
  id: 12,
  title: '第1集',
  duration: 30,
  remark: '调色版',
  actor_uid: 2,
  actor_name: '剪辑小周',
  action: 'replace',
  reason: '重新调色',
  changes: '视频',
  restored_from: null,
  created_at: 1_791_686_400,
  is_current: true,
};
const old = {
  ...current,
  id: 11,
  actor_uid: 3,
  actor_name: '剪辑小林',
  reason: '最初上传',
  action: 'upload',
  is_current: false,
};
async function mount(editable = true, extra: Record<string, unknown> = {}) {
  api.list.mockResolvedValue({
    items: [current, old],
    total: 2,
    revision: 8,
    can_restore: editable,
    legacy_current: false,
  });
  api.play.mockResolvedValue('https://video.example.test/old.mp4');
  api.restore.mockResolvedValue(undefined);
  changed = vi.fn();
  const versionRevision = ref(8);
  const { default: History } = await import('./modules/episode-history.vue');
  const host = document.createElement('div');
  document.body.append(host);
  const app = createApp({
    render: () =>
      h(History, {
        res: 1,
        version: 10,
        seq: 1,
        revision: versionRevision.value,
        editable,
        disabled: false,
        onRestored: changed,
        ...extra,
      }),
  });
  app.mount(host);
  cleanup = () => app.unmount();
  button('历史版本 / 修改时间线').click();
  await settle();
  return versionRevision;
}
it('历史列表显示操作人和说明，预览不会替换当前视频', async () => {
  await mount();
  expect(document.body.textContent).toContain('剪辑小周');
  expect(document.body.textContent).toContain('剪辑小林');
  expect(document.body.textContent).toContain('重新调色');
  buttons('预览此版本')[1]?.click();
  await settle();
  expect(api.play).toHaveBeenCalledWith(1, 10, 1, 11);
  expect(document.querySelector('video')?.getAttribute('src')).toBe(
    'https://video.example.test/old.mp4',
  );
  expect(api.restore).not.toHaveBeenCalled();
});
it('恢复必须填原因，固定确认时的修订号并刷新当前集', async () => {
  const revision = await mount();
  button('恢复为当前版本').click();
  await settle();
  expect(button('确认恢复为当前版本').disabled).toBe(true);
  const input = document.querySelector('textarea');
  if (!input) throw new Error('缺少原因');
  input.value = '恢复上一版确认画面';
  input.dispatchEvent(new Event('input'));
  await settle();
  api.list.mockResolvedValue({
    items: [current, old],
    total: 2,
    revision: 9,
    can_restore: true,
    legacy_current: false,
  });
  revision.value = 9;
  await settle();
  button('确认恢复为当前版本').click();
  await settle();
  expect(api.restore).toHaveBeenCalledWith(
    1,
    10,
    1,
    11,
    8,
    '恢复上一版确认画面',
  );
  expect(changed).toHaveBeenCalledOnce();
  expect(document.body.textContent).toContain('已保留恢复前的视频');
});
it('只读版本隐藏恢复入口，仍能预览历史', async () => {
  await mount(false);
  expect(buttons('恢复为当前版本')).toHaveLength(0);
  expect(buttons('预览此版本')).toHaveLength(2);
  expect(document.body.textContent).toContain('当前版本只读');
});
it('恢复冲突保留原因和目标，不触发成功刷新', async () => {
  await mount();
  api.restore.mockRejectedValue(new Error('版本已变化，请刷新后重试'));
  button('恢复为当前版本').click();
  await settle();
  const input = document.querySelector('textarea');
  if (!input) throw new Error('缺少原因');
  input.value = '退回';
  input.dispatchEvent(new Event('input'));
  await settle();
  button('确认恢复为当前版本').click();
  await settle();
  expect(document.body.textContent).toContain('版本已变化');
  expect(document.querySelector('textarea')?.value).toBe('退回');
  expect(changed).not.toHaveBeenCalled();
});
it('关闭历史预览释放本地视频地址', async () => {
  await mount();
  api.play.mockResolvedValue('blob:history');
  const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  buttons('预览此版本')[1]?.click();
  await settle();
  button('关闭').click();
  await settle();
  expect(revoke).toHaveBeenCalledWith('blob:history');
});

it('已定稿集禁止恢复，负责人重新打开必须填写原因', async () => {
  await mount(true, {
    canManage: true,
    reviewing: true,
    hasVideo: true,
    finalizedAt: 123,
  });
  api.list.mockResolvedValue({
    items: [current, old],
    total: 2,
    revision: 8,
    can_restore: false,
    finalized_at: 123,
    legacy_current: false,
  });
  button('刷新历史').click();
  await settle();
  expect(buttons('恢复为当前版本')).toHaveLength(0);
  expect(
    document.querySelector('[aria-label="本集修改时间线"]'),
  ).not.toBeNull();
  button('重新打开修改').click();
  await settle();
  expect(button('确认重新打开').disabled).toBe(true);
  const input = document.querySelector('textarea');
  if (!input) throw new Error('缺少原因');
  input.value = '客户要求更正片尾';
  input.dispatchEvent(new Event('input'));
  await settle();
  button('确认重新打开').click();
  await settle();
  expect(api.setState).toHaveBeenCalledWith(
    1,
    10,
    1,
    8,
    false,
    '客户要求更正片尾',
  );
  expect(changed).toHaveBeenCalledOnce();
});
it('未解决建议时禁用单集定稿，非负责人无定稿入口', async () => {
  await mount(true, {
    canManage: true,
    reviewing: true,
    hasVideo: true,
    pending: 1,
  });
  expect(button('本集定稿').disabled).toBe(true);
});
