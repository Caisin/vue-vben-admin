import { Buffer } from 'node:buffer';

import { KxEd } from '@kx/admin-core';
import { expect, test } from '@playwright/test';
test.use({ headless: true, actionTimeout: 10_000 });
test('Cookie多账号配置、验证码登录与插件授权撤销', async ({ page }) => {
  test.setTimeout(90_000);
  const now = Math.floor(Date.now() / 1000);
  let loggedIn = false;
  let loginError = '';
  let loginAttempts = 0;
  let authorized = false;
  let revoked = false;
  let saved = false;
  let assignmentVersion = 1;
  let assignedIds = [7];
  const cookie = {
    name: 'test_cookie',
    domain: 'dataeye.com',
    path: '/',
    secure: true,
    http_only: true,
    same_site: 'lax',
    expires_at: now + 3600,
  };
  const sites = [1, 2].map((id) => ({
    id,
    name: 'DataEye',
    origin: 'https://adxray-app.dataeye.com',
    account_label: `账号${id}`,
    credential_code: 'test-login',
    cookies: [cookie],
    allowed_uids: [7],
    enabled: true,
    warning_hours: 72,
    version: 1,
    refreshed_at: now,
    status: 'expiring',
    expires_at: now + 3600,
  }));
  const session = () => ({
    id: 1,
    uid: 7,
    expires_at: now + 43_200,
    created_at: now,
    revoked,
  });
  const loginState = () => (loggedIn ? 'succeeded' : 'captcha_ready');
  const login = () => ({
    id: 11,
    site_id: 1,
    state: loginError ? 'failed' : loginState(),
    expires_at: now + 600,
    error_message: loginError,
    captcha_data_url: loggedIn
      ? null
      : 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jfZkAAAAASUVORK5CYII=',
  });
  await page
    .context()
    .route(
      '**/{auth,cookie-manager,credential,notify,param}/**',
      async (route) => {
        const req = route.request();
        if (!['fetch', 'xhr'].includes(req.resourceType()))
          return route.continue();
        const path = new URL(req.url()).pathname.replace(/^\/api(?=\/)/, '');
        let result: unknown = null;
        if (path === '/auth/user/access_token')
          result = {
            access_token: 'test-only',
            uid: 7,
            exp_at: 4_102_444_800,
            exp_in: 3600,
          };
        else if (path === '/auth/user/user_info')
          result = {
            id: 7,
            name: 'Cookie管理员',
            enabled: true,
            home_path: '/cookie-manager/sites',
            avatar: '',
            is_guest: false,
          };
        else if (path === '/auth/per/codes')
          result = [
            'cookie-manager:manage',
            'cookie-manager:login',
            'cookie-manager:assign',
          ];
        else if (path.startsWith('/auth/user/tz')) result = 'UTC';
        else if (path === '/auth/menu/current')
          result = ['sites', 'authorize', 'audits', 'assignments'].map(
            (name, i) => ({
              id: i + 1,
              pid: 0,
              name: `Cookie${name}`,
              title: ['网站Cookie', '插件授权', 'Cookie审计', '使用用户分配'][
                i
              ],
              path: `/cookie-manager/${name}`,
              component: `/cookie-manager/${name}`,
              perm_type: 'menu',
              enabled: true,
              order_no: i,
              meta: {},
            }),
          );
        else if (path === '/auth/user-admin')
          result = {
            items: [
              { id: 7, name: '测试使用人', enabled: true },
              { id: 8, name: '新使用者', enabled: true },
            ],
            total: 1,
          };
        else if (path === '/notify/inbox')
          result = { items: [], unread_count: 0 };
        else if (path === '/cookie-manager/sites/quick-dataeye') {
          loggedIn = false;
          const bytes = req.postDataBuffer();
          if (!bytes) throw new Error('missing request body');
          const body = JSON.parse(KxEd.decryptText(bytes));
          expect(body.username).toBe('快速账号');
          expect(body.password).toBe('fixture-password');
          result = { ...sites[0], account_label: body.username };
        } else if (path === '/cookie-manager/sites/1/assignments') {
          if (req.method() === 'PUT') {
            const bytes = req.postDataBuffer();
            if (!bytes) throw new Error('missing body');
            const body = JSON.parse(KxEd.decryptText(bytes));
            expect(Number(body.expected_version)).toBe(assignmentVersion);
            const removed = new Set((body.remove_uids || []).map(Number));
            assignedIds = [
              ...new Set([
                ...assignedIds,
                ...(body.add_uids || []).map(Number),
              ]),
            ].filter((id) => !removed.has(id));
            result = ++assignmentVersion;
          } else {
            const keyword =
              new URL(req.url()).searchParams.get('keyword') || '';
            const items = assignedIds
              .map((uid) => ({
                uid,
                name: uid === 7 ? '测试使用人' : '新使用者',
                enabled: true,
                exists: true,
              }))
              .filter(
                (u) =>
                  u.name.includes(keyword) || String(u.uid).includes(keyword),
              );
            result = { items, total: items.length, version: assignmentVersion };
          }
        } else if (path === '/cookie-manager/sites')
          result = { items: sites, total: 2 };
        else if (path === '/cookie-manager/sites/1' && req.method() === 'PUT') {
          saved = true;
          result = sites[0];
        } else if (path === '/cookie-manager/preview') result = [cookie];
        else if (path.includes('/credential/items/all'))
          result = [
            {
              code: 'test-login',
              name: '网站账号凭证',
              kind: 'username_password',
              profile: 'generic',
              state: 'active',
              summary: {},
            },
          ];
        else if (path === '/cookie-manager/sites/1/login') {
          loginError = '';
          result = {
            ...login(),
            state: 'queued_captcha',
            captcha_data_url: null,
          };
        } else if (path === '/cookie-manager/logins/11') result = login();
        else if (path === '/cookie-manager/logins/11/submit') {
          const bytes = req.postDataBuffer();
          const text = bytes ? KxEd.decryptText(bytes) : '{}';
          expect(JSON.parse(text).code).toBe('1234');
          loginAttempts++;
          loggedIn = loginAttempts > 1;
          loginError = loggedIn
            ? ''
            : 'dataeye_login_rejected: HTTP 200; statusCode=412; 验证码错误，请重新获取';
          result = login();
        } else if (path === '/cookie-manager/sessions/authorize') {
          authorized = true;
          result = session();
        } else if (path === '/cookie-manager/sessions')
          result = authorized ? [session()] : [];
        else if (
          path === '/cookie-manager/sessions/1' &&
          req.method() === 'DELETE'
        ) {
          revoked = true;
          result = true;
        }
        const text = JSON.stringify({ code: 200, msg: 'ok', result });
        await route.fulfill({
          contentType: 'application/json',
          body:
            req.headers().security === 'true'
              ? Buffer.from(KxEd.encryptText(text))
              : text,
        });
      },
    );
  await page.goto('/');
  await page.locator("input[name='username']").fill('cookie-admin');
  await page.locator("input[name='password']").fill('test-only');
  await page.getByRole('button', { name: /登录|login/i }).click();
  const first = page
    .getByRole('row')
    .filter({ has: page.getByRole('cell', { name: '账号1', exact: true }) });
  await expect(first).toBeVisible();
  await expect(
    page.getByRole('cell', { name: '账号2', exact: true }),
  ).toBeVisible();
  await first.getByRole('button', { name: /维\s*护/ }).click();
  const modal = page.getByRole('dialog');
  await expect(modal.locator('textarea')).toHaveValue('');
  await modal
    .locator('textarea')
    .fill(
      'test_cookie=fixture-only; Max-Age=3600; Domain=dataeye.com; Path=/; Secure',
    );
  await modal.getByRole('button', { name: '解析属性' }).click();
  await expect(
    modal.getByRole('cell', { name: 'test_cookie', exact: true }),
  ).toBeVisible();
  await modal.getByRole('button', { name: /确\s*定/ }).click();
  await expect(modal).toBeHidden();
  expect(saved).toBe(true);
  await first.getByRole('button', { name: '后台登录' }).click();
  await expect(
    modal.getByRole('img', { name: '网站登录验证码' }),
  ).toBeVisible();
  await modal.getByPlaceholder('输入图片验证码').fill('1234');
  await modal.getByRole('button', { name: '登录并保存Cookie' }).click();
  await expect(modal.getByText(/验证码错误，请重新获取/)).toBeVisible();
  expect(loggedIn).toBe(false);
  await expect(
    modal.getByText('登录成功，Cookie已保存', { exact: true }),
  ).toBeHidden();
  await modal.getByRole('button', { name: '重新获取验证码' }).click();
  await expect(modal.getByPlaceholder('输入图片验证码')).toBeVisible();
  await modal.getByPlaceholder('输入图片验证码').fill('1234');
  await modal.getByRole('button', { name: '登录并保存Cookie' }).click();
  await expect(
    modal.getByText('登录成功，Cookie已保存', { exact: true }),
  ).toBeVisible();
  expect(loggedIn).toBe(true);
  await modal.getByRole('button', { name: /关闭/ }).click();
  await page
    .getByRole('button', { name: '快速新增 DataEye', exact: true })
    .click();
  await modal.getByPlaceholder('输入DataEye账号').fill('快速账号');
  await modal.getByPlaceholder('输入DataEye密码').fill('fixture-password');
  await expect(
    modal.getByPlaceholder('https://adxray-app.dataeye.com'),
  ).toHaveCount(0);
  await modal.getByRole('button', { name: '保存并获取验证码' }).click();
  await expect(
    modal.getByRole('img', { name: '网站登录验证码' }),
  ).toBeVisible();
  await page
    .getByRole('dialog', { name: 'DataEye · 快速账号 后台登录', exact: true })
    .getByRole('button', { name: '关闭', exact: true })
    .click();
  await page.goto('/cookie-manager/assignments?site_id=1');
  await expect(
    page.getByRole('cell', { name: '测试使用人', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '添加使用用户', exact: true }).click();
  await modal
    .getByRole('row')
    .filter({ hasText: '新使用者' })
    .getByRole('checkbox')
    .check();
  await modal
    .getByRole('button', { name: '添加所选用户', exact: true })
    .click();
  await expect(modal).toBeHidden();
  await expect(
    page.getByRole('cell', { name: '新使用者', exact: true }),
  ).toBeVisible();
  expect(assignedIds).toEqual([7, 8]);
  await page.getByPlaceholder('搜索已分配用户姓名或ID').fill('新使用者');
  await page.getByPlaceholder('搜索已分配用户姓名或ID').press('Enter');
  await expect(
    page.getByRole('cell', { name: '测试使用人', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: '撤销分配', exact: true }).click();
  await page.getByRole('button', { name: /确\s*定/ }).click();
  await expect(
    page.getByRole('cell', { name: '新使用者', exact: true }),
  ).toHaveCount(0);
  expect(assignedIds).toEqual([7]);
  await page.goto(`/cookie-manager/authorize?challenge=${'ab'.repeat(32)}`);
  await page.getByRole('button', { name: '确认授权此插件' }).click();
  await expect(
    page.getByText('授权完成，请回到插件点击“已授权，刷新网站”。'),
  ).toBeVisible();
  expect(authorized).toBe(true);
  await page.getByRole('button', { name: /撤\s*销/ }).click();
  await page.getByRole('button', { name: /确\s*定/ }).click();
  await expect(page.getByText('已撤销', { exact: true })).toBeVisible();
  expect(revoked).toBe(true);
});

test('Cookie使用者只看自己的授权并在撤销后刷新消失', async ({ page }) => {
  test.setTimeout(60_000);
  let revoked = false;
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
          access_token: 'test-user-only',
          uid: 8,
          exp_at: 4_102_444_800,
          exp_in: 3600,
        };
      else if (path === '/auth/user/user_info')
        result = {
          id: 8,
          name: 'Cookie使用者',
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
        result = revoked
          ? []
          : [
              {
                id: 1,
                name: 'DataEye',
                account_label: '分配给我的账号',
                origin: 'https://adxray-app.dataeye.com',
                status: 'active',
                expires_at: 4_102_444_800,
              },
            ];
      const text = JSON.stringify({ code: 200, msg: 'ok', result });
      await route.fulfill({
        contentType: 'application/json',
        body:
          req.headers().security === 'true'
            ? Buffer.from(KxEd.encryptText(text))
            : text,
      });
    });
  await page.goto('/');
  await page.locator("input[name='username']").fill('cookie-user');
  await page.locator("input[name='password']").fill('test-only');
  await page.getByRole('button', { name: /登录|login/i }).click();
  await expect(
    page.getByRole('heading', { name: '我的网站授权', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('cell', { name: '分配给我的账号', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '新增网站账号', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: '添加使用用户', exact: true }),
  ).toHaveCount(0);
  revoked = true;
  await page.getByRole('button', { name: '刷新授权', exact: true }).click();
  await expect(
    page.getByText('暂无授权网站，请联系管理员分配', { exact: true }),
  ).toBeVisible();
});
