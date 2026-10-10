import { Buffer } from 'node:buffer';

import { KxEd } from '@kx/admin-core';
import { expect, test } from '@playwright/test';

test.use({ headless: true });
test('角色配置选择组织、全选与保存回填', async ({ page }) => {
  const writes: any[] = [];
  const user = {
    id: 50,
    name: '张三',
    enabled: true,
    tel: '',
    email: '',
    roles: [{ role_id: 'upload', role_name: '资源上传', enabled: true }],
    scope: { mode: 'managed', organization_keys: [] as string[], revision: 0 },
  };
  await page.route('**/{auth,param,storage,notify,adm}/**', async (route) => {
    const request = route.request();
    if (!['fetch', 'xhr'].includes(request.resourceType()))
      return route.continue();
    const path = new URL(request.url()).pathname.replace(/^\/api(?=\/)/, '');
    let result: unknown = null;
    if (path === '/auth/user/access_token')
      result = {
        access_token: 'fixture',
        uid: 1,
        exp_in: 3600,
        exp_at: 4_102_444_800,
      };
    else if (path.startsWith('/auth/user/tz')) result = 'Asia/Shanghai';
    else if (path === '/auth/user/user_info')
      result = {
        id: 1,
        name: '管理员',
        enabled: true,
        home_path: '/system/role-assignment-config',
      };
    else if (path === '/auth/per/codes')
      result = ['roles:configure-distribution'];
    else if (path === '/auth/dt/apps') result = [];
    else if (path === '/auth/menu/current')
      result = [
        {
          id: 1,
          pid: 0,
          name: 'SystemRoleAssignmentConfig',
          title: '角色分配配置',
          perm_type: 'menu',
          path: '/system/role-assignment-config',
          component: '/system/role-assignment/config',
          enabled: true,
          order_no: 1,
          meta: {},
        },
      ];
    else if (path === '/auth/role-assignment/config/users')
      result = { items: [user], total: 1 };
    else if (path === '/auth/role-assignment/config/roles') result = user.roles;
    else if (path === '/auth/role-assignment/config/organizations')
      result = [
        {
          key: 'company:a',
          title: '公司甲',
          children: [{ key: 'dept:10', title: '运营部', children: [] }],
        },
        { key: 'unassigned', title: '未分配组织的用户', children: [] },
      ];
    else if (
      path === '/auth/role-assignment/config/50' &&
      request.method() === 'PUT'
    ) {
      const body =
        request.headers().security === 'true'
          ? JSON.parse(KxEd.decryptText(request.postDataBuffer() as Buffer))
          : request.postDataJSON();
      writes.push(body);
      user.scope = {
        mode: body.scope.mode,
        organization_keys: body.scope.organization_keys,
        revision: body.scope.expected_revision + 1,
      };
    } else if (path === '/notify/inbox')
      result = { items: [], unread_count: 0 };
    const body = JSON.stringify({ code: 200, msg: 'ok', result });
    await route.fulfill({
      contentType: 'application/json',
      body:
        request.headers().security === 'true'
          ? Buffer.from(KxEd.encryptText(body))
          : body,
    });
  });
  await page.goto('/');
  await page.locator("input[name='username']").fill('admin');
  await page.locator("input[name='password']").fill('123456');
  await page.getByRole('button', { name: /登录|login/i }).click();
  await page.getByRole('button', { name: '配置可分配角色：张三' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('combobox', { name: '可授权组织范围' }).click();
  await page.getByTitle('选择公司 / 部门', { exact: true }).click();
  await dialog
    .locator('.ant-tree-treenode')
    .filter({ hasText: '公司甲' })
    .locator('.ant-tree-checkbox')
    .click();
  await dialog.getByRole('button', { name: /确\s*定/ }).click();
  await expect(dialog).not.toBeVisible();
  expect(writes[0].scope).toEqual({
    mode: 'selected',
    organization_keys: ['company:a'],
    expected_revision: 0,
  });
  await expect(
    page.getByText('指定组织（1 项）', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '配置可分配角色：张三' }).click();
  await expect(
    dialog
      .locator('.ant-tree-treenode')
      .filter({ hasText: '公司甲' })
      .locator('.ant-tree-checkbox'),
  ).toHaveClass(/ant-tree-checkbox-checked/);
  await dialog.getByRole('checkbox', { name: '全选', exact: true }).check();
  await dialog.getByRole('button', { name: /确\s*定/ }).click();
  await expect(dialog).not.toBeVisible();
  expect(writes[1].scope).toEqual({
    mode: 'all',
    organization_keys: [],
    expected_revision: 1,
  });
  await page.getByRole('button', { name: '配置可分配角色：张三' }).click();
  await expect(
    dialog.getByRole('checkbox', { name: '全选', exact: true }),
  ).toBeChecked();
});
