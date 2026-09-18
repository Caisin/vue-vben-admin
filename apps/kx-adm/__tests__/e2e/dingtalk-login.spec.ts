import type { Page, Route } from '@playwright/test';

import { Buffer } from 'node:buffer';

import { KxEd } from '@kx/admin-core';
import { expect, test } from '@playwright/test';

async function mockLogin(page: Page) {
  const state = { exchanges: 0, failMenus: false };
  await page.route('**/{auth,param,notify}/**', async (route) => {
    if (!['fetch', 'xhr'].includes(route.request().resourceType())) {
      await route.continue();
      return;
    }
    const path = new URL(route.request().url()).pathname.replace(
      /^\/api(?=\/)/,
      '',
    );
    let result: unknown = [];
    if (path === '/auth/dt/exchange' || path === '/auth/user/access_token') {
      if (path === '/auth/dt/exchange') state.exchanges++;
      result = {
        access_token: 'test-token',
        token_type: 'Bearer',
        uid: 1,
        exp_at: 4_102_444_800,
        exp_in: 3600,
      };
    } else if (path === '/auth/user/user_info') {
      result = {
        id: 1,
        name: '钉钉测试用户',
        enabled: true,
        home_path: '/user-overview',
        roles: [],
        permission_count: 0,
      };
    } else if (path === '/auth/menu/current') {
      if (state.failMenus) {
        await fulfillApi(route, null, 500);
        return;
      }
      result = [
        {
          id: 1,
          pid: 0,
          name: 'System',
          title: '系统管理',
          path: '/system',
          component: 'BasicLayout',
          perm_type: 'catalog',
          enabled: true,
          order_no: 1,
          auth_code: '',
          meta: {},
        },
      ];
    } else if (path === '/auth/dt/apps') {
      result = [
        { app_key: 'test-app', app_name: '测试应用', is_default: true },
      ];
    } else if (path === '/auth/user/mfa') {
      result = { totp_enabled: false, setup_allowed: true };
    } else if (path === '/param/system-settings/public') {
      result = {};
    } else if (path === '/notify/inbox') {
      result = { items: [], unread_count: 0 };
    }
    await fulfillApi(route, result);
  });
  return state;
}

async function fulfillApi(route: Route, result: unknown, code = 200) {
  const body = JSON.stringify({
    code,
    msg: code === 200 ? 'ok' : '测试菜单读取失败',
    result,
  });
  await route.fulfill({
    body:
      route.request().headers().security === 'true'
        ? Buffer.from(KxEd.encryptText(body))
        : body,
    contentType: 'application/json',
  });
}

for (const legacy of [false, true]) {
  test(`钉钉回调进入系统并刷新（缺少新 API：${legacy}）`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 390, height: 844 });
    if (legacy) {
      await page.addInitScript(() => {
        // oxlint-disable-next-line no-extend-native -- 在独立页面中模拟旧 WebView。
        Object.defineProperty(Array.prototype, 'toSorted', {
          configurable: true,
          writable: true,
          value: undefined,
        });
        // oxlint-disable-next-line no-extend-native -- 在独立页面中模拟旧 WebView。
        Object.defineProperty(Array.prototype, 'toReversed', {
          configurable: true,
          writable: true,
          value: undefined,
        });
        Object.defineProperty(Object, 'hasOwn', {
          configurable: true,
          writable: true,
          value: undefined,
        });
      });
    }
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const state = await mockLogin(page);
    await page.goto('/#/auth/login?exchange_code=test-code');
    await expect(page.getByRole('heading', { name: '账号概览' })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page).toHaveURL(/user-overview/);
    expect(state.exchanges).toBe(1);
    await page.reload();
    await expect(page.getByRole('heading', { name: '账号概览' })).toBeVisible({
      timeout: 30_000,
    });
    expect(state.exchanges).toBe(1);
    expect(errors).toEqual([]);
  });
}

test('菜单失败后可重试，刷新失败后仍可回到登录页', async ({ page }) => {
  test.setTimeout(90_000);
  const state = await mockLogin(page);
  state.failMenus = true;
  await page.goto('/#/auth/login?exchange_code=test-code');
  await expect(page.getByText('钉钉登录失败，请重新发起登录')).toBeVisible({
    timeout: 30_000,
  });
  await expect(
    page.getByRole('button', { name: '使用钉钉登录' }),
  ).toBeEnabled();
  // 新的回调必须能消费新交换码，而不是被残留 Token 拦截到菜单守卫。
  state.failMenus = false;
  await page.goto('/#/auth/login?exchange_code=retry-code');
  await expect(page.getByRole('heading', { name: '账号概览' })).toBeVisible({
    timeout: 30_000,
  });
  expect(state.exchanges).toBe(2);
  state.failMenus = true;
  await page.reload();
  await expect(page.locator("input[name='username']")).toBeVisible({
    timeout: 30_000,
  });
  await expect(page).toHaveURL(/auth\/login/);
  await expect(page.locator('#nprogress')).toHaveCount(0);
});
