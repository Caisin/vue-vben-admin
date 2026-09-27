import { readFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';

const fixtureFile = process.env.VESTIGE_WEB_FIXTURE_FILE;
const fixture:
  | undefined
  | { username: string; reader_username: string; password: string } =
  fixtureFile ? JSON.parse(readFileSync(fixtureFile, 'utf8')) : undefined;
test.skip(!fixture, 'requires isolated KX and a verified loaded Qwen profile');
test('install and evaluate a role model, reload persisted results, and enforce reader controls', async ({
  page,
  browser,
  baseURL,
}) => {
  if (!fixture) throw new Error('fixture required');
  const login = async (target: typeof page, username: string) => {
    await target.goto('/auth/login');
    await target.getByPlaceholder(/用户名|账号/).fill(username);
    await target
      .getByPlaceholder('密码', { exact: true })
      .fill(fixture.password);
    await target.getByRole('button', { name: 'login', exact: true }).click();
    await expect(
      target.getByRole('button', { name: '新建角色', exact: true }),
    ).toBeVisible();
  };
  await page.setViewportSize({ width: 1440, height: 1100 });
  await login(page, fixture.username);
  const name = `模型验证-${Date.now().toString(36)}`;
  await page.getByRole('button', { name: '新建角色', exact: true }).click();
  const create = page.getByRole('dialog', {
    name: '新建记忆角色',
    exact: true,
  });
  await create.getByLabel('角色名称').fill(name);
  await create.getByRole('button', { name: '创建并准备' }).click();
  const task = page.getByRole('dialog', {
    name: `${name} · 准备角色`,
    exact: true,
  });
  await expect(task.getByText('已完成', { exact: true })).toBeVisible();
  await task.getByRole('button', { name: /关闭|close/i }).click();
  const detail = page.getByRole('dialog', { name, exact: true });
  await detail.getByRole('tab', { name: '记忆模型', exact: true }).click();
  const model = detail
    .getByRole('row')
    .filter({ hasText: 'qwen3-0.6b-retrieval-v1-256' });
  await expect(
    model.getByRole('button', { name: '安装到角色', exact: true }),
  ).toBeVisible();
  const active = await detail
    .getByRole('heading', { name: /^当前使用：/ })
    .textContent();
  await model.getByRole('button', { name: '安装到角色', exact: true }).click();
  await expect(
    model.getByRole('button', { name: '兼容性评估', exact: true }),
  ).toBeVisible();
  await model.getByRole('button', { name: '兼容性评估', exact: true }).click();
  await expect(detail.getByText(/公开样例 15 条/)).toBeVisible({
    timeout: 90_000,
  });
  await expect(model.getByText('评估完成', { exact: true })).toBeVisible();
  await model
    .getByRole('button', { name: '迁移角色语料', exact: true })
    .click();
  await expect(
    model.getByRole('button', { name: '激活此模型', exact: true }),
  ).toBeEnabled({ timeout: 60_000 });
  expect(
    await detail.getByRole('heading', { name: /^当前使用：/ }).textContent(),
  ).toBe(active);
  await model.getByRole('button', { name: '激活此模型', exact: true }).click();
  const confirm = page.getByRole('dialog', {
    name: '确认激活角色模型',
    exact: true,
  });
  await expect(confirm).toBeVisible();
  await confirm.getByRole('button', { name: '确认激活', exact: true }).click();
  await expect(model.getByText('使用中', { exact: true })).toBeVisible();

  expect(
    await detail.getByRole('heading', { name: /^当前使用：/ }).textContent(),
  ).not.toBe(active);
  await page.reload();
  await page.getByRole('button', { name, exact: true }).click();
  await detail.getByRole('tab', { name: '记忆模型', exact: true }).click();
  await expect(detail.getByText(/公开样例 15 条/)).toBeVisible();
  await expect(model.getByText('使用中', { exact: true })).toBeVisible();
  await expect(page.getByText(/未找到.*请求的资源不存在/)).toHaveCount(0);
  if (process.env.VESTIGE_MODELS_SCREENSHOT)
    await page.screenshot({
      path: process.env.VESTIGE_MODELS_SCREENSHOT,
      fullPage: true,
    });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(async () => {
      const box = await detail.boundingBox();
      return !!box && box.x >= -1 && box.x + box.width <= 391;
    })
    .toBe(true);
  await expect
    .poll(() =>
      detail.locator('.model-panel').evaluate((panel) => {
        const bounds = panel.getBoundingClientRect();
        return [...panel.children].every(
          (child) => child.getBoundingClientRect().right <= bounds.right + 2,
        );
      }),
    )
    .toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 2,
    ),
  ).toBe(true);
  if (process.env.VESTIGE_MODELS_SCREENSHOT)
    await page.screenshot({
      path: process.env.VESTIGE_MODELS_SCREENSHOT.replace(
        /\.png$/,
        '-mobile.png',
      ),
      fullPage: true,
    });
  const reader = await browser.newPage({ baseURL });
  await login(reader, fixture.reader_username);
  await reader.getByRole('button', { name: '资深编剧', exact: true }).click();
  const shared = reader.getByRole('dialog', { name: '资深编剧', exact: true });
  await shared.getByRole('tab', { name: '记忆模型', exact: true }).click();
  await expect(shared.getByText('只读', { exact: true }).first()).toBeVisible();
  await expect(
    shared.getByRole('button', { name: '安装到角色', exact: true }),
  ).toHaveCount(0);
  await expect(
    shared.getByRole('button', { name: '兼容性评估', exact: true }),
  ).toHaveCount(0);
  await reader.close();
});
