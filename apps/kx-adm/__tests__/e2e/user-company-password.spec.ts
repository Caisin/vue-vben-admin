import type { Route } from '@playwright/test';

import { Buffer } from 'node:buffer';

import { KxEd } from '@kx/admin-core';
import { expect, test } from '@playwright/test';

test('选择公司与部门查询用户，并展示重置后实际登录名', async ({ page }) => {
  test.setTimeout(90_000);
  const queries: URLSearchParams[] = [];
  const resets: string[] = [];
  const user = {
    id: 102,
    name: '同名用户',
    enabled: true,
    dept_id: 0,
    created_at: 1,
    updated_at: 1,
    permission_ids: [],
    api_ids: [],
    role_ids: [],
  };
  const department = (id: number, name: string) => ({
    id,
    name,
    pid: 0,
    enabled: true,
    sort_no: 0,
    created_at: 1,
    updated_at: 1,
  });
  await page.route('**/{auth,param,notify}/**', async (route) => {
    if (!['fetch', 'xhr'].includes(route.request().resourceType())) {
      await route.continue();
      return;
    }
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/api(?=\/)/, '');
    let result: unknown = [];
    if (path === '/auth/dt/exchange') {
      result = {
        access_token: 'test-token',
        token_type: 'Bearer',
        uid: 1,
        exp_at: 4_102_444_800,
        exp_in: 3600,
      };
    } else if (path === '/auth/user/user_info') {
      result = { ...user, id: 1, name: '管理员', home_path: '/system/user' };
    } else if (path === '/auth/per/codes') {
      result = ['AC_100100'];
    } else if (path === '/auth/menu/current') {
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
        },
        {
          id: 2,
          pid: 1,
          name: 'SystemUser',
          title: '用户管理',
          path: '/system/user',
          component: '/system/user/list',
          perm_type: 'menu',
          enabled: true,
          order_no: 1,
          auth_code: '',
          meta: {},
        },
      ];
    } else if (path === '/auth/dept/companies') {
      result = [
        {
          ...department(-1, '公司甲'),
          source_id: 'company-a',
          children: [
            {
              ...department(11, '研发部'),
              children: [department(12, '研发一组')],
            },
          ],
        },
        {
          ...department(-2, '公司乙'),
          source_id: 'company-b',
          children: [department(21, '业务部')],
        },
      ];
    } else if (path === '/auth/user-admin') {
      queries.push(url.searchParams);
      result = { items: [user], total: 1, paging: { page: 1, size: 20 } };
    } else if (path === '/auth/user-admin/102') {
      result = user;
    } else if (path === '/auth/user-admin/102/password') {
      resets.push(path);
      result = { user_name: '同名用户_102', password: 'New-password-123' };
    } else if (path === '/notify/inbox') {
      result = { items: [], unread_count: 0 };
    } else if (path === '/param/system-settings/public') {
      result = {};
    }
    await fulfillApi(route, result);
  });
  await page.goto('/#/auth/login?exchange_code=test-code');
  const tree = page.locator('.dept-panel');
  await expect(tree.getByText('公司甲', { exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await tree.getByText('公司甲', { exact: true }).click();
  await expect.poll(() => queries.at(-1)?.get('source_id')).toBe('company-a');
  expect(queries.at(-1)?.get('dept_ids')).toBeNull();
  await tree.getByText('研发部', { exact: true }).click();
  await expect.poll(() => queries.at(-1)?.get('dept_ids')).toBe('11,12');
  expect(queries.at(-1)?.get('source_id')).toBe('company-a');
  await tree.getByText('公司乙', { exact: true }).click();
  await expect.poll(() => queries.at(-1)?.get('source_id')).toBe('company-b');
  expect(queries.at(-1)?.get('dept_ids')).toBeNull();
  expect(queries.at(-1)?.get('page')).toBe('1');
  const row = page
    .getByRole('row')
    .filter({ has: page.getByRole('button', { name: '修改', exact: true }) });
  await row.getByRole('button').last().click();
  await page.getByText('重置登录密码', { exact: true }).click();
  const reset = page.getByRole('dialog').filter({ hasText: '重置登录密码' });
  await reset.locator('input[type="password"]').fill('New-password-123');
  await reset.getByRole('button', { name: /确.*定/ }).click();
  const result = page.getByRole('dialog').filter({ hasText: '复制登录信息' });
  await expect(result.locator('input').first()).toHaveValue('同名用户_102');
  await expect(result.locator('input[type="password"]')).toHaveValue(
    'New-password-123',
  );
  expect(resets).toEqual(['/auth/user-admin/102/password']);
  expect(queries.at(-1)?.get('source_id')).toBe('company-b');
});

async function fulfillApi(route: Route, result: unknown) {
  const body = JSON.stringify({ code: 200, msg: 'ok', result });
  await route.fulfill({
    body:
      route.request().headers().security === 'true'
        ? Buffer.from(KxEd.encryptText(body))
        : body,
    contentType: 'application/json',
  });
}
