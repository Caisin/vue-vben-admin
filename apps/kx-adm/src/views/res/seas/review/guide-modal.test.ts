/* eslint-disable vue/one-component-per-file -- 多入口与 KeepAlive 回归宿主。 */
import { createApp, defineComponent, h, KeepAlive, nextTick, ref } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// 使用真实按钮、Modal 和 Portal；按组件导入，避免无关日期组件的 Node ESM 解析限制。
vi.mock('antdv-next', async () => {
  const [
    { default: Alert },
    { default: Button },
    { default: Modal },
    { default: Tag },
  ] = await Promise.all([
    import('antdv-next/dist/alert/index'),
    import('antdv-next/dist/button/index'),
    import('antdv-next/dist/modal/index'),
    import('antdv-next/dist/tag/index'),
  ]);
  return { Alert, Button, Modal, Tag };
});
const session = vi.hoisted(() => ({ uid: '7', counter: 200 }));
vi.mock('@vben/stores', () => ({
  useUserStore: () => ({ userInfo: { userId: session.uid } }),
}));
vi.mock('#/api/request', () => ({ apiURL: 'https://review.example.test/api' }));

let cleanup: (() => void) | undefined;
const cleanups: Array<() => void> = [];
beforeEach(() => {
  session.uid = String(++session.counter);
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  });
});
afterEach(() => {
  cleanups.splice(0).forEach((dispose) => dispose());
  cleanup = undefined;
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

async function settle() {
  // Portal 的挂载、关闭清理和 Teleport 更新跨越多个 Vue 调度轮次。
  for (let n = 0; n < 15; n++) {
    await Promise.resolve();
    await nextTick();
  }
}
function dialog() {
  return document.querySelector('[role="dialog"]');
}
async function click(text: string, root: null | ParentNode = document) {
  if (!root) throw new Error('弹窗未挂载');
  const button = [...root.querySelectorAll('button')].find(
    (item) => item.textContent?.trim() === text,
  );
  expect(button, `找不到按钮：${text}`).toBeTruthy();
  button?.click();
  await settle();
}

for (const name of ['delivery', 'review'] as const) {
  describe(`${name} 操作指引（真实弹窗）`, () => {
    const storageKey = () =>
      name === 'delivery'
        ? `kx:delivery-guide:v2:${location.origin}:${session.uid}`
        : `kx:resource-review:guide:v3:https%3A%2F%2Freview.example.test%2Fapi:${session.uid}`;
    const firstTitle =
      name === 'delivery' ? '先建制作项目，不进入资源库' : '先看流程与分工';
    async function mount() {
      const { default: Guide } =
        name === 'delivery'
          ? await import('./delivery-guide.vue')
          : await import('../global/source_manage/modules/review-guide.vue');
      const root = document.createElement('div');
      document.body.append(root);
      const app = createApp(
        Guide,
        name === 'review' ? { canEdit: true, canManage: true } : {},
      );
      app.mount(root);
      let alive = true;
      cleanup = () => {
        if (alive) app.unmount();
        alive = false;
      };
      cleanups.push(cleanup);
      await settle();
      return root;
    }

    it('首次进入自动显示，步骤可以前进和返回', async () => {
      await mount();
      expect(dialog()?.isConnected).toBe(true);
      expect(dialog()?.querySelector('h3')?.textContent).toBe(firstTitle);
      await click('下一步', dialog());
      expect(dialog()?.querySelector('h3')?.textContent).not.toBe(firstTitle);
      await click('上一步', dialog());
      expect(dialog()?.querySelector('h3')?.textContent).toBe(firstTitle);
    });

    it.each(['legacy', 'shared'])(
      '读取 %s 关闭记录，手动打开和重开回到第一步',
      async (record) => {
        localStorage.setItem(
          record === 'legacy'
            ? storageKey()
            : `kx:production-guide:dismissed:https%3A%2F%2Freview.example.test%2Fapi:${session.uid}`,
          'seen',
        );
        const root = await mount();
        expect(dialog()).toBeNull();
        await click('操作指引', root);
        expect(dialog()?.isConnected).toBe(true);
        await click('下一步', dialog());
        await click('稍后再看', dialog());
        await vi.waitFor(() => {
          expect(
            document.querySelector<HTMLElement>('.ant-modal-wrap')?.style
              .display,
          ).toBe('none');
        });
        await click('操作指引', root);
        expect(dialog()?.isConnected).toBe(true);
        expect(dialog()?.querySelector('h3')?.textContent).toBe(firstTitle);
        const close =
          dialog()?.querySelector<HTMLButtonElement>('.ant-modal-close');
        expect(close).toBeTruthy();
        close?.click();
        await settle();
        await click('操作指引', root);
        expect(dialog()?.isConnected).toBe(true);
      },
    );

    it('稍后再看后重新挂载不再弹出，仍可手动查看', async () => {
      await mount();
      await click('稍后再看', dialog());
      cleanup?.();
      const root = await mount();
      expect(dialog()).toBeNull();
      await click('操作指引', root);
      expect(dialog()?.isConnected).toBe(true);
    });

    it('关闭按钮也记住选择', async () => {
      await mount();
      const close =
        dialog()?.querySelector<HTMLButtonElement>('.ant-modal-close');
      expect(close).toBeTruthy();
      close?.click();
      await settle();
      cleanup?.();
      await mount();
      expect(dialog()).toBeNull();
    });

    it('读完记录已读，再次进入不自动弹出但仍可重看', async () => {
      await mount();
      for (let n = 0; n < 5; n++) await click('下一步', dialog());
      await click(
        name === 'delivery' ? '我知道了，开始交付' : '我知道了，开始操作',
        dialog(),
      );
      expect(
        localStorage.getItem(
          `kx:production-guide:dismissed:https%3A%2F%2Freview.example.test%2Fapi:${session.uid}`,
        ),
      ).toBe('seen');
      cleanup?.();
      const root = await mount();
      expect(dialog()).toBeNull();
      await click('操作指引', root);
      expect(dialog()?.isConnected).toBe(true);
      expect(dialog()?.querySelector('h3')?.textContent).toBe(firstTitle);
    });
  });
}

function visibleDialogs() {
  return [...document.querySelectorAll<HTMLElement>('.ant-modal-wrap')].filter(
    (item) => item.style.display !== 'none',
  );
}

it('列表、项目、审片同时挂载只弹一次；关闭记录在两种指引间共享', async () => {
  const [{ default: Delivery }, { default: Review }] = await Promise.all([
    import('./delivery-guide.vue'),
    import('../global/source_manage/modules/review-guide.vue'),
  ]);
  const root = document.createElement('div');
  document.body.append(root);
  const app = createApp({
    render: () =>
      h('div', [
        h(Delivery),
        h(Delivery),
        h(Review, { canEdit: true, canManage: true }),
      ]),
  });
  app.mount(root);
  cleanups.push(() => app.unmount());
  await settle();
  expect(visibleDialogs()).toHaveLength(1);
  await click('稍后再看', visibleDialogs()[0] ?? null);
  await vi.waitFor(() => expect(visibleDialogs()).toHaveLength(0));
  root.querySelectorAll<HTMLButtonElement>('button')[2]?.click();
  await settle();
  expect(visibleDialogs()).toHaveLength(1);
  expect(visibleDialogs()[0]?.textContent).toContain('作品审核');
  await click('稍后再看', visibleDialogs()[0] ?? null);
  await vi.waitFor(() => expect(visibleDialogs()).toHaveLength(0));
  const host = document.createElement('div');
  document.body.append(host);
  const second = createApp(Review, { canEdit: true, canManage: true });
  second.mount(host);
  cleanups.push(() => second.unmount());
  await settle();
  expect(visibleDialogs()).toHaveLength(0);
});

it('切换缓存页面关闭原指引，返回或进入新菜单不重复自动弹出', async () => {
  const { default: Delivery } = await import('./delivery-guide.vue');
  const page = ref(0);
  const first = defineComponent({
    name: 'FirstGuidePage',
    setup: () => () => h(Delivery),
  });
  const second = defineComponent({
    name: 'SecondGuidePage',
    setup: () => () => h(Delivery),
  });
  const root = document.createElement('div');
  document.body.append(root);
  const app = createApp({
    render: () => h(KeepAlive, {}, () => h(page.value === 0 ? first : second)),
  });
  app.mount(root);
  cleanups.push(() => app.unmount());
  await settle();
  expect(visibleDialogs()).toHaveLength(1);
  page.value = 1;
  await settle();
  await vi.waitFor(() => expect(visibleDialogs()).toHaveLength(0));
  await click('操作指引', root);
  expect(visibleDialogs()).toHaveLength(1);
  page.value = 0;
  await settle();
  await vi.waitFor(() => expect(visibleDialogs()).toHaveLength(0));
  await click('操作指引', root);
  expect(visibleDialogs()).toHaveLength(1);
});

it('其它窗口关闭指引后同步关闭本窗口，后续仅手动打开', async () => {
  const { default: Delivery } = await import('./delivery-guide.vue');
  const root = document.createElement('div');
  document.body.append(root);
  const app = createApp(Delivery);
  app.mount(root);
  cleanups.push(() => app.unmount());
  await settle();
  expect(visibleDialogs()).toHaveLength(1);
  window.dispatchEvent(
    new StorageEvent('storage', {
      key: `kx:production-guide:dismissed:https%3A%2F%2Freview.example.test%2Fapi:${session.uid}`,
      newValue: 'seen',
    }),
  );
  await settle();
  await vi.waitFor(() => expect(visibleDialogs()).toHaveLength(0));
  await click('操作指引', root);
  expect(visibleDialogs()).toHaveLength(1);
});
