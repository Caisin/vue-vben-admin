import { Buffer } from 'node:buffer';

import { KxEd } from '@kx/admin-core';
import { expect, test } from '@playwright/test';

test.use({ headless: true });
test('角色按菜单功能授权，API 自动关联并保存回填', async ({ page }) => {
  let menuRequests = 0;
  let apiRequests = 0;
  const businessTitle = '业务页面：跨部门多级权限配置与业务操作管理';
  const businessPath =
    '/business/administration/organization/permissions/workflows/configuration/overview';
  const menus = [
    {
      id: 1,
      pid: 0,
      name: 'System',
      title: '系统管理',
      perm_type: 'catalog',
      path: '/system',
      component: '',
      enabled: true,
      order_no: 1,
      meta: {},
      auth_code: '',
      api_ids: [],
    },
    {
      id: 2,
      pid: 1,
      name: 'SystemRole',
      title: '角色管理',
      perm_type: 'menu',
      path: '/system/role',
      component: '/system/role/list',
      enabled: true,
      order_no: 1,
      meta: {},
      auth_code: '',
      api_ids: [],
    },
    {
      id: 3,
      pid: 1,
      name: 'Business',
      title: businessTitle,
      perm_type: 'menu',
      path: businessPath,
      component: '/system/user/list',
      enabled: true,
      order_no: 2,
      meta: {},
      auth_code: '',
      api_ids: [101],
    },
    {
      id: 4,
      pid: 3,
      name: 'BusinessSave',
      title: '保存功能',
      perm_type: 'button',
      path: '',
      component: '',
      enabled: true,
      order_no: 1,
      meta: {},
      auth_code: 'business:save',
      api_ids: [101, 102],
    },
    {
      id: 5,
      pid: 1,
      name: 'ClientOnly',
      title: 'App 客户端操作',
      perm_type: 'button',
      path: '',
      component: '',
      enabled: true,
      order_no: 2,
      meta: {},
      auth_code: 'client:only',
      api_ids: [999],
    },
  ];
  const role = {
    role_id: 'demo',
    role_name: '演示角色',
    enabled: true,
    order_no: 1,
    created_at: 1,
    home_perm_id: 3,
    permission_ids: [3],
    api_ids: [],
    permission_details: [],
    api_details: [],
  };
  const writes: Array<{ permission_ids: number[]; api_ids: number[] }> = [];
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
        name: '测试管理员',
        enabled: true,
        home_path: '/system/role',
      };
    else if (path === '/auth/per/codes')
      result = ['api:auth.role.update', 'api:auth.menu.update'];
    else if (path === '/auth/dt/apps') result = [];
    else if (path === '/auth/menu/current' || path === '/auth/menu/all') {
      if (path === '/auth/menu/all') menuRequests++;
      result = menus;
    } else if (path === '/auth/role') result = { items: [role], total: 1 };
    else if (
      path === '/adm/role/demo/detail' ||
      (path === '/auth/role/demo' && request.method() === 'GET')
    )
      result = role;
    else if (path === '/auth/api/grant-options') {
      apiRequests++;
      result = [
        {
          id: 101,
          enabled: true,
          api_name: '读取业务',
          api_method: 'GET',
          api_path: '/demo',
          api_code: 'demo.read',
          access_mode: 'custom',
          permission_ids: [3, 4],
        },
        {
          id: 102,
          enabled: true,
          api_name: '写入业务',
          api_method: 'POST',
          api_path: '/demo',
          api_code: 'demo.write',
          access_mode: 'custom',
          permission_ids: [4],
        },
      ];
    } else if (path === '/auth/role/demo' && request.method() === 'PUT') {
      const body =
        request.headers().security === 'true'
          ? JSON.parse(KxEd.decryptText(request.postDataBuffer() as Buffer))
          : request.postDataJSON();
      writes.push(body);
      role.permission_ids = body.permission_ids;
      result = role;
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
  await page
    .getByRole('button', { name: '编辑角色及权限：演示角色', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: '新增角色', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: '删除角色', exact: true }),
  ).toHaveCount(0);
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const viewport = page.viewportSize();
  const bounds = await dialog.boundingBox();
  expect(bounds?.width).toBeGreaterThan((viewport?.width ?? 1280) * 0.95);

  await expect(dialog.getByRole('tree')).toHaveCount(1);
  await expect(dialog.getByText('App 客户端操作', { exact: true })).toHaveCount(
    0,
  );
  const homeSelect = dialog.locator('.ant-tree-select');
  await expect(homeSelect).toHaveCount(1);
  const selectBounds = await homeSelect.boundingBox();
  expect(selectBounds?.width).toBeGreaterThan(350);
  const selectedHome = homeSelect.locator('.ant-select-content');
  await expect(selectedHome).toContainText(businessTitle);
  await expect(selectedHome).toContainText(businessPath);
  expect(
    await selectedHome.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
  ).toBe(true);
  await homeSelect.click();
  const homePopup = page.locator('.ant-select-dropdown:visible');
  await expect(homePopup).toBeVisible();
  const popupBounds = await homePopup.boundingBox();
  expect(popupBounds?.width).toBeGreaterThan(600);
  await page.keyboard.press('Escape');
  await expect(dialog.getByRole('tab', { name: /API 权限/ })).toHaveCount(0);
  await dialog.getByText('查看自动关联的 API（1）', { exact: true }).click();
  await expect(dialog.getByText('读取业务', { exact: false })).toBeVisible();
  await expect(dialog.getByText('写入业务', { exact: false })).toHaveCount(0);
  const buttonNode = dialog
    .getByRole('treeitem')
    .filter({ has: page.getByText('保存功能', { exact: true }) })
    .last();
  await buttonNode.getByRole('checkbox').click();
  await expect(dialog.getByText('写入业务', { exact: false })).toBeVisible();
  await dialog.getByRole('button', { name: /确\s*(认|定)/ }).click();
  await expect(dialog).not.toBeVisible();
  expect(writes[0]?.permission_ids).toEqual([3, 4]);
  expect(writes[0]?.api_ids).toEqual([]);
  await page
    .getByRole('button', { name: '编辑角色及权限：演示角色', exact: true })
    .click();
  await expect(
    dialog.getByText('查看自动关联的 API（2）', { exact: true }),
  ).toBeVisible();
  expect(menuRequests).toBe(1);
  expect(apiRequests).toBe(1);
  await dialog
    .getByRole('button', { name: '刷新权限目录', exact: true })
    .click();
  await expect.poll(() => menuRequests).toBe(2);
  await expect.poll(() => apiRequests).toBe(2);
  await page.setViewportSize({ width: 640, height: 900 });
  await homeSelect.click();
  await expect(homePopup).toBeVisible();
  const compactPopup = await homePopup.boundingBox();
  expect(compactPopup?.width).toBeLessThanOrEqual(608);
  await page.keyboard.press('Escape');
  if (viewport) await page.setViewportSize(viewport);
  await expect
    .poll(async () => {
      const bounds = await dialog.boundingBox();
      return bounds?.x ?? Infinity;
    })
    .toBeLessThan(2);
  await page.screenshot({
    path: test.info().outputPath('permission-tree-wide.png'),
  });
});
