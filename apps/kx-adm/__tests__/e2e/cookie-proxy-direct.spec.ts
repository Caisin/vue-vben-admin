import { Buffer } from 'node:buffer';

import { KxEd } from '@kx/admin-core';
import { expect, test } from '@playwright/test';

test.use({ headless: true });
test('异步签发票据后网页预留窗口进入代理且不误报弹窗阻止', async ({ page }) => {
  let grants = 0;
  await page
    .context()
    .route('**/{auth,cookie-manager,notify,param}/**', async (route) => {
      const request = route.request();
      if (!['fetch', 'xhr'].includes(request.resourceType()))
        return route.continue();
      const path = new URL(request.url()).pathname.replace(/^\/api(?=\/)/, '');
      let result: unknown = [];
      if (path === '/auth/user/access_token')
        result = {
          access_token: 'fixture',
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
        };
      else if (path.startsWith('/auth/user/tz')) result = 'Asia/Shanghai';
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
            proxy_url: 'https://site-1.proxy.example.test/_kx/login',
          },
        ];
      else if (path === '/cookie-manager/proxy/grant-direct') {
        const body = JSON.parse(
          KxEd.decryptText(request.postDataBuffer() as Buffer),
        );
        expect(String(body.site_id)).toBe('1');
        grants++;
        await new Promise((resolve) => setTimeout(resolve, 100));
        result = {
          url: 'https://site-1.proxy.example.test/_kx/complete?ticket=fixture&proof=fixture',
        };
      }
      const body = JSON.stringify({ code: 200, msg: 'ok', result });
      await route.fulfill({
        contentType: 'application/json',
        body:
          request.headers().security === 'true'
            ? Buffer.from(KxEd.encryptText(body))
            : body,
      });
    });
  await page.context().route('https://site-1.proxy.example.test/**', (route) =>
    route.fulfill({
      contentType: 'text/html; charset=utf-8',
      body: '<h1>已进入代理网站</h1>',
    }),
  );
  await page.goto('/');
  await page.locator("input[name='username']").fill('admin');
  await page.locator("input[name='password']").fill('123456');
  await page.getByRole('button', { name: /登录|login/i }).click();
  await expect(
    page.getByRole('button', { name: '进入代理网站', exact: true }),
  ).toBeVisible();
  const opened = page.waitForEvent('popup');
  await page.getByRole('button', { name: '进入代理网站', exact: true }).click();
  const popup = await opened;
  await expect(
    popup.getByRole('heading', { name: '已进入代理网站' }),
  ).toBeVisible();
  expect(await popup.evaluate(() => window.opener === null)).toBe(true);
  expect(grants).toBe(1);
  await expect(page).not.toHaveURL(/_kx\/complete/);
  await expect(
    page.getByText('浏览器阻止了新窗口', { exact: false }),
  ).toHaveCount(0);
  await popup.close();
});
