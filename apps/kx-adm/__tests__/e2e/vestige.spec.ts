import type { Page } from '@playwright/test';

import { readFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';

interface Fixture {
  server_url: string;
  username: string;
  reader_username: string;
  password: string;
}
const fixtureFile = process.env.VESTIGE_WEB_FIXTURE_FILE;
const fixture: Fixture | undefined = fixtureFile
  ? JSON.parse(readFileSync(fixtureFile, 'utf8'))
  : undefined;
test.skip(
  !fixture,
  'requires the isolated KX task_runtime VESTIGE_WEB_FIXTURE_FILE fixture',
);

async function login(page: Page, username: string, password: string) {
  await page.goto('/auth/login');
  await page.getByPlaceholder(/用户名|账号/).fill(username);
  await page.getByPlaceholder('密码', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'login', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '新建角色', exact: true }),
  ).toBeVisible();
}
async function closeDialog(page: Page, title: string) {
  const dialog = page.getByRole('dialog', { name: title, exact: true });
  await dialog.getByRole('button', { name: /close|关闭/i }).click();
  await expect(dialog).toBeHidden();
}
async function finishTask(page: Page, title: string) {
  const dialog = page.getByRole('dialog', { name: title, exact: true });
  await expect(dialog.getByText('已完成', { exact: true })).toBeVisible();
  await closeDialog(page, title);
}
async function pickMember(page: Page, keyword = 'fixture-2', name = keyword) {
  const picker = page.getByRole('dialog', {
    name: '选择协作成员',
    exact: true,
  });
  await picker.getByRole('textbox', { name: '搜索协作成员' }).fill(keyword);
  await picker.getByRole('textbox', { name: '搜索协作成员' }).press('Enter');
  const row = picker.getByRole('row').filter({ hasText: name });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: '选择', exact: true }).click();
  await expect(picker).toBeHidden();
}
test('create, rename, share, revoke, copy, and enforce reader UI permissions against real KX', async ({
  page,
  browser,
  baseURL,
}) => {
  if (!fixture) throw new Error('fixture required');
  expect(new URL(fixture.server_url).hostname).toBe('127.0.0.1');
  expect(new URL(baseURL ?? '').hostname).toBe('127.0.0.1');
  const stamp = Date.now().toString(36);
  const name = `界面验收私人-${stamp}`;
  const renamed = `界面验收改名-${stamp}`;
  const copied = `界面验收副本-${stamp}`;
  await login(page, fixture.username, fixture.password);
  await page.getByRole('button', { name: '新建角色', exact: true }).click();
  const create = page.getByRole('dialog', {
    name: '新建记忆角色',
    exact: true,
  });
  await create.getByLabel('角色名称').fill(name);
  await create.getByRole('button', { name: '创建并准备' }).click();
  await finishTask(page, `${name} · 准备角色`);
  let detail = page.getByRole('dialog', { name, exact: true });
  await expect(detail.getByText('已就绪', { exact: true })).toBeVisible();
  await detail.getByRole('button', { name: '修改名称', exact: true }).click();
  const rename = page.getByRole('dialog', {
    name: '修改角色名称',
    exact: true,
  });
  await rename.getByRole('textbox', { name: '角色名称' }).fill(renamed);
  await rename.getByRole('button', { name: '保存名称', exact: true }).click();
  detail = page.getByRole('dialog', { name: renamed, exact: true });
  await expect(detail).toBeVisible();
  await detail.getByRole('tab', { name: '共享成员', exact: true }).click();
  await detail.getByRole('button', { name: '添加成员' }).click();
  await pickMember(page, 'fixture-collaborator', '未绑定组织的协作者');
  const grant = page.getByRole('dialog', { name: '设置共享权限', exact: true });
  await grant.getByRole('combobox', { name: '共享权限' }).click();
  await page
    .getByText('贡献：上传素材、提交候选和复习反馈', { exact: true })
    .click();
  await grant.getByRole('button', { name: '保存权限' }).click();
  const member = detail
    .getByRole('row')
    .filter({ hasText: '未绑定组织的协作者' });
  await expect(member.getByText('贡献者', { exact: true })).toBeVisible();
  await member.getByRole('button', { name: '撤销', exact: true }).click();
  await page.getByRole('button', { name: '撤销权限', exact: true }).click();
  await expect(member).toHaveCount(0);
  await closeDialog(page, renamed);
  await page.getByRole('button', { name: '资深编剧', exact: true }).click();
  const source = page.getByRole('dialog', { name: '资深编剧', exact: true });
  await source.getByRole('button', { name: '复制给公司成员' }).click();
  const copy = page.getByRole('dialog', {
    name: '复制成熟角色给公司成员',
    exact: true,
  });
  await copy.getByLabel('新角色名称').fill(copied);
  await copy.getByRole('button', { name: '选择成员', exact: true }).click();
  await pickMember(page);
  await copy.getByRole('button', { name: '提交复制任务' }).click();
  await finishTask(page, `${copied} · 复制角色`);
  await expect(
    page
      .getByRole('dialog', { name: copied, exact: true })
      .getByText('已就绪', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(`${copied} · 复制角色已完成`, { exact: true }),
  ).toBeHidden();
  await page.screenshot({
    path:
      process.env.VESTIGE_WORKBENCH_SCREENSHOT ??
      'node_modules/.e2e/vestige/workbench.png',
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileDetail = page.getByRole('dialog', { name: copied, exact: true });
  await expect
    .poll(async () => {
      const box = await mobileDetail.boundingBox();
      return !!box && box.x >= -1 && box.x + box.width <= 391;
    })
    .toBe(true);

  await expect(
    mobileDetail.getByRole('button', { name: '修改名称' }),
  ).toBeInViewport({ ratio: 1 });
  await expect(
    mobileDetail.getByRole('button', { name: /close|关闭/i }),
  ).toBeInViewport({ ratio: 1 });

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 2,
    ),
  ).toBe(true);
  if (process.env.VESTIGE_WORKBENCH_SCREENSHOT) {
    await page.screenshot({
      path: process.env.VESTIGE_WORKBENCH_SCREENSHOT.replace(
        /\.png$/,
        '-mobile.png',
      ),
      fullPage: true,
    });
  }
  const reader = await browser.newPage({ baseURL });
  await login(reader, fixture.reader_username, fixture.password);
  await expect(
    reader.getByRole('button', { name: renamed, exact: true }),
  ).toHaveCount(0);
  await expect(
    reader.getByRole('button', { name: copied, exact: true }),
  ).toHaveCount(0);
  await reader.getByRole('button', { name: '资深编剧', exact: true }).click();
  const readonly = reader.getByRole('dialog', {
    name: '资深编剧',
    exact: true,
  });
  await expect(
    readonly.getByText('只读成员', { exact: true }).first(),
  ).toBeVisible();
  await expect(readonly.getByRole('button', { name: '修改名称' })).toHaveCount(
    0,
  );
  await expect(
    readonly.getByRole('button', { name: '复制给公司成员' }),
  ).toHaveCount(0);
  await expect(readonly.getByRole('tab', { name: '共享成员' })).toHaveCount(0);
  await readonly.getByRole('tab', { name: '编剧培养', exact: true }).click();
  await expect(
    readonly.getByRole('button', { name: '上传剧本素材', exact: true }),
  ).toHaveCount(0);
  await expect(
    readonly.getByRole('button', { name: '提交提炼任务', exact: true }),
  ).toHaveCount(0);
  await readonly.getByRole('tab', { name: '调整与对话', exact: true }).click();
  await expect(
    readonly.getByRole('button', { name: '提交调整意见', exact: true }),
  ).toHaveCount(0);
  await readonly.getByRole('tab', { name: '规则版本', exact: true }).click();
  await readonly
    .getByRole('button', { name: '查看规则与证据' })
    .first()
    .click();
  await expect(
    reader.getByRole('button', { name: '采纳此候选', exact: true }),
  ).toHaveCount(0);
  await expect(
    reader.getByRole('button', { name: '以此历史规则回滚', exact: true }),
  ).toHaveCount(0);
  await reader.close();
});
