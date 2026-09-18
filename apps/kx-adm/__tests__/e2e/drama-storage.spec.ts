import { Buffer } from 'node:buffer';

import { KxEd } from '@kx/admin-core';
import { expect, test } from '@playwright/test';

test.use({ headless: true });
test('剧视频存储独立配置并在保存后回显', async ({ page }) => {
  const shared = {
    code: 'shared',
    storage_name: '通用存储',
    storage_type: 's3',
    is_public: false,
  };
  const drama = {
    code: 'drama',
    storage_name: '剧视频专用',
    storage_type: 's3',
    is_public: false,
  };
  let selected: null | typeof drama = null;
  let saved = false;
  await page.route('**/{auth,param,storage,notify}/**', async (route) => {
    const req = route.request();
    if (!['fetch', 'xhr'].includes(req.resourceType())) return route.continue();
    const path = new URL(req.url()).pathname.replace(/^\/api(?=\/)/, '');
    let result: unknown = [];
    if (path === '/auth/dt/exchange')
      result = {
        access_token: 'fixture',
        uid: 7,
        exp_at: 4_102_444_800,
        exp_in: 3600,
      };
    else if (path === '/auth/user/user_info')
      result = {
        id: 7,
        name: '管理员',
        enabled: true,
        home_path: '/storage/settings',
      };
    else if (path === '/auth/menu/current')
      result = [
        {
          id: 1,
          pid: 0,
          name: 'StorageSettings',
          title: '默认存储设置',
          path: '/storage/settings',
          component: '/storage/settings/index',
          perm_type: 'menu',
          enabled: true,
          order_no: 1,
          meta: {},
        },
      ];
    else if (path === '/param/system-settings/public') result = null;
    else if (path === '/notify/inbox') result = { items: [], unread_count: 0 };
    else if (path === '/storage/cfg')
      result = { items: [shared, drama], total: 2 };
    else if (path === '/storage/cfg/business-defaults') {
      if (req.method() === 'PUT') {
        const bytes = req.postDataBuffer();
        if (!bytes) throw new Error('missing body');
        const body = JSON.parse(KxEd.decryptText(bytes));
        expect(body.res_drama_upload).toBe('drama');
        expect(body.file_share_upload).toBe('shared');
        selected = drama;
        saved = true;
      }
      result = {
        res_drama_upload: selected,
        import_export_private: shared,
        invoice_private: shared,
        developer_account_private: shared,
        file_share_upload: shared,
      };
    }
    await route.fulfill({
      contentType: 'application/json',
      body: Buffer.from(
        KxEd.encryptText(JSON.stringify({ code: 200, msg: 'ok', result })),
      ),
    });
  });
  await page.goto('/#/auth/login?exchange_code=fixture');
  await page.getByRole('combobox', { name: '剧视频存储' }).click();
  await page.getByTitle('剧视频专用 (drama)', { exact: true }).click();
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect.poll(() => saved).toBe(true);
  await expect(page.getByText('默认存储设置已保存')).toBeVisible();
  await page.reload();
  await expect(
    page.getByText('剧视频专用 (drama)', { exact: true }),
  ).toBeVisible();
});
