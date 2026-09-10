import { Buffer } from 'node:buffer';
import process from 'node:process';

import { KxEd } from '@kx/admin-core';
import { expect, test } from '@playwright/test';

test.use({ headless: true, actionTimeout: 10_000 });
test('生产hash路由登录后仍到授权页，challenge保持且可确认授权', async ({
  page,
}) => {
  test.skip(
    process.env.VITE_ROUTER_HISTORY !== 'hash',
    'Run with VITE_ROUTER_HISTORY=hash and an isolated PLAYWRIGHT_PORT',
  );
  test.setTimeout(60_000);
  const challenge = 'ab'.repeat(32);
  let approved = false;
  let loginCount = 0;
  await page
    .context()
    .route('**/{auth,cookie-manager,notify,param}/**', async (route) => {
      const req = route.request();
      if (!['fetch', 'xhr'].includes(req.resourceType()))
        return route.continue();
      const path = new URL(req.url()).pathname.replace(/^\/api(?=\/)/, '');
      let result: unknown = null;
      if (path === '/auth/user/access_token') {
        loginCount++;
        result = {
          access_token: 'hash-test-only',
          uid: 7,
          exp_at: 4_102_444_800,
          exp_in: 3600,
        };
      } else if (path === '/auth/user/user_info')
        result = {
          id: 7,
          name: '插件授权测试',
          enabled: true,
          home_path: '/user-overview',
          avatar: '',
          is_guest: false,
        };
      else if (path === '/auth/per/codes') result = [];
      else if (path.startsWith('/auth/user/tz')) result = 'UTC';
      else if (path === '/auth/menu/current')
        result = [
          {
            id: 1,
            pid: 0,
            name: 'CookiePlugin',
            title: '插件授权',
            path: '/cookie-manager/authorize',
            component: '/cookie-manager/authorize',
            perm_type: 'menu',
            enabled: true,
            order_no: 1,
            meta: {},
          },
        ];
      else if (path === '/notify/inbox')
        result = { items: [], unread_count: 0 };
      else if (path === '/cookie-manager/sessions') result = [];
      else if (path === '/cookie-manager/sessions/authorize') {
        const bytes = req.postDataBuffer();
        if (!bytes) throw new Error('missing authorization body');
        expect(JSON.parse(KxEd.decryptText(bytes)).challenge).toBe(challenge);
        approved = true;
        result = {
          id: 1,
          uid: 7,
          expires_at: 4_102_444_800,
          created_at: 1,
          revoked: false,
        };
      }
      const text = JSON.stringify({ code: 200, msg: 'ok', result });
      await route.fulfill({
        contentType: 'application/json',
        body:
          req.headers().security === 'true'
            ? Buffer.from(KxEd.encryptText(text))
            : text,
      });
    });
  await page.goto(`/#/cookie-manager/authorize?challenge=${challenge}`);
  await page.locator("input[name='username']").fill('cookie-user');
  await page.locator("input[name='password']").fill('test-only');
  await page.getByRole('button', { name: /登录|login/i }).click();
  await expect(
    page.getByRole('heading', { name: 'Cookie 插件授权', exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(
    new RegExp(`/#/cookie-manager/authorize\\?challenge=${challenge}$`),
  );
  expect(loginCount).toBe(1);
  // 已有登录态再次从插件进入时，也不能被首页覆盖。
  await page.goto(`/#/cookie-manager/authorize?challenge=${challenge}`);
  await expect(
    page.getByRole('button', { name: '确认授权此插件', exact: true }),
  ).toBeVisible();
  expect(loginCount).toBe(1);
  await page
    .getByRole('button', { name: '确认授权此插件', exact: true })
    .click();
  await expect(
    page.getByText('授权完成，请回到插件点击“已授权，刷新网站”。'),
  ).toBeVisible();
  expect(approved).toBe(true);
  await expect(page).toHaveURL(/\/#\/cookie-manager\/authorize$/);
});
