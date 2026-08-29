import type { Page } from '@playwright/test';

import { expect } from '@playwright/test';

export async function authLogin(page: Page) {
  // 确保登录表单正常
  const usernameInput = await page.locator(`input[name='username']`);
  await expect(usernameInput).toBeVisible();
  await usernameInput.fill('admin');

  const passwordInput = await page.locator(`input[name='password']`);
  await expect(passwordInput).toBeVisible();
  await passwordInput.fill('123456');

  await expect(page.getByRole('button', { name: /登录|login/i })).toBeVisible();
}
