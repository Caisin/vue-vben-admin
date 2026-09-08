import { Buffer } from 'node:buffer';

import { KxEd } from '@kx/admin-core';
import { expect, test } from '@playwright/test';

test.use({ headless: true });
for (const scenario of ['只读', '操作', '强停']) {
  const readonly = scenario === '只读';
  test(`同步启停范围${scenario}隔离`, async ({ page }, info) => {
    const writes: { body: Record<string, unknown>; path: string }[] = [];
    const jobs = [1, 2].map((id) => ({
      id,
      name: id === 1 ? '独立订单' : '托管订单',
      code: `job${id}`,
      database_id: id === 2 ? 10 : null,
      target_database: 'analytics',
      target_table: `orders${id}`,
      state: 'ready',
      schedule_paused: false,
      active_run_id: null as null | number,
      version: 1,
      active_revision_id: 1,
    }));
    const database = {
      last_task_id: 300,
      schedule_paused: false,
      version: 1,
      id: 10,
      name: '订单全库',
      state: 'ready',
      active_task_id: null as null | number,
      total_tables: 2,
      completed_tables: 0,
      failed_tables: 0,
    };
    const [independentJob, managedJob] = jobs;
    if (!independentJob || !managedJob) throw new Error('缺少同步任务 fixture');
    if (readonly) {
      Object.assign(independentJob, { state: 'running', active_run_id: 101 });
      Object.assign(database, { state: 'running', active_task_id: 300 });
    }
    let failStop = false;
    const forceReads = new Map<number, number>();
    await page
      .context()
      .route('**/{auth,notify,param,data-sync}/**', async (route) => {
        const request = route.request();
        if (!['fetch', 'xhr'].includes(request.resourceType()))
          return route.continue();
        const path = new URL(request.url()).pathname.replace(
          /^\/api(?=\/)/,
          '',
        );
        let result: unknown = null;
        let code = 200;
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
            name: '操作员',
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
              name: 'DataSync',
              title: '数据同步',
              path: '/data-sync',
              component: 'BasicLayout',
              perm_type: 'catalog',
              enabled: true,
              order_no: 1,
              auth_code: '',
              meta: {},
              redirect: '/data-sync/jobs',
            },
            {
              id: 2,
              pid: 1,
              name: 'DataSyncJobs',
              title: '同步任务',
              path: '/data-sync/jobs',
              component: '/data-sync/index',
              perm_type: 'menu',
              enabled: true,
              order_no: 1,
              auth_code: '',
              meta: {},
            },
          ];
        else if (path === '/notify/inbox')
          result = { items: [], unread_count: 0 };
        else if (path === '/data-sync/instances') result = [];
        else if (path === '/data-sync/jobs')
          result = { items: jobs, total: jobs.length };
        else if (path === '/data-sync/databases')
          result = { items: [database], total: 1 };
        else if (/\/tasks\/70[123]$/.test(path)) {
          const id = Number(path.split('/').at(-1));
          const reads = (forceReads.get(id) ?? 0) + 1;
          forceReads.set(id, reads);
          const done = reads >= 2;
          if (done && id === 701)
            Object.assign(independentJob, {
              state: 'paused',
              active_run_id: null,
              schedule_paused: true,
            });
          if (done && id === 702)
            Object.assign(database, {
              state: 'blocked',
              active_task_id: null,
              last_task_id: id,
              schedule_paused: true,
              failed_tables: 1,
            });
          const finishedMessages: Record<number, string> = {
            701: '已强制停止并解除占用',
            702: '已强制停止，1 张表存在待对账批次',
            703: 'data_sync_force_stop_stale',
          };
          let status = 'running';
          if (done) status = id === 703 ? 'failed' : 'succeeded';
          result = {
            id,
            status,
            total_count: 1,
            succeeded_count: done ? 1 : 0,
            message: done
              ? finishedMessages[id]
              : '发布权已撤销，等待原执行者退出',
          };
        } else if (
          path === '/data-sync/databases/10' &&
          request.method() === 'GET'
        )
          result = database;
        else if (['POST', 'PUT'].includes(request.method())) {
          const raw = request.postDataBuffer();
          let payload = '{}';
          if (raw)
            payload =
              request.headers().security === 'true'
                ? KxEd.decodeText(KxEd.decrypt(raw))
                : raw.toString();
          const body = JSON.parse(payload);
          writes.push({ path, body });
          if (path.endsWith('/force-stop')) {
            let id = 703;
            if (path.includes('/databases/')) id = 702;
            else if (path.includes('/jobs/1/')) id = 701;
            result = {
              id,
              status: 'queued',
              message: '强停请求已提交',
            };
          } else {
            if (path === '/data-sync/jobs/1/sync')
              Object.assign(independentJob, {
                state: 'running',
                active_run_id: 101,
              });
            if (path === '/data-sync/databases/10/sync') {
              if (body.target_table)
                Object.assign(managedJob, {
                  state: 'running',
                  active_run_id: 102,
                });
              else
                Object.assign(database, {
                  state: 'running',
                  active_task_id: 300,
                });
            }
            if (path === '/data-sync/runs/101/cancel')
              Object.assign(independentJob, {
                state: 'ready',
                active_run_id: null,
              });
            if (path === '/data-sync/runs/102/cancel') {
              if (failStop) code = 400;
              else
                Object.assign(managedJob, {
                  state: 'ready',
                  active_run_id: null,
                });
            }
            if (path === '/data-sync/databases/10/cancel')
              Object.assign(database, { state: 'ready', active_task_id: null });
            if (path === '/data-sync/jobs/1/state') {
              independentJob.schedule_paused = body.paused;
              independentJob.version += 1;
              result = independentJob;
            } else if (path === '/data-sync/jobs/2/state') {
              managedJob.schedule_paused = body.paused;
              managedJob.version += 1;
              result = managedJob;
            } else if (path === '/data-sync/databases/10/state') {
              database.schedule_paused = body.paused;
              database.version += 1;
              result = database;
            } else result = { id: 300, status: 'running' };
          }
        }
        const text = JSON.stringify({
          code,
          msg: code === 200 ? 'ok' : '停止请求失败',
          result,
        });
        await route.fulfill({
          contentType: 'application/json',
          body:
            request.headers().security === 'true'
              ? Buffer.from(KxEd.encryptText(text))
              : text,
        });
      });
    await page.goto('/');
    await page.locator("input[name='username']").fill('operator');
    await page.locator("input[name='password']").fill('test-only');
    await page.getByRole('button', { name: /登录|login/i }).click();
    await expect(page).toHaveURL(/data-sync\/jobs/);
    await expect(page.getByText('独立订单', { exact: true })).toBeVisible();
    if (readonly) {
      await expect(
        page.getByRole('button', { name: /启动本表|停止本表|所属全库操作/ }),
      ).toHaveCount(0);
      await page.getByRole('tab', { name: '全库同步', exact: true }).click();
      await expect(page.getByText('订单全库', { exact: true })).toBeVisible();
      await expect(
        page.getByRole('button', { name: /启动全库|停止全库/ }),
      ).toHaveCount(0);
      expect(writes).toHaveLength(0);
      return;
    }
    const independent = page.locator('tr[data-row-key="1"]');
    const managed = page.locator('tr[data-row-key="2"]');
    if (scenario === '强停') {
      await independent
        .getByRole('button', { name: '启动本表同步', exact: true })
        .click();
      await expect(
        independent.getByRole('button', { name: '强制停止本表同步' }),
      ).toBeVisible();
      await independent
        .getByRole('button', { name: '强制停止本表同步' })
        .click();
      let confirm = page.getByRole('dialog', { name: '强制停止本表同步？' });
      await confirm.getByRole('button', { name: /取\s*消/ }).click();
      expect(writes.some((write) => write.path.endsWith('/force-stop'))).toBe(
        false,
      );
      await independent
        .getByRole('button', { name: '强制停止本表同步' })
        .click();
      confirm = page.getByRole('dialog', { name: '强制停止本表同步？' });
      await confirm
        .getByRole('button', { name: '强制停止', exact: true })
        .click();
      const progress = page.getByRole('dialog', { name: '强制停止进度' });
      await expect(progress).toContainText('等待原执行者退出');
      await expect(progress).toContainText('已强制停止并解除占用');
      expect(writes.at(-1)).toEqual({
        path: '/data-sync/jobs/1/force-stop',
        body: { run_id: 101 },
      });
      expect(managedJob.schedule_paused).toBe(false);
      await progress.getByRole('button', { name: '关闭', exact: true }).click();
      await expect(
        independent.getByRole('button', { name: '启动本表同步', exact: true }),
      ).toBeEnabled();
      await managed
        .getByRole('button', { name: '启动本表同步', exact: true })
        .click();
      await managed.getByRole('button', { name: '强制停止本表同步' }).click();
      await page
        .getByRole('dialog', { name: '强制停止本表同步？' })
        .getByRole('button', { name: '强制停止', exact: true })
        .click();
      await expect(progress).toContainText('data_sync_force_stop_stale');
      await progress.getByRole('button', { name: '关闭', exact: true }).click();
      await page.getByRole('tab', { name: '全库同步', exact: true }).click();
      await page
        .getByRole('button', { name: '启动全库同步', exact: true })
        .click();
      await page
        .getByRole('dialog', { name: '启动全库同步？' })
        .getByRole('button', { name: /启\s*动/ })
        .click();
      await page
        .getByRole('button', { name: '强制停止全库同步', exact: true })
        .click();
      await page
        .getByRole('dialog', { name: '强制停止全库同步？' })
        .getByRole('button', { name: '强制停止', exact: true })
        .click();
      await expect(progress).toContainText('1 张表存在待对账批次');
      expect(writes.at(-1)).toEqual({
        path: '/data-sync/databases/10/force-stop',
        body: { task_id: 300 },
      });
      await page.setViewportSize({ width: 390, height: 844 });
      await progress.screenshot({
        path: info.outputPath('force-stop-mobile.png'),
        animations: 'disabled',
      });
      return;
    }
    await expect(
      independent.getByRole('button', { name: '停止本表同步', exact: true }),
    ).toBeEnabled();
    await independent
      .getByRole('button', { name: '停止本表同步', exact: true })
      .click();
    await page
      .getByRole('dialog', { name: '停止本表同步？' })
      .getByRole('button', { name: /停\s*止/ })
      .click();
    await expect(
      independent.getByText('调度已停止', { exact: true }),
    ).toBeVisible();
    await expect(
      independent.getByRole('button', { name: '停止本表同步', exact: true }),
    ).toBeDisabled();
    expect(writes.at(-1)).toEqual({
      path: '/data-sync/jobs/1/state',
      body: { paused: true, version: 0 },
    });
    await independent.getByRole('button', { name: '启动本表同步' }).click();
    await expect.poll(() => independentJob.schedule_paused).toBe(false);
    await expect.poll(() => writes.at(-1)?.path).toBe('/data-sync/jobs/1/sync');
    expect(writes.at(-2)?.body.paused).toBe(false);
    await expect(
      independent.getByRole('button', { name: '停止本表同步', exact: true }),
    ).toBeEnabled();
    await independent
      .getByRole('button', { name: '停止本表同步', exact: true })
      .click();
    await page
      .getByRole('dialog', { name: '停止本表同步？' })
      .getByRole('button', { name: /停\s*止/ })
      .click();
    await expect(
      independent.getByRole('button', { name: '启动本表同步' }),
    ).toBeEnabled();
    await managed.getByRole('button', { name: '启动本表同步' }).click();
    await expect(
      managed.getByRole('button', { name: '停止本表同步', exact: true }),
    ).toBeEnabled();
    expect(writes.at(-1)).toEqual({
      path: '/data-sync/databases/10/sync',
      body: { target_table: 'orders2' },
    });
    const beforeCancel = writes.length;
    await managed
      .getByRole('button', { name: '停止本表同步', exact: true })
      .click();
    await page
      .getByRole('dialog', { name: '停止本表同步？' })
      .getByRole('button', { name: /取\s*消/ })
      .click();
    expect(writes).toHaveLength(beforeCancel);
    failStop = true;
    await managed
      .getByRole('button', { name: '停止本表同步', exact: true })
      .click();
    await page
      .getByRole('dialog', { name: '停止本表同步？' })
      .getByRole('button', { name: /停\s*止/ })
      .click();
    await expect(
      page.getByText('停止请求失败', { exact: true }).first(),
    ).toBeVisible();
    failStop = false;
    expect(managedJob.schedule_paused).toBe(true);
    await expect(
      page.getByText('本表后续调度已停止，但本次运行停止失败，请重试', {
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole('dialog', { name: '停止本表同步？' })
      .getByRole('button', { name: /停\s*止/ })
      .click();
    await expect(
      managed.getByRole('button', { name: '启动本表同步' }),
    ).toBeEnabled();
    expect(writes.at(-1)?.path).toBe('/data-sync/runs/102/cancel');
    await managed.getByRole('button', { name: '所属全库操作' }).click();
    await page.getByRole('menuitem', { name: '启动所属全库同步' }).click();
    await page
      .getByRole('dialog', { name: '启动所属全库同步？' })
      .getByRole('button', { name: /启\s*动/ })
      .click();
    await expect
      .poll(() => writes.at(-1))
      .toEqual({ path: '/data-sync/databases/10/sync', body: {} });
    await managed.getByRole('button', { name: '所属全库操作' }).click();
    await page.getByRole('menuitem', { name: '停止所属全库同步' }).click();
    await page
      .getByRole('dialog', { name: '停止所属全库同步？' })
      .getByRole('button', { name: /停\s*止/ })
      .click();
    await expect
      .poll(() => writes.at(-1)?.path)
      .toBe('/data-sync/databases/10/cancel');
    expect(database.schedule_paused).toBe(true);
    expect(managedJob.schedule_paused).toBe(true);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('.ant-message-notice')).toHaveCount(0);
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await page.waitForTimeout(500);
      await managed
        .getByRole('button', { name: '停止本表同步', exact: true })
        .scrollIntoViewIfNeeded();
      await page.screenshot({
        animations: 'disabled',
        path: info.outputPath(`controls-${width}.png`),
        fullPage: true,
      });
    }
    await page.getByRole('tab', { name: '全库同步', exact: true }).click();
    await page
      .getByRole('button', { name: '启动全库同步', exact: true })
      .click();
    await page
      .getByRole('dialog', { name: '启动全库同步？' })
      .getByRole('button', { name: /启\s*动/ })
      .click();
    await expect(
      page.getByRole('button', { name: '停止全库同步', exact: true }),
    ).toBeEnabled();
    await page
      .getByRole('button', { name: '停止全库同步', exact: true })
      .click();
    await page
      .getByRole('dialog', { name: '停止全库同步？' })
      .getByRole('button', { name: /停\s*止/ })
      .click();
    await expect(
      page.getByRole('button', { name: '启动全库同步', exact: true }),
    ).toBeEnabled();
  });
}
