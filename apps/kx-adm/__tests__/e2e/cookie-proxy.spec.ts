import { Buffer } from 'node:buffer';

import { KxEd } from '@kx/admin-core';
import { expect, test } from '@playwright/test';

test('代理入口要求系统登录并确认已授权网站账号，票据只放fragment', async ({
  page,
}) => {
  const challenge = 'ab'.repeat(32);
  let grantCount = 0;
  await page
    .context()
    .route('**/{auth,cookie-manager,notify,param}/**', async (route) => {
      const req = route.request();
      if (!['fetch', 'xhr'].includes(req.resourceType()))
        return route.continue();
      const path = new URL(req.url()).pathname.replace(/^\/api(?=\/)/, '');
      let result: unknown = null;
      if (path === '/auth/user/access_token')
        result = {
          access_token: 'fixture-token',
          uid: 7,
          exp_at: 4_102_444_800,
          exp_in: 3600,
        };
      else if (path === '/auth/user/user_info')
        result = {
          id: 7,
          name: '网站使用者',
          enabled: true,
          home_path: '/cookie-manager/my-sites',
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
            name: 'CookieMySites',
            title: '我的网站授权',
            path: '/cookie-manager/my-sites',
            component: '/cookie-manager/my-sites',
            perm_type: 'menu',
            enabled: true,
            order_no: 1,
            meta: {},
          },
        ];
      else if (path === '/notify/inbox')
        result = { items: [], unread_count: 0 };
      else if (path === '/cookie-manager/my-sites')
        result = [
          {
            id: 1,
            name: '运营网站',
            account_label: '授权账号A',
            origin: 'https://adxray-app.dataeye.com',
            status: 'active',
            expires_at: 4_102_444_800,
            proxy_enabled: true,
            proxy_url: 'https://adx.proxy.example.test/_kx/login',
          },
        ];
      else if (path === '/cookie-manager/proxy/grant') {
        const bytes = req.postDataBuffer();
        if (!bytes) throw new Error('missing grant');
        const body = JSON.parse(KxEd.decryptText(bytes));
        expect(String(body.site_id)).toBe('1');
        expect(body.challenge).toBe(challenge);
        grantCount++;
        result = {
          url: 'https://adx.proxy.example.test/_kx/complete#ticket=fixture-ticket',
        };
      }
      const body = JSON.stringify({ code: 200, msg: 'ok', result });
      await route.fulfill({
        contentType: 'application/json',
        body:
          req.headers().security === 'true'
            ? Buffer.from(KxEd.encryptText(body))
            : body,
      });
    });
  await page.context().route('https://adx.proxy.example.test/**', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<h1>代理票据入口</h1>',
    }),
  );
  await page.goto(
    `/cookie-manager/my-sites?proxy_challenge=${challenge}&proxy_site_id=1`,
  );
  await page.locator("input[name='username']").fill('fixture-user');
  await page.locator("input[name='password']").fill('fixture-password');
  await page.getByRole('button', { name: /登录|login/i }).click();
  await expect(
    page.getByRole('cell', { name: '授权账号A', exact: true }),
  ).toBeVisible();
  expect(grantCount).toBe(0);
  await page
    .getByRole('button', { name: '确认并进入代理', exact: true })
    .click();
  await expect(page).toHaveURL(
    'https://adx.proxy.example.test/_kx/complete#ticket=fixture-ticket',
  );
  expect(new URL(page.url()).search).toBe('');
  expect(grantCount).toBe(1);
});
