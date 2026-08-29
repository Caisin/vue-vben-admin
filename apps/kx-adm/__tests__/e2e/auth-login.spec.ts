import { expect, test } from '@playwright/test';

import { authLogin } from './common/auth';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test.describe('Auth Login Page Tests', () => {
  test('check title and page elements', async ({ page }) => {
    // RES 产品使用独立后台标题，不沿用 Vben 默认标题。
    const title = await page.title();
    expect(title).toContain('文明新田管理后台');
  });

  // 测试用例: 登录表单可交互
  test('should render interactive login form', async ({ page }) => {
    await authLogin(page);
  });
});
