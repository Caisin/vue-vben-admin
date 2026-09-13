import { Buffer } from 'node:buffer';

import { KxEd } from '@kx/admin-core';
import { expect, test } from '@playwright/test';
test.use({ headless: true });
for (const readonly of [false, true]) {
  test(`同步操作跨页预检与结果闭环${readonly ? '只读' : '执行'}`, async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const submits: Array<{
      request_id: string;
      action: string;
      targets: { id: number; stamp: string }[];
    }> = [];
    let opReads = 0;
    let firstFailure = true;
    const jobs = Array.from({ length: 21 }, (_, i) => ({
      id: i + 1,
      name: `同步对象${i + 1}`,
      target_database: 'analytics',
      target_table: `table_${i + 1}`,
      state: 'ready',
      version: 1,
      schedule_paused: false,
      active_revision_id: 1,
      active_run_id: null,
    }));
    const operation = {
      id: 91,
      action: 'sync',
      state: 'failed',
      total: 2,
      succeeded: 1,
      failed: 1,
      created_at: 1,
      task_id: 501,
    };
    const resultItems = [
      {
        id: 1,
        object_id: 1,
        kind: 'job',
        name: '同步对象1',
        target: 'analytics.table_1',
        state: 'succeeded',
        task_id: 601,
      },
      {
        id: 2,
        object_id: 2,
        kind: 'job',
        name: '同步对象2',
        target: 'analytics.table_2',
        state: 'failed',
        task_id: 602,
        error_code: 'data_sync_preflight_stale',
      },
    ];
    await page
      .context()
      .route('**/{auth,notify,param,data-sync}/**', async (route) => {
        const req = route.request();
        if (!['fetch', 'xhr'].includes(req.resourceType()))
          return route.continue();
        const url = new URL(req.url());
        const path = url.pathname.replace(/^\/api(?=\/)/, '');
        let result: unknown = null;
        let code = 200;
        const raw = req.postDataBuffer();
        const body = raw
          ? JSON.parse(
              req.headers().security === 'true'
                ? KxEd.decryptText(raw)
                : raw.toString(),
            )
          : {};
        if (path === '/auth/user/access_token')
          result = {
            access_token: 'test',
            uid: 7,
            exp_at: 4_102_444_800,
            exp_in: 3600,
          };
        else if (path === '/auth/user/user_info')
          result = {
            id: 7,
            name: '同步操作员',
            enabled: true,
            home_path: '/data-sync/jobs',
            is_guest: false,
            permission_count: 1,
          };
        else if (path === '/auth/per/codes')
          result = readonly ? [] : ['data-sync:execute'];
        else if (path === '/auth/menu/current')
          result = [
            {
              id: 1,
              pid: 0,
              name: 'DataSyncJobs',
              title: '同步任务',
              path: '/data-sync/jobs',
              component: '/data-sync/index',
              perm_type: 'menu',
              enabled: true,
              order_no: 1,
              meta: {},
            },
          ];
        else if (path === '/notify/inbox')
          result = { items: [], unread_count: 0 };
        else if (path === '/data-sync/instances') result = [];
        else if (path === '/data-sync/jobs') {
          const current = Number(url.searchParams.get('page') || 1);
          result = {
            items: jobs.slice((current - 1) * 20, current * 20),
            total: 21,
          };
        } else if (path === '/data-sync/bulk/preflight')
          result = {
            items: body.targets.map((t: { id: number; kind: string }) => ({
              ...t,
              name: `同步对象${t.id}`,
              target: `analytics.table_${t.id}`,
              state: t.id === 21 ? 'blocked' : 'ready',
              configuration: 'active',
              schedule_paused: false,
              version: 1,
              stamp: 'a'.repeat(64),
              pending_batches: t.id === 21 ? 1 : 0,
              actions: [
                {
                  action: body.action,
                  allowed: t.id !== 21,
                  reason: t.id === 21 ? '请先完成回执对账' : null,
                },
              ],
            })),
            rejected: [],
          };
        else if (path === '/data-sync/bulk/actions') {
          submits.push(body);
          if (firstFailure) {
            firstFailure = false;
            code = 500;
          } else
            result = {
              ...operation,
              state: 'running',
              succeeded: 0,
              failed: 0,
            };
        } else if (path === '/data-sync/operations/91') {
          opReads++;
          result =
            opReads < 2
              ? { ...operation, state: 'running', succeeded: 0, failed: 0 }
              : operation;
        } else if (path === '/data-sync/operations/91/items') {
          const state = url.searchParams.get('state');
          const items = resultItems.filter((i) => !state || i.state === state);
          result = { items, total: items.length };
        } else if (path === '/data-sync/operations')
          result = {
            items: readonly ? [] : [operation],
            total: readonly ? 0 : 1,
          };
        const value = JSON.stringify({
          code,
          msg: code === 500 ? '提交响应丢失，请重试' : 'ok',
          result,
        });
        await route.fulfill({
          contentType: 'application/json',
          body:
            req.headers().security === 'true'
              ? Buffer.from(KxEd.encryptText(value))
              : value,
        });
      });
    await page.goto('/');
    await page.locator("input[name='username']").fill('test');
    await page.locator("input[name='password']").fill('test');
    await page.getByRole('button', { name: /登录|login/i }).click();
    await expect(
      page.getByRole('link', { name: '同步对象1', exact: true }),
    ).toBeVisible();
    if (readonly) {
      await expect(page.getByRole('checkbox')).toHaveCount(0);
      await expect(page.getByRole('button', { name: /操作预检/ })).toHaveCount(
        0,
      );
      await page.getByRole('button', { name: '操作记录', exact: true }).click();
      await expect(
        page.getByRole('dialog', { name: '同步操作记录' }),
      ).toBeVisible();
      expect(submits).toHaveLength(0);
      return;
    }
    await page.locator('tr[data-row-key="1"]').getByRole('checkbox').check();
    await page.locator('tr[data-row-key="2"]').getByRole('checkbox').check();
    await page.locator('.ant-pagination-next').click();
    await page.locator('tr[data-row-key="21"]').getByRole('checkbox').check();
    await page.getByRole('button', { name: '操作预检（3）' }).click();
    const modal = page.getByRole('dialog', { name: '同步操作预检' });
    await modal.getByRole('button', { name: '检查可执行性' }).click();
    await expect(modal.getByText('2 项可执行，1 项不会提交')).toBeVisible();
    await expect(
      modal.getByText('请先完成回执对账', { exact: true }),
    ).toBeVisible();
    await modal.getByRole('button', { name: '确认同步一次（2项）' }).click();
    await expect(
      modal.getByText('提交响应丢失，请重试', { exact: true }),
    ).toBeVisible();
    await modal.getByRole('button', { name: '确认同步一次（2项）' }).click();
    const results = page.getByRole('dialog', { name: '操作进度与结果' });
    await expect(results.getByText('成功 1 / 未完成 1 / 总计 2')).toBeVisible();
    expect(submits).toHaveLength(2);
    expect(submits[0]?.request_id).toBe(submits[1]?.request_id);
    expect(submits[1]?.targets.map((t) => t.id)).toEqual([1, 2]);
    await expect(
      results.getByText('配置或状态已变化。重新预检并确认，不沿用旧计划。'),
    ).toBeVisible();
    await results.getByRole('button', { name: '重新预检未完成项' }).click();
    await expect(modal.getByText('已选择 1 个对象')).toBeVisible();
    await modal.getByRole('button', { name: '检查可执行性' }).click();
    await expect(modal.getByText('1 项可执行，0 项不会提交')).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: test.info().outputPath('sync-operations-mobile.png'),
      fullPage: true,
    });
  });
}
