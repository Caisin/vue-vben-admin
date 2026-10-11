/* eslint-disable vue/one-component-per-file, vue/require-prop-types -- 指引测试组件桩。 */
import { createApp, h, nextTick } from 'vue';

import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const session = vi.hoisted(() => ({ uid: '7' }));
vi.mock('@vben/stores', () => ({
  useUserStore: () => ({ userInfo: { userId: session.uid } }),
}));
vi.mock('#/api/request', () => ({ apiURL: 'https://review.example.test/api' }));
vi.mock('antdv-next', async () => {
  const { defineComponent, h } = await import('vue');
  const Wrap = defineComponent({
    setup:
      (_p, { slots }) =>
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
  const Alert = defineComponent({
    props: ['message'],
    setup: (p) => () => h('p', p.message),
  });
  const Modal = defineComponent({
    props: ['open', 'title'],
    setup:
      (p, { slots }) =>
      () =>
        p.open
          ? h('section', { role: 'dialog' }, [
              h('h2', p.title),
              slots.default?.(),
            ])
          : null,
  });
  return { Button, Modal, Tag: Wrap, Alert };
});
let cleanup: (() => void) | undefined;
beforeEach(() => {
  session.uid = '7';
  const values = new Map<string, string>();
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      clear: () => values.clear(),
      get length() {
        return values.size;
      },
    },
  });
});
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});
async function settle() {
  await nextTick();
  await nextTick();
}
async function mount(canManage = false, canEdit = false) {
  const { default: Guide } = await import('./modules/review-guide.vue');
  const host = document.createElement('div');
  document.body.append(host);
  const app = createApp({ render: () => h(Guide, { canManage, canEdit }) });
  app.mount(host);
  cleanup = () => app.unmount();
  await settle();
}
function button(text: string) {
  const item = [...document.querySelectorAll('button')].find(
    (b) => b.textContent?.trim() === text,
  );
  if (!item) throw new Error(`缺少 ${text}`);
  return item;
}
async function finish() {
  for (let i = 0; i < 5; i++) {
    button('下一步').click();
    await settle();
  }
  button('我知道了，开始操作').click();
  await settle();
}
function unmount() {
  cleanup?.();
  cleanup = undefined;
  document.body.innerHTML = '';
}
it('首次进入自动展示完整流程；看完后不重复提示，常驻按钮可重新查看', async () => {
  await mount();
  expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  expect(document.body.textContent).toContain('交片不等于定版');
  expect(document.body.textContent).toContain('编剧 / 导演');
  await finish();
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  unmount();
  await mount();
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  button('操作指引').click();
  await settle();
  expect(document.body.textContent).toContain('先看流程与分工');
});
it('稍后再看不标记已读，下一次仍显示', async () => {
  await mount(true, true);
  expect(document.body.textContent).toContain('作品负责人');
  button('稍后再看').click();
  await settle();
  expect(window.localStorage.length).toBe(0);
  unmount();
  await mount();
  expect(document.querySelector('[role="dialog"]')).not.toBeNull();
});
it('已读记录按账号隔离，另一个协作者仍看到首次指引', async () => {
  await mount(false, true);
  expect(document.body.textContent).toContain('当前身份：剪辑');
  await finish();
  unmount();
  session.uid = '8';
  await mount();
  expect(document.querySelector('[role="dialog"]')).not.toBeNull();
});
it('本地存储不可用时不阻断审核，仍可关闭和重看指引', async () => {
  vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
    throw new Error('disabled');
  });
  vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
    throw new Error('disabled');
  });
  await mount();
  await finish();
  expect(document.body.textContent).toContain('此设备无法保存已读状态');
  button('稍后再看').click();
  await settle();
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  button('操作指引').click();
  await settle();
  expect(document.querySelector('[role="dialog"]')).not.toBeNull();
});
it('未加载登录身份时不记录为所有人共有的已读状态', async () => {
  session.uid = '';
  await mount();
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  button('操作指引').click();
  await settle();
  await finish();
  expect(window.localStorage.length).toBe(0);
});
