import { Buffer } from 'node:buffer';

import { KxEd } from '@kx/admin-core';
import { expect, test } from '@playwright/test';

test.use({ headless: true, actionTimeout: 10_000 });
test('发票导出历史在 Drawer 和独立页面持久可见', async ({ page }) => {
  test.setTimeout(90_000);
  const entries = Array.from({ length: 21 }, (_, index) => ({
    id: 100 - index,
    uid: 7,
    task_run_id: null,
    scope: 'selected',
    mark_submitted_to_finance: false,
    actual_count: 3,
    output_file_id: index === 0 ? null : index + 1,
    state: index === 0 ? 'failed' : 'succeeded',
    error_message: index === 0 ? '测试存储不可用，请检查存储配置' : '',
    created_at: 1_788_960_000 - index,
    updated_at: 1_788_960_000 - index,
    completed_at: 1_788_960_000 - index,
  }));
  const queries: URLSearchParams[] = [];
  let failList = false;
  await page
    .context()
    .route('**/{auth,invoice,notify,param}/**', async (route) => {
      const request = route.request();
      if (!['fetch', 'xhr'].includes(request.resourceType()))
        return route.continue();
      const url = new URL(request.url());
      const path = url.pathname.replace(/^\/api(?=\/)/, '');
      let result: unknown = {};
      if (path === '/auth/user/access_token')
        result = {
          access_token: 'test-only',
          token_type: 'Bearer',
          uid: 7,
          exp_at: 4_102_444_800,
          exp_in: 3600,
        };
      else if (path === '/auth/user/user_info')
        result = {
          id: 7,
          name: '导出测试',
          enabled: true,
          home_path: '/invoice/list',
          avatar: '',
          is_guest: false,
        };
      else if (path === '/auth/per/codes') result = ['invoice:export'];
      else if (path === '/auth/menu/current')
        result = [
          {
            id: 1,
            pid: 0,
            name: 'Invoice',
            title: '发票管理',
            path: '/invoice',
            component: 'BasicLayout',
            perm_type: 'catalog',
            enabled: true,
            order_no: 1,
            meta: {},
          },
          {
            id: 2,
            pid: 1,
            name: 'InvoiceList',
            title: '发票台账',
            path: '/invoice/list',
            component: '/invoice/index',
            perm_type: 'menu',
            enabled: true,
            order_no: 1,
            meta: {},
          },
          {
            id: 3,
            pid: 1,
            name: 'InvoiceExportHistory',
            title: '导出任务',
            path: '/invoice/exports',
            component: '/invoice/exports/index',
            perm_type: 'menu',
            enabled: true,
            order_no: 2,
            meta: {},
          },
        ];
      else if (path === '/invoice/filter-options')
        result = { seller_names: [], buyer_names: [], invoice_types: [] };
      else if (path === '/invoice/items') result = { items: [], total: 0 };
      else if (path === '/invoice/statistics')
        result = {
          total_count: 0,
          amount_tax_total: '0',
          tax_amount_total: '0',
          submitted_count: 0,
          unsubmitted_count: 0,
          needs_review_count: 0,
        };
      else if (path === '/notify/inbox')
        result = { items: [], unread_count: 0, server_time: 1 };
      else if (path === '/invoice/exports') {
        queries.push(url.searchParams);
        const filtered = entries.filter(
          (item) =>
            (!url.searchParams.get('state') ||
              item.state === url.searchParams.get('state')) &&
            (!url.searchParams.get('id') ||
              String(item.id) === url.searchParams.get('id')),
        );
        const current = Number(url.searchParams.get('page') || 1);
        const size = Number(url.searchParams.get('size') || 20);
        result = {
          items: filtered.slice((current - 1) * size, current * size),
          total: filtered.length,
          paging: { page: current, size },
          total_pages: Math.ceil(filtered.length / size),
        };
      } else if (path.endsWith('/content'))
        return route.fulfill({
          contentType: 'application/zip',
          body: 'test-zip',
        });
      const text = JSON.stringify(
        path === '/invoice/exports' && failList
          ? { code: 500, msg: '测试历史查询失败', result: null }
          : { code: 200, msg: 'ok', result },
      );
      await route.fulfill({
        contentType: 'application/json',
        body:
          request.headers().security === 'true'
            ? Buffer.from(KxEd.encryptText(text))
            : text,
      });
    });
  await page.goto('/');
  await page.locator("input[name='username']").fill('invoice-user');
  await page.locator("input[name='password']").fill('test-only');
  await page.getByRole('button', { name: /登录|login/i }).click();
  await page.getByRole('button', { name: '导出任务', exact: true }).click();
  const drawer = page.getByRole('dialog');
  await expect(
    drawer.getByText('测试存储不可用，请检查存储配置'),
  ).toBeVisible();
  expect(queries.length).toBeGreaterThan(0);
  await drawer.getByTitle('2', { exact: true }).click();
  await expect(
    drawer.getByRole('cell', { name: '80', exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: '导出任务', exact: true }).click();
  await expect(
    drawer.getByText('测试存储不可用，请检查存储配置'),
  ).toBeVisible();
  await drawer.getByRole('button', { name: '关闭', exact: true }).click();
  await page.goto('/invoice/exports');
  await expect(
    page.getByRole('heading', { name: '发票导出任务', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('测试存储不可用，请检查存储配置', { exact: true }),
  ).toBeVisible();
  await page.getByPlaceholder('导出编号').fill('99');
  await page.getByRole('button', { name: /查\s*询/ }).click();
  await expect(
    page.getByRole('cell', { name: '99', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('测试存储不可用，请检查存储配置', { exact: true }),
  ).toHaveCount(0);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: /下\s*载/ }).click();
  const downloadedFile = await download;
  expect(downloadedFile.suggestedFilename()).toBe('invoice-export-99.zip');
  failList = true;
  await page.getByRole('button', { name: /刷\s*新/ }).click();
  await expect(
    page
      .getByRole('region', { name: '导出历史' })
      .getByRole('alert')
      .filter({ hasText: '测试历史查询失败' }),
  ).toBeVisible();
  failList = false;
  await page.getByRole('button', { name: /刷\s*新/ }).click();
  await expect(
    page.getByRole('cell', { name: '99', exact: true }),
  ).toBeVisible();
  const activeEntry = entries[1];
  if (!activeEntry) throw new Error('missing export fixture');
  activeEntry.state = 'running';
  activeEntry.output_file_id = null;
  await page.getByRole('button', { name: /刷\s*新/ }).click();
  await expect(page.getByText('导出中', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /下\s*载/ })).toBeDisabled();
  activeEntry.state = 'succeeded';
  activeEntry.output_file_id = 2;
  await expect(page.getByText('已完成', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /下\s*载/ })).toBeEnabled();
  await page.getByRole('button', { name: /重\s*置/ }).click();
  await page.getByRole('combobox').first().click();
  await page
    .locator('.ant-select-item-option')
    .filter({ hasText: /^失败$/ })
    .click();
  await page.getByRole('button', { name: /查\s*询/ }).click();
  await expect(
    page.getByText('测试存储不可用，请检查存储配置', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('cell', { name: '99', exact: true })).toHaveCount(
    0,
  );
  expect(queries.at(-1)?.get('state')).toBe('failed');
  await page.getByRole('button', { name: /重\s*置/ }).click();
  await expect(
    page.getByRole('cell', { name: '99', exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: '/tmp/kx-invoice-export-history.png',
    fullPage: true,
  });
});
