import type { Route } from '@playwright/test';

import { Buffer } from 'node:buffer';

import { KxEd } from '@kx/admin-core';
import { expect, test } from '@playwright/test';

test.use({ headless: true });
test('数据源可首次新增、再次编辑并测试 Databend 连接', async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  let saved = false;
  let updated = false;
  let probed = false;
  let removed = false;
  const row = () => ({
    ds_code: 'warehouse',
    name: updated ? '分析仓库已修改' : '分析仓库',
    db_type: 'databend',
    db_host: '127.0.0.1',
    port: 8000,
    db_name: 'analytics',
    user_name: 'databend',
    credential_code: 'db_secret',
    credential_configured: true,
    cur_schema: '',
    time_zone: '',
    state: true,
    remark: '',
    create_at: 1,
  });
  await page
    .context()
    .route('**/{auth,notify,param,adm,credential}/**', async (route) => {
      if (!['fetch', 'xhr'].includes(route.request().resourceType())) {
        await route.continue();
        return;
      }
      const path = new URL(route.request().url()).pathname.replace(
        /^\/api(?=\/)/,
        '',
      );
      const method = route.request().method();
      let result: unknown = null;
      if (path === '/auth/user/access_token')
        result = {
          access_token: 'test-token',
          token_type: 'Bearer',
          uid: 7,
          exp_at: 4_102_444_800,
          exp_in: 3600,
        };
      else if (path === '/auth/user/user_info')
        result = {
          id: 7,
          name: '数据源管理员',
          enabled: true,
          home_path: '/system/data-sources',
          avatar: '',
          permission_count: 1,
          is_guest: false,
        };
      else if (path === '/auth/per/codes') result = [];
      else if (path === '/auth/menu/current')
        result = [
          {
            id: 1,
            pid: 0,
            name: 'System',
            title: '系统管理',
            path: '/system',
            component: 'BasicLayout',
            perm_type: 'catalog',
            enabled: true,
            order_no: 1,
            auth_code: '',
            meta: {},
            redirect: '/system/data-sources',
          },
          {
            id: 2,
            pid: 1,
            name: 'SystemDataSources',
            title: '数据源管理',
            path: '/system/data-sources',
            component: '/system/data-sources/list',
            perm_type: 'menu',
            enabled: true,
            order_no: 1,
            auth_code: '',
            meta: {},
            redirect: null,
          },
        ];
      else if (path === '/notify/inbox')
        result = { items: [], unread_count: 0 };
      else if (path.includes('/credential/items')) result = [];
      else if (path === '/adm/data-sources' && method === 'POST') {
        saved = true;
        result = row();
      } else if (path === '/adm/data-sources/warehouse' && method === 'PUT') {
        updated = true;
        result = row();
      } else if (
        path === '/adm/data-sources/warehouse' &&
        method === 'DELETE'
      ) {
        removed = true;
        result = true;
      } else if (path === '/adm/data-sources/warehouse/probe') {
        probed = true;
        result = { ds_code: 'warehouse', reachable: true, message: '连接成功' };
      } else if (path === '/adm/data-sources')
        result = {
          items: saved && !removed ? [row()] : [],
          total: saved && !removed ? 1 : 0,
          page_no: 1,
          page_size: 20,
          pages: 1,
        };
      else if (path === '/adm/data-sources/warehouse') result = row();
      await fulfill(route, result);
    });
  await page.goto('/');
  await page.locator("input[name='username']").fill('admin');
  await page.locator("input[name='password']").fill('e2e-placeholder');
  await page.getByRole('button', { name: /登录|login/i }).click();
  await expect(page).toHaveURL(/\/system\/data-sources/, { timeout: 30_000 });
  await page.getByRole('button', { name: '新增数据源' }).click();
  const form = page.getByRole('dialog', { name: '新增数据源' });
  await expect(form).toBeVisible({ timeout: 5000 });
  await form.getByRole('textbox', { name: /数据源编码$/ }).fill('warehouse');
  await form.getByRole('textbox', { name: /名称$/ }).fill('分析仓库');
  await form.getByRole('combobox', { name: /数据库类型$/ }).click();
  await page.getByTitle('Databend', { exact: true }).click();
  await form
    .getByRole('textbox', { name: '主机 / SQLite 路径', exact: true })
    .fill('127.0.0.1');
  await form
    .getByRole('textbox', { name: '数据库名', exact: true })
    .fill('analytics');
  await form
    .getByRole('textbox', { name: '用户名', exact: true })
    .fill('databend');
  await form.getByRole('button', { name: /^保\s*存$/ }).click();
  await expect.poll(() => saved).toBe(true);
  await expect(page.getByText('分析仓库', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '编辑', exact: true }).click();
  const editing = page.getByRole('dialog', { name: '编辑数据源' });
  await expect(editing).toBeVisible();
  await expect(
    editing.getByRole('textbox', { name: /数据源编码$/ }),
  ).toBeDisabled();
  await editing.getByRole('textbox', { name: /名称$/ }).fill('分析仓库已修改');
  await editing.getByRole('button', { name: /^保\s*存$/ }).click();
  await expect.poll(() => updated).toBe(true);
  await page.getByRole('button', { name: '测试连接', exact: true }).click();
  const probe = page.getByRole('dialog', { name: '测试 Databend 连接' });
  await expect(probe).toBeVisible();
  await probe.getByRole('checkbox', { name: '允许 HTTP 测试连接' }).check();
  await probe.getByRole('button', { name: '开始测试' }).click();
  await expect.poll(() => probed).toBe(true);
  await expect(page.getByText('连接成功', { exact: true })).toBeVisible();
  await expect(probe).toBeHidden();
  await page.screenshot({
    path: testInfo.outputPath('data-sources-desktop.png'),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '新增数据源' }).click();
  await expect(form).toBeVisible();
  await expect(form.getByRole('textbox', { name: /名称$/ })).toHaveValue('');
  await expect(
    form.getByRole('button', { name: /^保\s*存$/ }),
  ).toBeInViewport();
  await expect
    .poll(async () => {
      const box = await form.boundingBox();
      return Math.round(box?.x ?? 1000);
    })
    .toBe(0);
  await expect
    .poll(async () => {
      const box = await form.boundingBox();
      return box?.width ?? 1000;
    })
    .toBeLessThanOrEqual(390);
  await page.screenshot({
    path: testInfo.outputPath('data-sources-mobile.png'),
    fullPage: true,
  });
});

async function fulfill(route: Route, result: unknown) {
  const body = JSON.stringify({ code: 200, msg: 'ok', result });
  await route.fulfill({
    body:
      route.request().headers().security === 'true'
        ? Buffer.from(KxEd.encryptText(body))
        : body,
    contentType: 'application/json',
  });
}
