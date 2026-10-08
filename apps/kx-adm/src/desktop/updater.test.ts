/* eslint-disable vue/one-component-per-file, vue/require-prop-types -- 更新交互组件桩。 */
import { createApp, nextTick } from 'vue';

import { afterEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  invoke: vi.fn(),
  listen: vi.fn(),
  off: vi.fn(),
}));
vi.mock('@tauri-apps/api/core', () => ({ invoke: state.invoke }));
vi.mock('@tauri-apps/api/event', () => ({ listen: state.listen }));
vi.mock('./index', () => ({ desktop: true }));
vi.mock('antdv-next', async () => {
  const { defineComponent, h } = await import('vue');
  const Wrap = defineComponent({
    setup:
      (_p, { slots }) =>
      () =>
        h('div', slots.default?.()),
  });
  return {
    Space: Wrap,
    Progress: Wrap,
    Alert: defineComponent({
      props: ['message'],
      setup: (p) => () => h('p', p.message),
    }),
    Button: defineComponent({
      props: ['disabled'],
      emits: ['click'],
      setup:
        (p, { slots, emit }) =>
        () =>
          h(
            'button',
            { disabled: p.disabled, onClick: () => emit('click') },
            slots.default?.(),
          ),
    }),
    Modal: defineComponent({
      props: ['open'],
      setup:
        (p, { slots }) =>
        () =>
          p.open ? h('aside', slots.default?.()) : null,
    }),
    message: { success: vi.fn() },
  };
});
let unmount: (() => void) | undefined;
afterEach(() => {
  unmount?.();
  document.body.innerHTML = '';
  vi.clearAllMocks();
});
async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await nextTick();
}
async function mount() {
  state.listen.mockResolvedValue(state.off);
  const { default: Updater } = await import('./updater.vue');
  const host = document.createElement('div');
  document.body.append(host);
  const app = createApp(Updater);
  app.mount(host);
  unmount = () => app.unmount();
  await flush();
}
function click(text: string) {
  const button = [...document.querySelectorAll('button')].find(
    (b) => b.textContent?.trim() === text,
  );
  expect(button).toBeDefined();
  button?.click();
}
describe('桌面更新', () => {
  it('自动发现更新，用户确认才请求安装，任务忙时展示错误', async () => {
    state.invoke.mockImplementation(async (cmd) => {
      if (cmd === 'desktop_update_check')
        return { currentVersion: '0.1.0', version: '0.1.1', notes: '修复下载' };
      throw new Error('请先暂停上传和下载');
    });
    await mount();
    expect(document.querySelector('aside')?.textContent).toContain('修复下载');
    expect(state.invoke).toHaveBeenCalledTimes(1);
    click('下载并重启安装');
    await flush();
    expect(state.invoke).toHaveBeenCalledWith('desktop_update_install', {
      version: '0.1.1',
    });
    expect(document.body.textContent).toContain('请先暂停上传和下载');
  });
  it('自动检查离线不弹窗，手动检查展示失败', async () => {
    state.invoke.mockRejectedValue(new Error('network unavailable'));
    await mount();
    expect(document.querySelector('aside')).toBeNull();
    click('检查客户端更新');
    await flush();
    expect(document.querySelector('aside')?.textContent).toContain(
      'network unavailable',
    );
    unmount?.();
    unmount = undefined;
    expect(state.off).toHaveBeenCalledTimes(1);
  });
});
