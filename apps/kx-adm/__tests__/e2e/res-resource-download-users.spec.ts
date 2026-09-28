import { Buffer } from 'node:buffer';

import { KxEd } from '@kx/admin-core';
import { expect, test } from '@playwright/test';

test.use({ headless: true, actionTimeout: 10_000 });
test('资源下载权限按组织多选用户，失败保留选择，保存后回显', async ({
  page,
}) => {
  test.setTimeout(60_000);
  let failTree = true;
  let failSave = true;
  const writes: Array<
    Array<{
      uid: number;
      can_download: boolean;
      valid_from: number;
      valid_until: number;
    }>
  > = [];
  let grants: Array<Record<string, unknown>> = [];
  const res = {
    id: 41,
    res_name: '测试短剧',
    res_type: 'drama',
    state: 0,
    ext_info: {},
    lang_info: {},
  };
  await page.route('**/{auth,adm,param,notify,storage}/**', async (route) => {
    const req = route.request();
    if (!['fetch', 'xhr'].includes(req.resourceType())) return route.continue();
    const path = new URL(req.url()).pathname.replace(/^\/api(?=\/)/, '');
    let result: unknown = [];
    if (path === '/auth/user/access_token')
      result = {
        access_token: 'fixture',
        uid: 7,
        exp_at: 4_102_444_800,
        exp_in: 3600,
      };
    else if (path.startsWith('/auth/user/tz')) result = 'Asia/Shanghai';
    else if (path === '/auth/user/user_info')
      result = {
        id: 7,
        name: '管理员',
        enabled: true,
        home_path: '/res/seas/global/source_manage',
      };
    else if (path === '/auth/menu/current')
      result = [
        {
          id: 1,
          pid: 0,
          name: 'ResContent',
          title: '资源管理',
          path: '/res/seas/global/source_manage',
          component: '/res/seas/global/source_manage/index',
          perm_type: 'menu',
          enabled: true,
          order_no: 1,
          meta: {},
        },
      ];
    else if (path === '/notify/inbox') result = { items: [], unread_count: 0 };
    else if (path === '/adm/res') result = { items: [res], total: 1 };
    else if (path === '/adm/res/info/41') result = res;
    else if (path === '/adm/res/download-users/tree') {
      if (failTree)
        return route.fulfill({ status: 503, body: '组织树加载失败' });
      result = [
        {
          value: 'company:1',
          title: '测试公司',
          selectable: false,
          disabled: false,
          children: [
            {
              value: 'dept:1',
              title: '发行部',
              selectable: false,
              disabled: false,
              children: [7, 8, 9].map((id) => ({
                value: String(id),
                title: `用户${id}`,
                selectable: true,
                disabled: id === 9,
                children: [],
              })),
            },
          ],
        },
      ];
    } else if (path === '/adm/res/41/download-permissions') {
      if (req.method() === 'PUT') {
        const body =
          req.headers().security === 'true'
            ? JSON.parse(KxEd.decryptText(req.postDataBuffer() as Buffer))
            : req.postDataJSON();
        writes.push(body);
        if (failSave)
          return route.fulfill({ status: 503, body: '保存失败，请重试' });
        grants = body.map((item: { uid: number }) => ({
          ...item,
          id: item.uid,
          user_name: `用户${item.uid}`,
          res_id: 41,
        }));
        result = grants;
      } else result = { items: grants, total: grants.length };
    }
    const body = JSON.stringify({ code: 200, msg: 'ok', result });
    await route.fulfill({
      contentType: 'application/json',
      body:
        req.headers().security === 'true'
          ? Buffer.from(KxEd.encryptText(body))
          : body,
    });
  });
  await page.goto('/');
  await page.locator("input[name='username']").fill('admin');
  await page.locator("input[name='password']").fill('123456');
  await page.getByRole('button', { name: /登录|login/i }).click();
  await page.getByRole('button', { name: '版本与内容', exact: true }).click();
  await page.getByRole('button', { name: '下载权限', exact: true }).click();
  const dialog = page.getByRole('dialog', {
    name: '资源下载权限',
    exact: true,
  });
  const users = dialog.getByRole('combobox', { name: '指定用户' });
  await expect(users).toBeDisabled();
  failTree = false;
  await dialog.getByRole('button', { name: '重新加载组织树' }).click();
  await expect(users).toBeEnabled();
  await users.click();
  for (const title of ['测试公司', '发行部']) {
    await page
      .locator('.ant-select-tree-treenode:visible')
      .filter({ hasText: title })
      .locator('.ant-select-tree-switcher')
      .click();
  }
  await page.getByText('用户7', { exact: true }).click();
  await page.getByText('用户8', { exact: true }).click();
  await expect(
    page
      .locator('.ant-select-tree-treenode-disabled')
      .filter({ hasText: '用户9' }),
  ).toBeVisible();
  await dialog
    .getByText('所选用户使用相同的有效期和下载状态；已有授权按本次设置更新。')
    .click();
  const save = dialog.getByRole('button', { name: '保存授权（2 人）' });
  await save.click();
  await expect(
    dialog.getByRole('alert').filter({ hasText: /失败/ }),
  ).toBeVisible();
  await expect(save).toBeEnabled();
  expect(writes[0]).toEqual(
    [7, 8].map((uid) => ({
      uid,
      can_download: true,
      valid_from: 0,
      valid_until: 0,
    })),
  );
  failSave = false;
  await save.click();
  await expect.poll(() => writes.length).toBe(2);
  await expect(
    dialog.getByRole('row').filter({ hasText: '用户7' }),
  ).toBeVisible();
  await expect(
    dialog.getByRole('row').filter({ hasText: '用户8' }),
  ).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: '保存授权', exact: true }),
  ).toBeDisabled();
  await dialog
    .getByRole('row')
    .filter({ hasText: '用户8' })
    .getByRole('button', { name: '编辑' })
    .click();
  await expect(
    dialog.getByRole('button', { name: '保存授权（1 人）' }),
  ).toBeEnabled();
  await expect(
    dialog.locator('.ant-select-selection-item').filter({ hasText: '用户8' }),
  ).toBeVisible();
  await dialog.getByRole('button', { name: '关闭', exact: true }).click();
  await page.getByRole('button', { name: '下载权限', exact: true }).click();
  await expect(
    dialog.getByRole('row').filter({ hasText: '用户7' }),
  ).toBeVisible();
  await expect(
    dialog.getByRole('row').filter({ hasText: '用户8' }),
  ).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: '保存授权', exact: true }),
  ).toBeDisabled();
});
