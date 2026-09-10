import { Buffer } from 'node:buffer';

import { KxEd } from '@kx/admin-core';
import { expect, test } from '@playwright/test';

test.use({ headless: true, actionTimeout: 10_000 });
test('短信分组关键词保存、重开、任意命中和清空', async ({ page }) => {
  test.setTimeout(90_000);
  let filter = { mode: 'any', keywords: [] as string[] };
  let saves = 0;
  await page.context().route('**/{auth,msg,notify,param}/**', async (route) => {
    const request = route.request();
    if (!['fetch', 'xhr'].includes(request.resourceType()))
      return route.continue();
    const path = new URL(request.url()).pathname.replace(/^\/api(?=\/)/, '');
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
        name: '分组管理员',
        enabled: true,
        home_path: '/msg/phone-groups',
        avatar: '',
        is_guest: false,
      };
    else if (path === '/auth/per/codes') result = ['phone_groups:manage'];
    else if (path.startsWith('/auth/user/tz')) result = 'UTC';
    else if (path === '/auth/menu/current')
      result = [
        {
          id: 1,
          pid: 0,
          name: 'MsgPhoneGroups',
          title: '号码分组',
          path: '/msg/phone-groups',
          component: '/msg/phone-groups/list',
          perm_type: 'menu',
          enabled: true,
          order_no: 1,
          meta: {},
        },
      ];
    else if (path === '/notify/inbox') result = { items: [], unread_count: 0 };
    else if (path === '/msg/phone-groups')
      result = {
        items: [
          {
            id: 1,
            grp_code: 'ops',
            grp_name: '验证码组',
            enabled: true,
            order_no: 1,
            remark: '',
            sim_count: 1,
            user_count: 1,
            notification_channel_count: 1,
          },
        ],
        total: 1,
      };
    else if (path === '/msg/phone-groups/1/notification-channels') {
      if (request.method() === 'PUT') {
        const bytes = request.postDataBuffer();
        let bodyText = '{}';
        if (bytes)
          bodyText =
            request.headers().security === 'true'
              ? KxEd.decryptText(bytes)
              : bytes.toString();
        const body = JSON.parse(bodyText);
        filter = body.filter;
        saves++;
      }
      result = {
        channel_ids: [10],
        options: [
          {
            channel_id: 10,
            channel_name: '业务钉钉群',
            channel_type: 'dingtalk_custom_robot',
            channel_code: 'test',
          },
        ],
        filter,
      };
    }
    const text = JSON.stringify({ code: 200, msg: 'ok', result });
    await route.fulfill({
      contentType: 'application/json',
      body:
        request.headers().security === 'true'
          ? Buffer.from(KxEd.encryptText(text))
          : text,
    });
  });
  await page.goto('/');
  await page.locator("input[name='username']").fill('group-test');
  await page.locator("input[name='password']").fill('test-only');
  await page.getByRole('button', { name: /登录|login/i }).click();
  await page.getByText('1 个群', { exact: true }).click();
  const panel = page.getByRole('dialog');
  const keywords = panel.locator('textarea');
  await expect(keywords).toHaveValue('');
  await keywords.fill(' 登录 \n验证码\n验证码\n');
  await panel.getByText('任意关键词命中即可转发', { exact: true }).click();
  await page
    .locator('.ant-select-item-option')
    .filter({ hasText: '全部关键词同时命中才转发' })
    .click();
  // 刷新通道选项不应覆盖正在编辑的关键词。
  await panel.getByRole('button', { name: /刷新/ }).click();
  await expect(keywords).toHaveValue(' 登录 \n验证码\n验证码\n');
  await panel.getByRole('button', { name: /保\s*存/ }).click();
  await expect(panel).toBeHidden();
  expect(filter).toEqual({ mode: 'all', keywords: ['登录', '验证码'] });
  await page.getByText('1 个群', { exact: true }).click();
  await expect(keywords).toHaveValue('登录\n验证码');
  await expect(
    panel.getByText('全部关键词同时命中才转发', { exact: true }),
  ).toBeVisible();
  await panel.getByText('全部关键词同时命中才转发', { exact: true }).click();
  await page
    .locator('.ant-select-item-option')
    .filter({ hasText: '任意关键词命中即可转发' })
    .click();
  await panel.getByRole('button', { name: /保\s*存/ }).click();
  await expect(panel).toBeHidden();
  expect(filter.mode).toBe('any');
  await page.getByText('1 个群', { exact: true }).click();
  await keywords.fill('');
  await panel.getByRole('button', { name: /保\s*存/ }).click();
  await expect(panel).toBeHidden();
  expect(filter.keywords).toEqual([]);
  expect(saves).toBe(3);
  await page.getByText('1 个群', { exact: true }).click();
  await expect(keywords).toHaveValue('');
  await page.screenshot({
    path: '/tmp/msg-keyword-config.png',
    fullPage: true,
  });
});
