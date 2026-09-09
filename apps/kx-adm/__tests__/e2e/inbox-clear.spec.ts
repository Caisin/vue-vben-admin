import { Buffer } from 'node:buffer';

import { KxEd } from '@kx/admin-core';
import { expect, test } from '@playwright/test';

test.use({ headless: true, actionTimeout: 10_000 });
test('清空消息后通知中心保持为空，新通知正常显示', async ({ page }) => {
  test.setTimeout(60_000);
  let entries = [
    {
      source_type: 'task_run',
      source_id: 1,
      title: '待清理任务',
      content: '测试通知',
      status: 'running',
      event_at: 1,
      read: false,
      link: null,
    },
  ];
  let clearCount = 0;
  await page.context().route('**/{auth,notify,param}/**', async (route) => {
    if (!['fetch', 'xhr'].includes(route.request().resourceType()))
      return route.continue();
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/api(?=\/)/, '');
    let result: unknown = {};
    if (path === '/auth/user/access_token')
      result = {
        access_token: 'test-only',
        token_type: 'Bearer',
        uid: 7,
        exp_at: 4_102_444_800,
        exp_in: 3600,
      };
    else if (path === '/auth/user/user_info')
      result = {
        id: 7,
        name: '收件箱测试',
        enabled: true,
        home_path: '/notifications',
        avatar: '',
        is_guest: false,
      };
    else if (path === '/auth/per/codes' || path === '/auth/menu/current')
      result = [];
    else if (path === '/notify/inbox' && request.method() === 'DELETE') {
      entries = [];
      clearCount++;
      result = { changed: true, updated_at: 2 };
    } else if (path === '/notify/inbox')
      result = { items: entries, unread_count: entries.length, server_time: 2 };
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
  await page.locator("input[name='username']").fill('inbox-user');
  await page.locator("input[name='password']").fill('test-only');
  await page.getByRole('button', { name: /登录|login/i }).click();
  await expect(
    page.getByRole('heading', { name: '待清理任务', exact: true }),
  ).toBeVisible();
  await page.locator('.bell-button').click();
  const popup = page.getByRole('dialog');
  await popup.getByRole('button', { name: '清空', exact: true }).click();
  await expect(page.getByText('暂无通知', { exact: true })).toBeVisible();
  expect(clearCount).toBe(1);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '刷新通知', exact: true }).click();
  await expect(page.getByText('待清理任务', { exact: true })).toHaveCount(0);
  entries = [
    {
      source_type: 'task_run',
      source_id: 2,
      title: '清空后的新任务',
      content: '新通知',
      status: 'running',
      event_at: 2,
      read: false,
      link: null,
    },
  ];
  await page.getByRole('button', { name: '刷新通知', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '清空后的新任务', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '清空', exact: true }).click();
  await page.getByRole('button', { name: '确认清空', exact: true }).click();
  await expect(page.getByText('暂无通知', { exact: true })).toBeVisible();
  expect(clearCount).toBe(2);
  await page.reload();
  await expect(page.getByText('暂无通知', { exact: true })).toBeVisible();
});
