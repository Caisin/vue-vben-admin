import { Buffer } from 'node:buffer';

import { KxEd } from '@kx/admin-core';
import { expect, test } from '@playwright/test';

test.use({ headless: true });
for (const action of ['read', 'create', 'update']) {
  test(`资产页面只授予 ${action} 时按钮独立生效`, async ({ page }) => {
    const item = {
      id: 51,
      code: 'points',
      name: '权限测试积分',
      kind: 'coin',
      enabled: true,
      spend_priority: 1,
      intro: '',
      created_at: 1,
      updated_at: 1,
    };
    const writes: string[] = [];
    await page.route(
      '**/{auth,param,storage,notify,adm,asset}/**',
      async (route) => {
        const request = route.request();
        if (!['fetch', 'xhr'].includes(request.resourceType()))
          return route.continue();
        const path = new URL(request.url()).pathname.replace(
          /^\/api(?=\/)/,
          '',
        );
        let result: unknown = null;
        if (path === '/auth/user/access_token')
          result = {
            access_token: 'fixture',
            uid: 51,
            exp_in: 3600,
            exp_at: 4_102_444_800,
          };
        else if (path.startsWith('/auth/user/tz')) result = 'Asia/Shanghai';
        else if (path === '/auth/user/user_info')
          result = { id: 51, name: '资产操作员', home_path: '/asset/items' };
        else if (path === '/auth/per/codes')
          result = action === 'read' ? [] : [`api:asset.item.${action}`];
        else if (path === '/auth/dt/apps') result = [];
        else if (path === '/auth/menu/current')
          result = [
            {
              id: 1,
              pid: 0,
              name: 'AssetItems',
              title: '资产目录',
              perm_type: 'menu',
              path: '/asset/items',
              component: '/asset/items/list',
              enabled: true,
              order_no: 1,
              meta: {},
            },
          ];
        else if (path === '/asset/items' && request.method() === 'GET')
          result = { items: [item], total: 1 };
        else if (
          path.startsWith('/asset/items') &&
          request.method() !== 'GET'
        ) {
          writes.push(request.method());
          result = item;
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
      },
    );
    await page.goto('/');
    await page.locator("input[name='username']").fill('operator');
    await page.locator("input[name='password']").fill('123456');
    await page.getByRole('button', { name: /登录|login/i }).click();
    const edit = page.getByRole('button', {
      name: '权限测试积分',
      exact: true,
    });
    await expect(edit).toBeVisible();
    const create = page.getByRole('button', { name: '新建资产', exact: true });
    if (action === 'create') {
      await expect(create).toBeVisible();
      await expect(edit).toBeDisabled();
      await create.click();
      await expect(page.getByRole('dialog')).toContainText('新建资产目录');
    } else {
      await expect(create).toHaveCount(0);
      if (action === 'update') {
        await edit.click();
        await expect(page.getByRole('dialog')).toContainText('编辑资产目录');
      } else await expect(edit).toBeDisabled();
    }
    expect(writes).toEqual([]);
  });
}
