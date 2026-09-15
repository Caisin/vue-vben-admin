import { Buffer } from 'node:buffer';

import { KxEd } from '@kx/admin-core';
import { expect, test } from '@playwright/test';
test.use({ headless: true });
test('统一运行监控筛选、分页与详情', async ({ page }, info) => {
  const queries: URLSearchParams[] = [];
  const cancellations: string[] = [];
  let restarted = false;
  const restartRequests: string[] = [];
  await page
    .context()
    .route('**/{auth,notify,param,data-sync}/**', async (route) => {
      if (!['fetch', 'xhr'].includes(route.request().resourceType())) {
        await route.continue();
        return;
      }
      const path = new URL(route.request().url()).pathname.replace(
        /^\/api(?=\/)/,
        '',
      );
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
          name: '同步操作员',
          enabled: true,
          home_path: '/data-sync/runs',
          is_guest: false,
          permission_count: 1,
        };
      else if (path === '/auth/per/codes')
        result = ['data-sync:execute', 'data-sync:configure'];
      else if (path === '/auth/menu/current')
        result = [
          {
            id: 1,
            pid: 0,
            name: 'DataSync',
            title: '数据同步',
            path: '/data-sync',
            component: 'BasicLayout',
            perm_type: 'catalog',
            enabled: true,
            order_no: 1,
            auth_code: '',
            meta: {},
            redirect: '/data-sync/runs',
          },
          {
            id: 2,
            pid: 1,
            name: 'DataSyncRuns',
            title: '执行监控',
            path: '/data-sync/runs',
            component: '/data-sync/runs',
            perm_type: 'menu',
            enabled: true,
            order_no: 1,
            auth_code: '',
            meta: {},
          },
        ];
      else if (path === '/notify/inbox')
        result = { items: [], unread_count: 0 };
      else if (
        path === '/data-sync/jobs/2' &&
        route.request().method() === 'GET'
      )
        result = {
          job: {
            id: 2,
            database_id: 99,
            target_table: 'orders',
            state: 'paused',
            schedule_paused: true,
            version: 7,
            active_run_id: null,
          },
        };
      else if (
        path === '/data-sync/databases/99' &&
        route.request().method() === 'GET'
      )
        result = {
          id: 99,
          state: 'paused',
          schedule_paused: true,
          version: 8,
          active_task_id: null,
        };
      else if (path === '/data-sync/databases/99/state') {
        restartRequests.push(path);
        result = { id: 99, state: 'ready', schedule_paused: false, version: 9 };
      } else if (path === '/data-sync/databases/99/sync') {
        restartRequests.push(path);
        restarted = true;
        result = { id: 501, status: 'running' };
      } else if (path === '/data-sync/jobs/2/state') {
        cancellations.push(path);
        result = {
          id: 2,
          active_run_id: 1,
          state: 'running',
          schedule_paused: true,
        };
      } else if (path === '/data-sync/runs') {
        const query = new URL(route.request().url()).searchParams;
        queries.push(query);
        result = {
          items: [
            {
              id: restarted && query.get('state') === 'running' ? 2 : 1,
              job_id: 2,
              database_id: 99,
              job_name: '订单汇总',
              target_database: 'analytics',
              target_table: 'orders',
              state:
                query.get('schema_conflicts') === 'true'
                  ? 'failed'
                  : query.get('state') || 'running',
              error_code:
                query.get('schema_conflicts') === 'true'
                  ? 'data_sync_source_schema_drift'
                  : null,
              operation: 'sync',
              started_at: 1_788_700_000,
              finished_at:
                query.get('state') === 'succeeded' ? 1_788_700_065 : null,
              read_rows: 12_000,
              written_rows: 10_000,
              bytes: 1_048_576,
            },
          ],
          total: 51,
        };
      } else if (path === '/data-sync/runs/1')
        result = {
          run: {
            id: 1,
            started_at: 1_788_700_000,
            finished_at: 1_788_700_065,
            state: 'failed',
            job_id: 2,
            read_rows: 12_000,
            written_rows: 10_000,
            error_code: 'data_sync_databend_write_failed',
            message:
              'databend_write_failed; server_code=1006; query_id=query-fixture-123',
          },
          sources: [
            {
              id: 1,
              binding_id: 7,
              phase: 'id',
              state: 'running',
              read_rows: 12_000,
              written_rows: 10_000,
              target_max_id: '9500',
            },
          ],
        };
      else if (path === '/data-sync/runs/1/batches')
        result = {
          items: [
            {
              id: 'batch-test',
              query_id: 'query-fixture-123',
              binding_id: 7,
              seq: 1,
              state: 'committed',
              read_rows: 10_000,
            },
          ],
          total: 1,
        };
      else if (path === '/data-sync/runs/1/cancel') {
        cancellations.push(path);
        result = { id: 10, status: 'cancelled' };
      }
      const text = JSON.stringify({ code: 200, msg: 'ok', result });
      await route.fulfill({
        contentType: 'application/json',
        body:
          route.request().headers().security === 'true'
            ? Buffer.from(KxEd.encryptText(text))
            : text,
      });
    });
  await page.goto('/');
  await page.locator("input[name='username']").fill('operator');
  await page.locator("input[name='password']").fill('test-only');
  await page.getByRole('button', { name: /登录|login/i }).click();
  await expect(page).toHaveURL(/data-sync\/runs/, { timeout: 30_000 });
  await expect(page.getByText('订单汇总', { exact: true })).toBeVisible();
  expect(queries[0]?.get('state')).toBe('running');
  await expect(
    page.getByRole('columnheader', { name: '本次同步总数', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('cell', { name: '10,000 条', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '停止全库', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: '停止本表', exact: true }).click();
  const cancel = page.getByRole('dialog', { name: '停止本表同步？' });
  await expect(cancel).toContainText('不影响其它表');
  await cancel.getByRole('button', { name: /停\s*止/ }).click();
  await expect
    .poll(() => cancellations)
    .toEqual(['/data-sync/jobs/2/state', '/data-sync/runs/1/cancel']);
  await expect(
    page.getByRole('columnheader', { name: '同步耗时', exact: true }),
  ).toBeVisible();
  await page.getByRole('tab', { name: '成功', exact: true }).click();
  await expect(
    page.getByRole('cell', { name: '1m5s', exact: true }),
  ).toBeVisible();
  await page.getByRole('tab', { name: '失败', exact: true }).click();
  await expect.poll(() => queries.at(-1)?.get('state')).toBe('failed');
  await expect
    .poll(() => queries.at(-1)?.get('schema_conflicts'))
    .toBe('false');
  await page.getByRole('tab', { name: '结构冲突', exact: true }).click();
  await expect.poll(() => queries.at(-1)?.get('schema_conflicts')).toBe('true');
  expect(queries.at(-1)?.has('state')).toBe(false);
  await expect(
    page.getByText('源表结构与已启用快照不一致', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '处理冲突', exact: true }),
  ).toBeVisible();
  await page.getByRole('textbox', { name: '搜索执行记录' }).fill('orders');
  await page.getByRole('textbox', { name: '搜索执行记录' }).press('Enter');
  await expect.poll(() => queries.at(-1)?.get('keyword')).toBe('orders');
  await page.locator('.ant-pagination-item-2').click();
  await expect.poll(() => queries.at(-1)?.get('page')).toBe('2');
  await page.getByRole('button', { name: /明\s*细/, exact: true }).click();
  const modal = page.getByRole('dialog', { name: '运行明细' });
  await expect(
    modal.getByText(
      'databend_write_failed; server_code=1006; query_id=query-fixture-123',
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    modal.getByText('query-fixture-123', { exact: true }),
  ).toBeVisible();
  await expect(
    modal.getByText(
      '本次同步总数：10,000 条；累计读取：12,000 条；同步耗时：1m5s',
      { exact: true },
    ),
  ).toBeVisible();
  await expect(modal.getByText('batch-test', { exact: true })).toBeVisible();
  await expect(page.getByText('登录成功', { exact: true })).toBeHidden();
  await page.screenshot({
    animations: 'disabled',
    path: info.outputPath('monitor-desktop.png'),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(async () => {
      const box = await modal.boundingBox();
      return box?.width ?? 1000;
    })
    .toBeLessThanOrEqual(390);
  await page.screenshot({
    animations: 'disabled',
    path: info.outputPath('monitor-mobile.png'),
    fullPage: true,
  });
  await modal.getByRole('button', { name: '关闭', exact: true }).click();
  await page.setViewportSize({ width: 1280, height: 844 });
  await page.getByRole('tab', { name: '已取消', exact: true }).click();
  await page.getByRole('button', { name: '重新启动', exact: true }).click();
  const restart = page.getByRole('dialog', { name: '重新启动同步？' });
  await expect(restart).toContainText('保留已取消记录 #1');
  await restart.getByRole('button', { name: '重新启动', exact: true }).click();
  await expect
    .poll(() => restartRequests)
    .toEqual(['/data-sync/databases/99/state', '/data-sync/databases/99/sync']);
  await expect(page.locator('tr[data-row-key="2"]')).toBeVisible();
  await page.getByRole('tab', { name: '已取消', exact: true }).click();
  await expect(page.locator('tr[data-row-key="1"]')).toBeVisible();
});
