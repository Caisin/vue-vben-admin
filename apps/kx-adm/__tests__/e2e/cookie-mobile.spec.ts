import type { Page, Route } from '@playwright/test';

import { Buffer } from 'node:buffer';

import { KxEd } from '@kx/admin-core';
import { expect, test } from '@playwright/test';

test.use({ headless: true, actionTimeout: 10_000 });

async function fixture(page: Page, admin: boolean) {
  const state = {
    renamed: '',
    saved: false,
    submitted: false,
    failSave: true,
    grants: 0,
  };
  const site = (id: number) => ({
    id,
    name: state.renamed || `运营网站${id}`,
    account_label: `华东运营账号${id}`,
    origin: 'https://adxray-app.dataeye.com',
    credential_code: 'login-secret',
    proxy_enabled: true,
    proxy_origin: null,
    proxy_url: 'https://long-subdomain-for-mobile.proxy.example.test/_kx/login',
    proxy_resources: [
      { name: 'cdn', origin: 'https://adxray-app-cdn.dataeye.com' },
    ],
    cookies: [
      {
        name: 'session',
        domain: '.dataeye.com',
        path: '/',
        secure: true,
        http_only: true,
        same_site: 'lax',
        expires_at: 4_102_444_800,
      },
    ],
    allowed_uids: [7],
    enabled: true,
    warning_hours: 72,
    version: 1,
    refreshed_at: 1_700_000_000,
    expires_at: 4_102_444_800,
    status: id === 2 ? 'expired' : 'active',
  });
  await page.route(
    '**/{auth,cookie-manager,credential,notify,param}/**',
    async (route) => {
      const request = route.request();
      if (!['fetch', 'xhr'].includes(request.resourceType()))
        return route.continue();
      const url = new URL(request.url());
      const path = url.pathname.replace(/^\/api(?=\/)/, '');
      let result: unknown = [];
      let code = 200;
      let msg = 'ok';
      const body = () => {
        const bytes = request.postDataBuffer();
        if (!bytes) throw new Error('缺少测试请求体');
        return JSON.parse(KxEd.decryptText(bytes));
      };
      if (path === '/auth/dt/exchange')
        result = {
          access_token: 'fixture-token',
          uid: 7,
          exp_at: 4_102_444_800,
          exp_in: 3600,
        };
      else if (path === '/auth/user/user_info')
        result = {
          id: 7,
          name: '测试用户',
          enabled: true,
          home_path: `/cookie-manager/${admin ? 'sites' : 'my-sites'}`,
        };
      else if (path === '/auth/per/codes')
        result = admin
          ? ['cookie-manager:manage', 'cookie-manager:assign']
          : [];
      else if (path === '/auth/menu/current')
        result = ['sites', 'my-sites'].map((name, i) => ({
          id: i + 1,
          pid: 0,
          name: `Cookie${i}`,
          title: name,
          path: `/cookie-manager/${name}`,
          component: `/cookie-manager/${name}`,
          perm_type: 'menu',
          enabled: true,
          order_no: i,
          meta: {},
        }));
      else if (path === '/notify/inbox')
        result = { items: [], unread_count: 0 };
      else if (path === '/param/system-settings/public') result = {};
      else if (path === '/cookie-manager/my-sites')
        result = Array.from({ length: 21 }, (_, i) => site(i + 1));
      else if (path === '/cookie-manager/sites')
        result = { items: [site(1)], total: 21 };
      else if (path === '/cookie-manager/sites/1/name') {
        state.renamed = body().name;
        result = site(1);
      } else if (
        path === '/cookie-manager/sites/1' &&
        request.method() === 'PUT'
      ) {
        if (state.failSave) {
          state.failSave = false;
          code = 400;
          msg = '配置已变化，请重试';
        } else {
          state.saved = true;
          expect(body().proxy_resources[0].name).toBe('mobile-cdn');
          result = site(1);
        }
      } else if (path === '/cookie-manager/sites/quick-dataeye') {
        expect(body().username).toBe('手机账号');
        result = site(1);
      } else if (
        path === '/cookie-manager/sites/1/login' ||
        path === '/cookie-manager/logins/11' ||
        path === '/cookie-manager/logins/11/submit'
      ) {
        if (path.endsWith('/submit')) {
          expect(body().code).toBe('1234');
          state.submitted = true;
        }
        result = {
          id: 11,
          site_id: 1,
          state: state.submitted ? 'succeeded' : 'captcha_ready',
          expires_at: 4_102_444_800,
          error_message: '',
          captcha_data_url: state.submitted
            ? null
            : 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jfZkAAAAASUVORK5CYII=',
        };
      } else if (path === '/cookie-manager/proxy/grant-direct') {
        state.grants++;
        result = {
          url: 'https://proxy.example.test/_kx/complete#ticket=fixture',
        };
      }
      await fulfill(route, result, code, msg);
    },
  );
  await page.route('https://proxy.example.test/**', (route) =>
    route.fulfill({
      contentType: 'text/html; charset=utf-8',
      body: '<h1>授权网站</h1>',
    }),
  );
  await page.goto('/#/auth/login?exchange_code=fixture');
  return state;
}

async function expectNoOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const dialog = page.getByRole('dialog');
  if (await dialog.count()) {
    await expect(dialog).toHaveCount(1);
    await expect(dialog.locator('.ant-modal-body')).toBeVisible();
    const bounds = await dialog.boundingBox();
    expect(bounds?.x).toBeGreaterThanOrEqual(0);
    expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(
      page.viewportSize()?.width ?? 0,
    );
    const body = dialog.locator('.ant-modal-body');
    expect(
      await body.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    ).toBe(true);
  }
}

for (const width of [360, 390]) {
  test(`我的授权 ${width}px：搜索、分页、状态和当前窗口进入`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 844 });
    const state = await fixture(page, false);
    await expect(page.getByRole('article')).toHaveCount(20);
    await expectNoOverflow(page);
    await expect(
      page
        .getByRole('article')
        .filter({ hasText: '华东运营账号2' })
        .first()
        .getByRole('button', { name: '进入代理网站' }),
    ).toBeDisabled();
    await page.getByRole('button', { name: '下一页', exact: true }).click();
    await expect(page.getByRole('article')).toHaveCount(1);
    await expect(page.getByRole('article')).toContainText('华东运营账号21');
    await page.getByPlaceholder('搜索网站、账号或域名').fill('华东运营账号1');
    await expect(page.getByRole('article')).toHaveCount(11);
    await expect(
      page.getByRole('button', { name: '维护', exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole('heading', { name: '我的网站授权', exact: true })
      .scrollIntoViewIfNeeded();
    await expect(page.getByText('登录成功', { exact: true })).toBeHidden();
    await page.screenshot({
      animations: 'disabled',
      path: info.outputPath(`my-sites-${width}.png`),
      fullPage: false,
    });
    await page
      .getByRole('article')
      .first()
      .getByRole('button', { name: '进入代理网站' })
      .click();
    await expect(page.getByRole('heading', { name: '授权网站' })).toBeVisible();
    expect(state.grants).toBe(1);
  });
}

test('手机网站管理：维护、失败重试、改名及验证码登录', async ({
  page,
}, info) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 360, height: 800 });
  const state = await fixture(page, true);
  const card = page.getByRole('article');
  await expect(card).toBeVisible();
  await expectNoOverflow(page);
  for (const name of [
    '维护',
    '后台登录',
    '分配用户',
    '改名',
    '复制 Cookie',
    '删除',
  ]) {
    await expect(card.getByRole('button', { name, exact: true })).toBeVisible();
  }
  await expect(page.getByText('登录成功', { exact: true })).toBeHidden();
  await page.screenshot({
    animations: 'disabled',
    path: info.outputPath('sites-mobile.png'),
    fullPage: true,
  });
  await card.getByRole('button', { name: '维护', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expectNoOverflow(page);
  await dialog.getByPlaceholder('别名，如cdn').fill('mobile-cdn');
  await expect(dialog.getByRole('button', { name: /确.*定/ })).toBeInViewport();
  await expect(page.getByText('登录成功', { exact: true })).toBeHidden();
  await page.screenshot({
    animations: 'disabled',
    path: info.outputPath('site-modal-mobile.png'),
    fullPage: true,
  });
  await dialog.getByRole('button', { name: /确.*定/ }).click();
  await expect(
    page.getByText('配置已变化，请重试', { exact: true }),
  ).toBeVisible();
  await expect(dialog.getByPlaceholder('别名，如cdn')).toHaveValue(
    'mobile-cdn',
  );
  await dialog.getByRole('button', { name: /确.*定/ }).click();
  await expect(dialog).toBeHidden();
  expect(state.saved).toBe(true);
  await card.getByRole('button', { name: '改名', exact: true }).click();
  await dialog.getByPlaceholder('输入网站显示名称').fill('手机运营网站');
  await expectNoOverflow(page);
  await dialog.getByRole('button', { name: /确.*定/ }).click();
  await expect(card).toContainText('手机运营网站');
  await page
    .getByRole('button', { name: '快速新增 DataEye', exact: true })
    .click();
  await dialog.getByPlaceholder('输入DataEye账号').fill('手机账号');
  await dialog.getByPlaceholder('输入DataEye密码').fill('fixture-password');
  await expectNoOverflow(page);
  await dialog
    .getByRole('button', { name: '保存并获取验证码', exact: true })
    .click();
  await expect(dialog.getByPlaceholder('输入图片验证码')).toBeVisible();
  await expectNoOverflow(page);
  await dialog.getByPlaceholder('输入图片验证码').fill('1234');
  await expect(page.getByText('登录成功', { exact: true })).toBeHidden();
  await page.screenshot({
    animations: 'disabled',
    path: info.outputPath('login-modal-mobile.png'),
    fullPage: true,
  });
  await dialog
    .getByRole('button', { name: '登录并保存Cookie', exact: true })
    .click();
  await expect(
    dialog.getByText('登录成功，Cookie已保存', { exact: true }),
  ).toBeVisible();
  expect(state.submitted).toBe(true);
});

async function fulfill(route: Route, result: unknown, code = 200, msg = 'ok') {
  const body = JSON.stringify({ code, msg, result });
  await route.fulfill({
    contentType: 'application/json',
    body:
      route.request().headers().security === 'true'
        ? Buffer.from(KxEd.encryptText(body))
        : body,
  });
}
