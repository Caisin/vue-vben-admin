import { Buffer } from 'node:buffer';

import { KxEd } from '@kx/admin-core';
import { expect, test } from '@playwright/test';

test.use({ headless: true });
test('下载管理显示可读流量、远程剧名编码筛选和我的下载记录', async ({
  page,
}) => {
  test.setTimeout(60_000);
  const taskQueries: URL[] = [];
  const optionQueries: URL[] = [];
  await page.route(
    '**/{auth,param,storage,notify,adm,api}/**',
    async (route) => {
      const request = route.request();
      if (!['fetch', 'xhr'].includes(request.resourceType()))
        return route.continue();
      const url = new URL(request.url());
      const path = url.pathname.replace(/^\/api(?=\/)/, '');
      let result: unknown = [];
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
          home_path: '/res/seas/download-management',
        };
      else if (path === '/auth/menu/current')
        result = [
          {
            id: 1,
            pid: 0,
            name: 'ResDownloadManagement',
            title: '下载管理',
            perm_type: 'menu',
            path: '/res/seas/download-management',
            component: '/res/seas/download-management/index',
            enabled: true,
            order_no: 1,
            meta: {},
          },
        ];
      else if (path === '/adm/res/download-stats')
        result = {
          total_bytes: 1_073_741_824,
          total_downloads: 2,
          unique_users: 1,
          unique_ips: 1,
          ranking: [],
        };
      else if (path === '/adm/res/download-tasks/resources') {
        optionQueries.push(url);
        const selected = {
          res_id: 51,
          res_name: '目标剧',
          resource_code: 'SPECIAL',
        };
        const keyword = url.searchParams.get('keyword');
        if (keyword) result = { items: [selected], total: 1 };
        else if (Number(url.searchParams.get('page')) === 2)
          result = { items: [selected], total: 51 };
        else
          result = {
            items: Array.from({ length: 50 }, (_, i) => ({
              res_id: i + 1,
              res_name: `剧${i + 1}`,
              resource_code: `DR-${i + 1}`,
            })),
            total: 51,
          };
      } else if (path === '/adm/res/download-tasks') {
        taskQueries.push(url);
        result = { items: [], total: 0 };
      } else if (path === '/api/res/download-tasks')
        result = { items: [], total: 0 };
      else if (path === '/notify/inbox')
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
  await page.locator("input[name='username']").fill('admin');
  await page.locator("input[name='password']").fill('123456');
  await page.getByRole('button', { name: /登录|login/i }).click();
  await expect(page.getByText('1.0 GiB', { exact: true })).toBeVisible();
  const name = page.getByRole('combobox', { name: /剧名/ });
  await name.click();
  await page.getByRole('button', { name: '加载更多' }).click();
  await expect
    .poll(() =>
      optionQueries.some((url) => url.searchParams.get('page') === '2'),
    )
    .toBe(true);
  await name.fill('目标剧');
  await page.getByTitle('目标剧 · SPECIAL · #51', { exact: true }).click();
  await expect
    .poll(() => taskQueries.at(-1)?.searchParams.get('res_id'))
    .toBe('51');
  const code = page.getByRole('combobox', { name: /编码/ });
  await code.fill('SPECIAL');
  await page.getByTitle('SPECIAL', { exact: true }).click();
  await expect
    .poll(() => taskQueries.at(-1)?.searchParams.get('resource_code'))
    .toBe('SPECIAL');
  await page.getByRole('button', { name: '我的下载记录', exact: true }).click();
  await expect(
    page.getByRole('dialog', { name: '下载中心', exact: true }),
  ).toBeVisible();
});
