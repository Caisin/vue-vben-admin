import type { Page, Route } from '@playwright/test';

import { Buffer } from 'node:buffer';

import { KxEd } from '@kx/admin-core';
import { expect, test } from '@playwright/test';

const ok = (result: unknown) => ({ code: 200, msg: 'ok', result });

test('public import-export history filters and downloads retained files', async ({
  page,
}) => {
  await mockAuth(page);

  const queries: URLSearchParams[] = [];
  await page.context().route('**/import-export/runs**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/files/input')) {
      await route.fulfill({
        body: 'xlsx-content',
        contentType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      return;
    }
    queries.push(url.searchParams);
    await fulfillApi(route, pageResult(historyRows()));
  });

  await page.goto('/');
  await page.locator("input[name='username']").fill('admin');
  await page.locator("input[name='password']").fill('123456');
  await page.getByRole('button', { name: /登录|login/i }).click();

  await expect(page.getByText('TT 小程序加白导入')).toBeVisible();
  await expect(page.getByText('Apple 开发者账户导入')).toBeVisible();

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '原文件' }).first().click();
  const downloadedFile = await download;
  expect(downloadedFile.suggestedFilename()).toBe('古言社媒加白.xlsx');

  const expiredRow = page.getByRole('row', {
    name: /Apple 开发者账户导入/,
  });
  await expect(
    expiredRow.getByRole('button', { name: '原文件' }),
  ).toBeDisabled();

  await page.getByLabel('方向').click();
  await page.getByText('导入', { exact: true }).last().click();
  await expect
    .poll(() => queries.some((query) => query.get('direction') === 'import'))
    .toBe(true);
});

async function mockAuth(page: Page) {
  await page.context().route('**/auth/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    await fulfillApi(route, authFixture(path));
  });
}

async function fulfillApi(route: Route, result: unknown) {
  const body = JSON.stringify(ok(result));
  const encrypted = route.request().headers().security === 'true';
  await route.fulfill({
    body: encrypted ? Buffer.from(KxEd.encryptText(body)) : body,
    contentType: 'application/json',
  });
}

function authFixture(path: string) {
  switch (path) {
    case '/auth/dt/apps': {
      return [];
    }
    case '/auth/menu/current': {
      return menuFixture();
    }
    case '/auth/per/codes': {
      return [];
    }
    case '/auth/user/access_token': {
      return {
        access_token: 'e2e-token',
        exp_at: 4_102_444_800,
        exp_in: 3600,
        token_type: 'Bearer',
        uid: 1,
      };
    }
    case '/auth/user/user_info': {
      return {
        avatar: '',
        created_at: 1,
        dept_id: 0,
        email: 'admin@example.test',
        enabled: true,
        home_path: '/system/import-export-runs',
        id: 1,
        is_guest: false,
        name: '管理员',
        os: 'web',
        permission_count: 0,
        platform: 'web',
        reg_ip: '127.0.0.1',
        tel: '',
        updated_at: 1,
      };
    }
    default: {
      return null;
    }
  }
}

function menuFixture() {
  return [
    {
      auth_code: '',
      component: 'BasicLayout',
      enabled: true,
      id: 1,
      meta: { icon: 'lucide:settings', keep_alive: true },
      name: 'System',
      order_no: 1,
      path: '/system',
      perm_type: 'catalog',
      pid: 0,
      redirect: '/system/import-export-runs',
      title: '系统管理',
    },
    {
      auth_code: '',
      component: '/system/import-export-runs/list',
      enabled: true,
      id: 2,
      meta: { keep_alive: true },
      name: 'SystemImportExportRuns',
      order_no: 1,
      path: '/system/import-export-runs',
      perm_type: 'menu',
      pid: 1,
      redirect: null,
      title: '导入导出记录',
    },
  ];
}

function pageResult<T>(items: T[]) {
  return {
    items,
    paging: { page: 1, size: 20 },
    total: items.length,
    total_pages: 1,
  };
}

function historyRows() {
  const now = Math.floor(Date.now() / 1000);
  return [
    {
      created_at: now,
      definition_code: 'developer_account.tiktok.mini_app_whitelist',
      definition_name: 'TT 小程序加白导入',
      direction: 'import',
      error_code: null,
      error_file_name: null,
      error_message: null,
      expires_at: now + 3600,
      failed_count: 0,
      finished_at: now,
      has_errors: false,
      has_result: false,
      id: 1,
      input_file_name: '古言社媒加白.xlsx',
      message: '导入完成',
      result_file_name: null,
      status: 'succeeded',
      succeeded_count: 10,
      task_run_id: 1,
      total_count: 10,
      updated_at: now,
    },
    {
      created_at: now - 7200,
      definition_code: 'developer_account.apple',
      definition_name: 'Apple 开发者账户导入',
      direction: 'import',
      error_code: null,
      error_file_name: null,
      error_message: null,
      expires_at: now - 3600,
      failed_count: 0,
      finished_at: now - 7000,
      has_errors: false,
      has_result: false,
      id: 2,
      input_file_name: 'apple.xlsx',
      message: '导入完成',
      result_file_name: null,
      status: 'succeeded',
      succeeded_count: 3,
      task_run_id: 2,
      total_count: 3,
      updated_at: now - 7000,
    },
  ];
}
