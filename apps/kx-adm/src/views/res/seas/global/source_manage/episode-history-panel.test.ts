/* eslint-disable vue/one-component-per-file -- 真实审片 Modal 回归宿主与内容桩。 */
import { createApp, h, nextTick, ref } from 'vue';

import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  list: vi.fn(),
  play: vi.fn(),
  restore: vi.fn(),
  setState: vi.fn(),
}));
vi.mock('#/api/res/episode-history', () => ({ episodeHistoryApi: api }));
vi.mock('#/request-errors', () => ({
  requestErrorMessage: (error: Error) => error.message,
}));
vi.mock('antdv-next', async () => {
  const [{ default: Button }, { default: Modal }, { defineComponent, h }] =
    await Promise.all([
      import('antdv-next/dist/button/index'),
      import('antdv-next/dist/modal/index'),
      import('vue'),
    ]);
  const Wrap = defineComponent({
    setup:
      (_props, { slots }) =>
      () =>
        h('div', slots.default?.()),
  });
  const Alert = defineComponent({
    props: { message: { type: String, default: '' } },
    setup: (props) => () => h('p', props.message),
  });
  return {
    Button,
    Modal,
    Alert,
    Empty: Wrap,
    Spin: Wrap,
    Tag: Wrap,
    TextArea: Wrap,
    Pagination: Wrap,
  };
});
let cleanup: (() => void) | undefined;
beforeEach(() => {
  api.list.mockReset().mockResolvedValue({
    items: [
      {
        id: 1,
        title: '最初视频',
        actor_name: '测试剪辑',
        created_at: 1,
        action: 'upload',
        is_current: false,
        restorable: true,
      },
    ],
    total: 1,
    revision: 1,
    can_restore: true,
    legacy_current: false,
  });
});
afterEach(() => {
  cleanup?.();
  document.body.innerHTML = '';
});
async function settle() {
  for (let i = 0; i < 15; i++) {
    await Promise.resolve();
    await nextTick();
  }
}
function visibleDialogs() {
  return [...document.querySelectorAll<HTMLElement>('.ant-modal-wrap')].filter(
    (wrap) => wrap.style.display !== 'none',
  );
}
async function click(text: string, root: ParentNode = document) {
  const button = [...root.querySelectorAll('button')].find(
    (b) => b.textContent?.replaceAll(/\s/g, '') === text.replaceAll(/\s/g, ''),
  );
  if (!button) throw new Error(`缺少按钮：${text}`);
  button.click();
  await settle();
}
async function mount(nested = false) {
  const { default: Modal } = await import('antdv-next/dist/modal/index');
  const { default: History } = await import('./modules/episode-history.vue');
  const seq = ref(1);
  const root = document.createElement('div');
  document.body.append(root);
  const content = () =>
    h(History, {
      key: seq.value,
      res: -1,
      version: 10,
      seq: seq.value,
      revision: 1,
      editable: true,
      disabled: false,
      canManage: true,
      reviewing: true,
      hasVideo: true,
    });
  const app = createApp({
    render: () =>
      nested
        ? h(
            Modal,
            {
              open: true,
              title: '视频版本预览与审片',
              getContainer: 'body',
              footer: null,
            },
            { default: content },
          )
        : content(),
  });
  app.directive('access', {});
  app.mount(root);
  cleanup = () => app.unmount();
  return { root: nested ? document.body : root, seq };
}

it.each([false, true])(
  '历史时间线原位展开，返回后可以重开（等待挂载：%s）',
  async (settled) => {
    const { root } = await mount();
    if (settled) await settle();
    await click('历史版本 / 修改时间线', root);
    expect(api.list).toHaveBeenCalledWith(-1, 10, 1, 1);
    const panel = root.querySelector('[aria-label="历史版本与修改时间线"]');
    expect(panel?.isConnected).toBe(true);
    expect(panel?.textContent).toContain('测试剪辑');
    expect(visibleDialogs()).toHaveLength(0);
    await click('返回当前视频', root);
    expect(
      root.querySelector('[aria-label="历史版本与修改时间线"]'),
    ).toBeNull();
    await click('历史版本 / 修改时间线', root);
    expect(
      root.querySelector('[aria-label="历史版本与修改时间线"]')?.isConnected,
    ).toBe(true);
  },
);

it('审片内原位查看与恢复确认不新增弹窗，切换分集后清理旧面板', async () => {
  const { root, seq } = await mount(true);
  await settle();
  const parent = visibleDialogs()[0];
  if (!parent) throw new Error('缺少审片弹窗');
  await click('历史版本 / 修改时间线', root);
  const history = parent.querySelector('[aria-label="历史版本与修改时间线"]');
  expect(history?.isConnected).toBe(true);
  expect(visibleDialogs()).toHaveLength(1);
  if (!history) throw new Error('缺少历史面板');
  await click('恢复为当前版本', history);
  expect(
    history.querySelector('[aria-label="恢复历史版本确认"]'),
  ).not.toBeNull();
  expect(visibleDialogs()).toHaveLength(1);
  await click('取消恢复', history);
  expect(history.querySelector('[aria-label="恢复历史版本确认"]')).toBeNull();
  expect(api.restore).not.toHaveBeenCalled();
  seq.value = 2;
  await settle();
  expect(
    parent.querySelector('[aria-label="历史版本与修改时间线"]'),
  ).toBeNull();
  await click('历史版本 / 修改时间线', root);
  expect(
    parent.querySelector('[aria-label="历史版本与修改时间线"]')?.textContent,
  ).toContain('第 2 集');
  await click('返回当前视频', root);
  await click('本集定稿', root);
  expect(
    parent.querySelector('[aria-label="分集状态确认"]')?.textContent,
  ).toContain('确认定稿');
  expect(visibleDialogs()).toHaveLength(1);
});

it('历史请求失败在面板内提示，刷新后可以恢复', async () => {
  const { root } = await mount();
  api.list.mockRejectedValueOnce(new Error('读取历史暂时失败'));
  await click('历史版本 / 修改时间线', root);
  expect(root.textContent).toContain('读取历史暂时失败');
  await click('刷新历史', root);
  expect(root.textContent).toContain('测试剪辑');
  expect(root.textContent).not.toContain('读取历史暂时失败');
});
