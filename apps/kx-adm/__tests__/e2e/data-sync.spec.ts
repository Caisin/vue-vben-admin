import type { Request, Route } from '@playwright/test';

import type { DatabaseSync } from '../../src/api/data-sync-database';

import { Buffer } from 'node:buffer';

import { KxEd } from '@kx/admin-core';
import { expect, test } from '@playwright/test';

test.use({ headless: true });
for (const readonly of [false, true]) {
  test(`数据同步${readonly ? '只读权限' : '配置与进度'}闭环`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000);
    let edited = false;
    let inspected = false;
    let metadataSelections = false;
    let orderColumnReads = 0;
    let failed = false;
    const config = {
      mode: 'id_and_time',
      storage_code: 'private',
      sources: [
        {
          instance_code: 'shop_east_01',
          schema: 'public',
          table: 'orders',
          id_column: 'id',
          updated_column: 'updated_at',
          source_timezone: 'UTC',
          soft_delete_column: null,
          fields: [],
        },
      ],
      limits: {
        id_span: 10_000,
        max_rows: 5000,
        max_bytes: 16_777_216,
        source_concurrency: 4,
        overlap_seconds: 600,
        settle_delay_seconds: 60,
      },
    };
    const job = () => ({
      id: 1,
      code: 'job1',
      name: edited ? '订单汇总已修改' : '订单汇总',
      target_ds_code: 'bend',
      target_database: 'analytics',
      target_table: 'orders',
      warehouse: null,
      allow_insecure: false,
      state: failed ? 'blocked' : 'ready',
      version: 1,
      active_revision_id: 1,
      draft_revision_id: 1,
      active_run_id: failed ? 2 : null,
      last_error: failed ? 'data_sync_commit_unknown' : null,
    });
    let databaseSaved = false;
    let databaseSaveCount = 0;
    const syncTargets: (string | undefined)[] = [];
    let expanded = false;
    const initialBinding = config.sources[0];
    if (!initialBinding) throw new Error('缺少源测试数据');
    let failWarehouseNext = false;
    let delayWarehouseNext = false;
    let unavailableWarehouseNext = false;
    const database: DatabaseSync = {
      id: 10,
      name: '全库策略测试',
      state: 'draft',
      version: 1,
      plan: [],
      plan_hash: null,
      active_task_id: null,
      last_task_id: null,
      total_tables: 2,
      completed_tables: 0,
      failed_tables: 0,
      last_error: null,
      config: {
        name: '全库策略测试',
        target_ds_code: 'bend',
        target_database: 'analytics',
        warehouse: null,
        allow_insecure: false,
        storage_code: 'private',
        table_prefix: '',
        schema_prefix: false,
        sources: [{ instance_code: 'shop_east_01', schema: 'public' }],
        tables: [
          {
            target_table: 'parameters',
            source_comments: [
              {
                instance_code: 'shop_east_01',
                schema: 'public',
                table: 'parameters',
                comment: '系统参数配置',
              },
            ],
            confirmed: false,
            excluded_reason: null,
            config: {
              ...config,
              mode: 'full_table',
              sources: [
                {
                  ...initialBinding,
                  table: 'parameters',
                  id_column: null,
                  updated_column: null,
                },
              ],
            },
          },
          {
            target_table: 'orders',
            confirmed: true,
            excluded_reason: null,
            config: { ...config, mode: 'id_and_time' },
          },
        ],
      },
    };
    for (const target of [
      ...Array.from({ length: 23 }, (_, i) => `lookup_${i}`),
      'orders_archive',
    ]) {
      database.config.tables.push({
        target_table: target,
        confirmed: true,
        excluded_reason: null,
        config: {
          ...config,
          mode: 'full_table',
          sources: [
            {
              ...initialBinding,
              table: target,
              id_column: null,
              updated_column: null,
            },
          ],
        },
      });
    }
    database.total_tables = database.config.tables.length;
    database.failed_tables = 2;
    database.last_error = 'data_sync_database_tables_failed';
    database.plan = ['orders', 'orders_archive'].map((target_table) => ({
      target_table,
      state: 'failed',
      error: 'data_sync_reserved_column',
      job_id: null,
      revision_id: null,
      plan_hash: null,
    }));
    const instances = [
      {
        code: 'shop_west_01',
        ds_code: 'pg',
        name: '华西门店',
        enabled: true,
        version: 1,
        allow_insecure: false,
      },
      {
        code: 'shop_east_01',
        ds_code: 'pg',
        name: '华东门店',
        enabled: true,
        version: 1,
        allow_insecure: false,
      },
    ];
    const schema = {
      primary_key_column: 'id',
      schema_hash: 'hash',
      warnings: [],
      ddl: 'CREATE TABLE analytics.orders (instance_code STRING NOT NULL, id BIGINT NOT NULL)',
      target_columns: [
        {
          name: 'id',
          data_type: { kind: 'int64' },
          nullable: false,
          comment: '源主键',
        },
      ],
      bindings: [
        {
          binding_id: 1,
          instance_code: 'shop_east_01',
          source_columns: [
            {
              name: 'id',
              data_type: 'bigint',
              primary_key: true,
              nullable: false,
            },
          ],
        },
      ],
    };
    const revision = () => ({
      id: 1,
      revision_no: 1,
      config,
      state: inspected ? 'validated' : 'draft',
      plan_hash: inspected ? 'approved' : null,
      schema_plan: inspected ? schema : null,
    });
    const run = () => ({
      id: 2,
      task_run_id: 3,
      job_id: 1,
      operation: 'sync',
      state: failed ? 'blocked' : 'succeeded',
      read_rows: 120,
      written_rows: 120,
      bytes: 1000,
      error_code: failed ? 'data_sync_commit_unknown' : null,
      started_at: 1,
    });
    const pageResult = (items: unknown[]) => ({
      items,
      total: items.length,
      page_no: 1,
      page_size: 20,
      pages: 1,
    });
    await page
      .context()
      .route(
        '**/{auth,notify,param,adm,storage,data-sync}/**',
        async (route) => {
          if (!['fetch', 'xhr'].includes(route.request().resourceType())) {
            await route.continue();
            return;
          }
          const path = new URL(route.request().url()).pathname.replace(
            /^\/api(?=\/)/,
            '',
          );
          const method = route.request().method();
          let result: unknown = null;
          if (path === '/auth/user/access_token')
            result = {
              access_token: 'e2e-token',
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
              home_path: '/data-sync/jobs',
              avatar: '',
              permission_count: 1,
              is_guest: false,
            };
          else if (path === '/auth/per/codes')
            result = readonly
              ? []
              : ['data-sync:configure', 'data-sync:execute'];
          else if (path === '/auth/menu/current')
            result = [
              {
                id: 1,
                pid: 0,
                name: 'System',
                title: '系统管理',
                path: '/system',
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
                title: '数据同步',
                path: '/data-sync/jobs',
                component: '/data-sync/index',
                perm_type: 'menu',
                enabled: true,
                order_no: 1,
                auth_code: '',
                meta: {},
                redirect: null,
              },
            ];
          else if (path === '/notify/inbox')
            result = { items: [], unread_count: 0 };
          else if (path === '/data-sync/databases')
            result = pageResult([database]);
          else if (path === '/data-sync/databases/10' && method === 'PUT') {
            const req = requestBody(route.request());
            expect(req.tables[0].config.mode).toBe('full_table');
            if (!expanded)
              expect(
                req.tables.every(
                  (table: { confirmed: boolean }) => table.confirmed,
                ),
              ).toBe(databaseSaveCount > 0);
            databaseSaveCount++;
            expect(req.tables[0].config.sources[0].id_column).toBeNull();
            expect(req.tables[1].config.mode).toBe('id_and_time');
            expect(req.tables).toHaveLength(expanded ? 27 : 26);
            expect(req.tables[1].config.limits.max_rows).toBe(2500);
            expect(req.tables[1].sync_interval_seconds).toBe(7200);
            expect(req.tables[1].existing_job_id).toBe(1);
            expect(req.warehouse).toBe('query one');
            database.config = req;
            database.version++;
            databaseSaved = true;
            result = database;
          } else if (path === '/data-sync/databases/10') result = database;
          else if (path === '/data-sync/databases/10/schedule') result = null;
          else if (path.startsWith('/data-sync/databases/10/tasks/'))
            result = { id: database.last_task_id, status: 'succeeded' };
          else if (path === '/data-sync/databases/10/discover') {
            expanded = true;
            database.last_task_id = 94;
            database.state = 'draft';
            database.plan = [];
            database.plan_hash = null;
            database.config.tables = database.config.tables.map((table) => ({
              ...table,
              confirmed: false,
              config: {
                ...table.config,
                sources: [
                  ...table.config.sources,
                  { ...table.config.sources[0], instance_code: 'shop_west_01' },
                ],
              },
            }));
            result = { id: 94, status: 'succeeded' };
          } else if (path === '/data-sync/databases/10/inspect') {
            database.state = 'validated';
            database.plan_hash = 'database-approved';
            database.completed_tables = 2;
            database.last_error = null;
            database.failed_tables = 0;
            database.last_task_id = 91;
            database.plan = database.config.tables.map((t) => {
              let state = t.confirmed ? 'succeeded' : 'unconfirmed';
              if (t.excluded_reason !== null) state = 'excluded';
              return {
                target_table: t.target_table,
                job_id: 1,
                revision_id: 1,
                plan_hash: 'table-approved',
                state,
                error: null,
              };
            });
            result = { id: 91, status: 'succeeded' };
          } else if (path === '/data-sync/databases/10/activate') {
            database.state = 'ready';
            database.last_task_id = 92;
            result = { id: 92, status: 'succeeded' };
          } else if (path === '/data-sync/databases/10/sync') {
            syncTargets.push(requestBody(route.request()).target_table);
            database.state = 'ready';
            database.last_task_id = 93;
            result = { id: 93, status: 'succeeded' };
          } else if (path === '/data-sync/jobs' && method === 'GET')
            result = pageResult([job()]);
          else if (path === '/data-sync/instances') result = instances;
          else if (path.endsWith('/schemas'))
            result = {
              items: [{ value: 'public', label: 'public' }],
              has_more: false,
            };
          else if (path.endsWith('/tables'))
            result = {
              items: [
                { value: 'orders', label: 'orders' },
                { value: 'events', label: 'events' },
              ],
              has_more: false,
            };
          else if (path.endsWith('/columns')) {
            const events =
              new URL(route.request().url()).searchParams.get('table') ===
              'events';
            if (!events && ++orderColumnReads === 2)
              await new Promise((resolve) => setTimeout(resolve, 600));
            result = [
              {
                name: events ? 'record_id' : 'id',
                data_type: 'bigint',
                primary_key: true,
                nullable: false,
                comment: '',
              },
              {
                name: 'updated_at',
                data_type: 'timestamp',
                primary_key: false,
                nullable: false,
                comment: '',
              },
              {
                name: 'deleted',
                data_type: 'boolean',
                primary_key: false,
                nullable: false,
                comment: '',
              },
            ];
          } else if (path === '/data-sync/target-warehouses') {
            const req = requestBody(route.request());
            expect(req).not.toHaveProperty('warehouse');
            if (failWarehouseNext) {
              failWarehouseNext = false;
              await route.abort('failed');
              return;
            }
            const delayed = delayWarehouseNext;
            const unavailable = unavailableWarehouseNext || delayed;
            delayWarehouseNext = false;
            unavailableWarehouseNext = false;
            if (delayed)
              await new Promise((resolve) => setTimeout(resolve, 600));
            const names =
              req.ds_code === 'bend_second'
                ? ['other-wh']
                : ['sync-warehouse', 'query one'];
            result = {
              items: unavailable
                ? []
                : names
                    .filter((name) => name.includes(req.keyword ?? ''))
                    .map((value) => ({ value, label: value })),
              has_more: false,
              availability: unavailable ? 'license_unavailable' : 'available',
            };
          } else if (path === '/data-sync/target-databases')
            result = {
              items: [{ value: 'analytics', label: 'analytics' }],
              has_more: false,
            };
          else if (path === '/data-sync/jobs' && method === 'POST') {
            const req = requestBody(route.request());
            expect(req.target_database).toBe('analytics');
            expect(req.warehouse).toBeNull();
            expect(req.config.sources[0].table).toBe('events');
            expect(req.config.sources[0].id_column).toBe('record_id');
            expect(req.config.sources[0].updated_column).toBe(
              'custom_changed_at',
            );
            expect(req.allow_insecure).toBe(true);
            metadataSelections = true;
            result = job();
          } else if (path === '/data-sync/jobs/1' && method === 'PUT') {
            edited = true;
            result = job();
          } else if (path === '/data-sync/jobs/1')
            result = {
              job: job(),
              draft: revision(),
              active: { ...revision(), schema_plan: schema },
              instances,
              checkpoints: [
                {
                  binding_id: 1,
                  confirmed_id: '9007199254740993',
                  baseline_done: true,
                  closed_time_end: '2026-09-05 00:00:00',
                  next_seq: 3,
                },
              ],
            };
          else if (path === '/data-sync/jobs/1/inspect') {
            inspected = true;
            result = { id: 4, status: 'queued' };
          } else if (path === '/data-sync/jobs/1/sync') {
            failed = true;
            result = { id: 3, status: 'running' };
          } else if (path === '/data-sync/jobs/1/runs')
            result = pageResult([run()]);
          else if (path === '/data-sync/runs/2')
            result = {
              run: run(),
              sources: [
                {
                  id: 1,
                  binding_id: 1,
                  phase: 'time',
                  state: failed ? 'blocked' : 'succeeded',
                  read_rows: 120,
                  written_rows: 120,
                  batches: 2,
                  target_max_id: '9007199254740993',
                },
              ],
            };
          else if (path === '/data-sync/runs/2/batches')
            result = pageResult([
              {
                id: 'batch1',
                binding_id: 1,
                seq: 1,
                state: 'committed',
                read_rows: 120,
                written_rows: 120,
                bytes: 1000,
              },
            ]);
          else if (path === '/adm/data-sources')
            result = pageResult([
              {
                ds_code: 'pg',
                name: '门店 PG',
                db_type: 'postgres',
                state: true,
              },
              {
                ds_code: 'bend',
                name: 'Databend',
                db_type: 'databend',
                state: true,
              },
              {
                ds_code: 'bend_second',
                name: 'Databend Second',
                db_type: 'databend',
                state: true,
              },
            ]);
          else if (path === '/storage/cfg')
            result = pageResult([
              {
                code: 'private',
                storage_name: '私有批次存储',
                is_public: false,
              },
            ]);
          await fulfillApi(route, result);
        },
      );
    await page.goto('/');
    await page.locator("input[name='username']").fill('sync');
    await page.locator("input[name='password']").fill('e2e-placeholder');
    await page.getByRole('button', { name: /登录|login/i }).click();
    await expect(page).toHaveURL(/\/data-sync\/jobs/, { timeout: 30_000 });
    await expect(
      page.getByRole('link', { name: '订单汇总', exact: true }),
    ).toBeVisible();
    await page.getByRole('tab', { name: '全库同步', exact: true }).click();
    if (!readonly) {
      await page
        .getByRole('button', { name: '新增全库配置', exact: true })
        .click();
      const fresh = page.getByRole('dialog', { name: '新增全库同步配置' });
      await expect(
        fresh.getByRole('checkbox', { name: '允许不加密的目标连接' }),
      ).toBeChecked();
      await fresh.getByRole('button', { name: '关闭', exact: true }).click();
    }
    await page.getByText('全库策略测试', { exact: true }).click();
    const databaseEditor = page.getByRole('dialog', { name: '全库策略测试' });
    await expect(
      databaseEditor.getByText('parameters', { exact: true }).first(),
    ).toBeVisible();
    const sourceTable = databaseEditor
      .locator('.source-table-name')
      .filter({ hasText: 'parameters' });
    await expect(sourceTable).toHaveText('parameters');
    await sourceTable.hover();
    const comment = page
      .getByRole('tooltip')
      .filter({ hasText: '系统参数配置' });
    await expect(comment).toBeVisible();
    await expect(comment).toBeInViewport();
    await page.screenshot({
      path: testInfo.outputPath('source-table-comment.png'),
      fullPage: true,
    });
    await page.mouse.move(0, 0);
    const tableSearch = databaseEditor.getByRole('textbox', {
      name: '搜索逐表同步策略',
    });
    const strategies = databaseEditor.locator('.strategy-table');
    const strategyRows = strategies.locator('tbody tr[data-row-key]');
    await strategies.locator('.ant-pagination-item-2').click();
    await expect(strategyRows).toHaveCount(6);
    await tableSearch.fill(' 系统参数 ');
    await expect(strategyRows).toHaveCount(1);
    await expect(strategyRows).toContainText('parameters');
    await tableSearch.fill('不存在的表');
    await expect(strategyRows).toHaveCount(0);
    await expect(strategies).toContainText('没有匹配的表');
    await tableSearch.fill('ORDERS');
    await expect(strategyRows).toHaveCount(2);
    if (!readonly) {
      await strategyRows.first().getByRole('checkbox').first().check();
      await expect(
        databaseEditor.getByRole('button', { name: '应用到所选表' }),
      ).toBeEnabled();
    }
    await tableSearch.fill('同步标识重名');
    if (!readonly)
      await expect(
        databaseEditor.getByRole('button', { name: '应用到所选表' }),
      ).toBeDisabled();
    await expect(strategyRows).toHaveCount(2);
    await tableSearch.fill('');
    await databaseEditor.getByRole('checkbox', { name: /仅看错误表/ }).check();
    await expect(strategyRows).toHaveCount(2);
    await databaseEditor
      .getByRole('button', { name: '定位错误表 orders', exact: true })
      .click();
    await expect(tableSearch).toHaveValue('orders');
    await expect(strategyRows).toHaveCount(1);
    await expect(strategyRows).toHaveAttribute('data-row-key', 'orders');
    await expect(
      databaseEditor.getByRole('heading', { name: '逐表同步策略' }),
    ).toBeInViewport();
    if (!readonly) {
      await strategyRows
        .getByRole('button', { name: '配置', exact: true })
        .click();
      const tableEditor = page.getByRole('dialog', {
        name: 'orders',
        exact: true,
      });
      await expect(tableEditor.getByRole('alert')).toContainText(
        '同步标识重名',
      );
      await tableEditor.getByRole('combobox', { name: '已有同步任务' }).click();
      await page.getByTitle('订单汇总 (#1)', { exact: true }).click();
      await expect(
        tableEditor.getByRole('button', { name: '确认本表配置' }),
      ).toBeEnabled();
      await tableEditor
        .getByRole('checkbox', { name: '跟随全库定时' })
        .uncheck();
      await tableEditor
        .getByRole('spinbutton', { name: '同步间隔', exact: true })
        .fill('2');
      await tableEditor
        .locator('label')
        .filter({ hasText: '每批最多行数' })
        .getByRole('spinbutton')
        .fill('2500');
      for (const width of [1280, 390]) {
        await page.setViewportSize({ width, height: 844 });
        const interval = tableEditor.getByRole('spinbutton', {
          name: '同步间隔',
          exact: true,
        });
        await interval.scrollIntoViewIfNeeded();
        await expect(interval).toBeInViewport({ ratio: 1 });
        await expect(
          tableEditor.getByRole('combobox', { name: /^同步间隔单位/ }),
        ).toBeInViewport({ ratio: 1 });
        await page.screenshot({
          path: testInfo.outputPath(`table-frequency-${width}.png`),
          fullPage: true,
        });
      }
      await page.setViewportSize({ width: 1280, height: 800 });
      await tableEditor.getByRole('button', { name: '确认本表配置' }).click();
      await expect(tableEditor).not.toBeVisible();
      await expect(strategyRows).toHaveCount(1);
    }
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await tableSearch.scrollIntoViewIfNeeded();
      await expect(tableSearch).toBeInViewport({ ratio: 1 });
      await expect(
        databaseEditor.getByRole('checkbox', { name: /仅看错误表/ }),
      ).toBeInViewport({ ratio: 1 });
      await page.screenshot({
        path: testInfo.outputPath(`strategy-error-search-${width}.png`),
        fullPage: true,
      });
    }
    await page.setViewportSize({ width: 1280, height: 800 });
    await databaseEditor.getByRole('button', { name: '清除表筛选' }).click();
    await expect(strategyRows).toHaveCount(20);
    expect(databaseSaved).toBe(false);
    if (readonly) {
      await expect(
        databaseEditor.getByRole('button', { name: '全部确认', exact: true }),
      ).toHaveCount(0);
      await expect(
        databaseEditor.getByRole('button', { name: '保存配置', exact: true }),
      ).toHaveCount(0);
      await expect(
        databaseEditor.getByRole('button', { name: '立即同步全库' }),
      ).toHaveCount(0);
    } else {
      await databaseEditor.getByRole('combobox', { name: /^计算仓库/ }).click();
      await page.getByTitle('query one', { exact: true }).click();
      await page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname.endsWith(
            '/data-sync/databases/10',
          ) && response.request().method() === 'GET',
      );
      await expect(databaseEditor.locator('.warehouse-selector')).toContainText(
        'query one',
      );
      await databaseEditor
        .getByRole('button', { name: '保存配置', exact: true })
        .click();
      await expect.poll(() => databaseSaveCount).toBe(1);
      await databaseEditor
        .getByRole('button', { name: '检查已确认表' })
        .click();
      await expect(
        databaseEditor.getByRole('button', { name: '确认建表并启用' }),
      ).toBeEnabled();
      expect(
        database.plan.find((row) => row.target_table === 'parameters')?.state,
      ).toBe('unconfirmed');
      await databaseEditor
        .getByRole('button', { name: '确认建表并启用' })
        .click();
      await databaseEditor
        .getByRole('button', { name: '同步已确认表' })
        .click();
      await expect.poll(() => database.last_task_id).toBe(93);
      await strategies
        .locator('tr[data-row-key="orders"]')
        .getByRole('button', { name: '同步一次', exact: true })
        .click();
      await expect.poll(() => syncTargets.at(-1)).toBe('orders');
      expect(syncTargets[0]).toBeUndefined();
      await expect(
        strategies.locator('tr[data-row-key="orders"]'),
      ).toContainText('每 2 小时');
      await databaseEditor
        .getByRole('button', { name: '全部确认', exact: true })
        .click();
      await expect(
        databaseEditor.getByRole('checkbox', { name: '确认 parameters 策略' }),
      ).toBeChecked();
      await expect(
        databaseEditor.getByRole('button', { name: '全部确认', exact: true }),
      ).toBeDisabled();
      await databaseEditor
        .getByRole('button', { name: '保存配置', exact: true })
        .click();
      await expect.poll(() => databaseSaved).toBe(true);
      await databaseEditor.getByRole('button', { name: '检查所有表' }).click();
      await expect(
        databaseEditor.getByRole('button', { name: '确认建表并启用' }),
      ).toBeEnabled();
      await databaseEditor
        .getByRole('button', { name: '确认建表并启用' })
        .click();
      await expect(
        databaseEditor.getByRole('button', { name: '立即同步全库' }),
      ).toBeEnabled();
      await databaseEditor
        .getByRole('button', { name: '立即同步全库' })
        .click();
      await expect.poll(() => database.last_task_id).toBe(93);
    }
    if (!readonly) {
      await databaseEditor.getByRole('button', { name: '添加源范围' }).click();
      const scope = databaseEditor.locator('.scope-row').last();
      await scope.getByRole('combobox').first().click();
      await page.getByTitle('华西门店 (shop_west_01)', { exact: true }).click();
      await scope.getByRole('combobox').last().click();
      await page.locator('.ant-select-item-option[title="public"]').click();
      await databaseEditor
        .getByRole('button', { name: '保存配置', exact: true })
        .click();
      await databaseEditor
        .getByRole('button', { name: '发现源表', exact: true })
        .click();
      await expect.poll(() => expanded).toBe(true);
      await tableSearch.fill('orders');
      await strategies
        .locator('tr[data-row-key="orders"]')
        .getByRole('button', { name: '配置', exact: true })
        .click();
      const tableEditor = page.getByRole('dialog', {
        name: 'orders',
        exact: true,
      });
      const splitButtons = tableEditor.getByRole('button', {
        name: '拆为独立目标表',
      });
      await expect(splitButtons).toHaveCount(2);
      await expect(splitButtons.first()).toBeDisabled();
      await expect(splitButtons.last()).toBeEnabled();
      await splitButtons.last().click();
      await tableEditor.getByRole('button', { name: /取\s*消/ }).click();
      await expect(
        strategies.locator('tr[data-row-key="orders_shop_west_01"]'),
      ).toHaveCount(0);
      await strategies
        .locator('tr[data-row-key="orders"]')
        .getByRole('button', { name: '配置', exact: true })
        .click();
      await tableEditor
        .getByRole('button', { name: '拆为独立目标表' })
        .last()
        .click();
      await tableEditor.getByRole('button', { name: '确认本表配置' }).click();
      await expect(
        strategies.locator('tr[data-row-key="orders_shop_west_01"]'),
      ).toHaveCount(1);
      await databaseEditor
        .getByRole('button', { name: '保存配置', exact: true })
        .click();
      expect(database.config.sources).toHaveLength(2);
      expect(
        database.config.tables.find((table) => table.target_table === 'orders')
          ?.config.sources,
      ).toHaveLength(1);
      expect(
        database.config.tables.find(
          (table) => table.target_table === 'orders_shop_west_01',
        )?.confirmed,
      ).toBe(false);
      await databaseEditor.getByRole('button', { name: '清除表筛选' }).click();
    }
    for (const viewport of [
      { width: 1280, height: 800 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      await expect(
        databaseEditor.getByRole('button', { name: /关闭|close/i }).first(),
      ).toBeInViewport();
      if (!readonly) {
        const confirmAll = databaseEditor.getByRole('button', {
          name: '全部确认',
          exact: true,
        });
        await confirmAll.scrollIntoViewIfNeeded();
        await expect(confirmAll).toBeInViewport({ ratio: 1 });
      }
      await page.screenshot({
        path: testInfo.outputPath(`database-strategies-${viewport.width}.png`),
        fullPage: true,
      });
    }
    await databaseEditor
      .getByRole('button', { name: /关闭|close/i })
      .first()
      .click();
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.getByRole('tab', { name: '同步任务', exact: true }).click();
    if (!readonly) {
      await page.getByRole('tab', { name: '源实例', exact: true }).click();
      await page.getByText('华东门店', { exact: true }).click();
      const instanceEditor = page.getByRole('dialog', { name: '编辑源实例' });
      for (const viewport of [
        { width: 1280, height: 800 },
        { width: 390, height: 844 },
      ]) {
        await page.setViewportSize(viewport);
        const checkbox = instanceEditor.getByRole('checkbox', {
          name: '启用实例',
        });
        await expect(checkbox).toBeChecked();
        const layout = await checkbox.evaluate((element) => {
          const label = element.closest('label');
          const textElement = label?.lastElementChild;
          if (!label || !textElement) throw new Error('复选框标签未挂载');
          const box = element.getBoundingClientRect();
          const text = textElement.getBoundingClientRect();
          return {
            direction: getComputedStyle(label).flexDirection,
            delta: Math.abs(
              box.top + box.height / 2 - (text.top + text.height / 2),
            ),
            after: text.left > box.left,
          };
        });
        expect(layout.direction).not.toBe('column');
        expect(layout.delta).toBeLessThan(5);
        expect(layout.after).toBe(true);
        await page.screenshot({
          path: testInfo.outputPath(`instance-checkbox-${viewport.width}.png`),
          fullPage: true,
        });
      }
      await instanceEditor
        .getByRole('checkbox', { name: '启用实例' })
        .uncheck();
      await expect(
        instanceEditor.getByRole('checkbox', { name: '启用实例' }),
      ).not.toBeChecked();
      await expect(
        instanceEditor.getByRole('checkbox', { name: '允许不加密的源连接' }),
      ).toBeDisabled();
      await instanceEditor.getByRole('button', { name: /取\s*消/ }).click();
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.getByRole('tab', { name: '同步任务', exact: true }).click();
      await page.getByRole('button', { name: '新增任务' }).click();
      const create = page.getByRole('dialog', { name: '新增同步任务' });
      await expect(
        create.getByRole('checkbox', { name: '允许不加密的目标连接' }),
      ).toBeChecked();
      await create
        .locator('label')
        .filter({ hasText: '任务名称' })
        .locator('input')
        .fill('下拉配置测试');
      await create.getByRole('combobox', { name: /^Databend 数据源/ }).click();
      await page.getByTitle('Databend', { exact: true }).click();
      const warehouse = create.locator('.warehouse-selector');
      await warehouse.getByRole('combobox').click();
      await page.getByTitle('sync-warehouse', { exact: true }).click();
      failWarehouseNext = true;
      await warehouse.getByRole('button', { name: '刷新计算仓库' }).click();
      await expect(warehouse).toContainText('加载失败');
      await expect(warehouse).toContainText('sync-warehouse');
      await warehouse.locator('.ant-select-clear').click();
      await expect(warehouse).toContainText('默认连接（不指定仓库）');
      delayWarehouseNext = true;
      const lateWarehouse = page.waitForResponse(
        (response) =>
          response.url().endsWith('/target-warehouses') &&
          requestBody(response.request()).ds_code === 'bend',
      );
      await warehouse.getByRole('button', { name: '刷新计算仓库' }).click();
      await create.getByRole('combobox', { name: /^Databend 数据源/ }).click();
      await page.getByTitle('Databend Second', { exact: true }).click();
      await lateWarehouse;
      await expect(warehouse.getByText('当前许可未开放仓库列表')).toHaveCount(
        0,
      );
      await warehouse.getByRole('combobox').click();
      await page.getByTitle('other-wh', { exact: true }).click();
      await create.getByRole('combobox', { name: /^Databend 数据源/ }).click();
      await page.getByTitle('Databend', { exact: true }).click();
      await expect(warehouse).toContainText('默认连接（不指定仓库）');
      await expect(
        warehouse.getByRole('button', { name: '刷新计算仓库' }),
      ).toBeEnabled();
      unavailableWarehouseNext = true;
      await warehouse.getByRole('button', { name: '刷新计算仓库' }).click();
      await expect(warehouse).toContainText('当前许可未开放仓库列表');
      await create.getByRole('combobox', { name: /^目标数据库/ }).click();
      await page.getByTitle('analytics', { exact: true }).click();
      await create
        .locator('label')
        .filter({ hasText: '私有批次存储' })
        .getByRole('combobox')
        .click();
      await page.getByTitle('私有批次存储', { exact: true }).click();
      await create.getByRole('combobox', { name: /^实例编码/ }).click();
      await page.getByTitle('华东门店 (shop_east_01)', { exact: true }).click();
      await create.getByRole('combobox', { name: /^Schema \/ 源库/ }).click();
      await page.getByTitle('public', { exact: true }).click();
      await create.getByRole('combobox', { name: /^源表/ }).click();
      await page.getByTitle('orders', { exact: true }).click();
      await expect(create.getByPlaceholder('新建目标表名')).toHaveValue(
        'orders',
      );
      await create.getByPlaceholder('新建目标表名').fill('new_orders');
      await expect(
        create.locator('label').filter({ hasText: '自增主键字段' }),
      ).toContainText('id (bigint)');
      await create
        .getByRole('button', { name: '添加字段', exact: true })
        .click();
      await create
        .locator('tbody tr')
        .first()
        .getByRole('combobox')
        .first()
        .click();
      await page.getByTitle('id (bigint)', { exact: true }).last().click();
      const lateColumns = page.waitForResponse(
        (response) =>
          response.url().includes('/columns') &&
          new URL(response.url()).searchParams.get('table') === 'orders',
      );
      await create
        .getByRole('button', { name: '刷新源字段', exact: true })
        .click();
      await create.getByRole('combobox', { name: /^源表/ }).click();
      await page.getByTitle('events', { exact: true }).click();
      await expect(create.getByPlaceholder('新建目标表名')).toHaveValue(
        'new_orders',
      );
      await expect(create.locator('tbody tr')).toHaveCount(0);
      await expect(
        create.locator('label').filter({ hasText: '自增主键字段' }),
      ).toContainText('record_id (bigint)');
      await lateColumns;
      await create
        .getByRole('combobox', { name: /^更新时间字段/ })
        .fill('custom_changed_at');
      await create
        .getByRole('combobox', { name: /^更新时间字段/ })
        .press('Tab');
      await expect(
        create.locator('label').filter({ hasText: '自增主键字段' }),
      ).toContainText('record_id (bigint)');
      await page.screenshot({
        path: testInfo.outputPath('metadata-selectors-desktop.png'),
        fullPage: true,
      });
      await create.getByPlaceholder('新建目标表名').fill('');
      await create.getByRole('button', { name: '保存配置' }).click();
      await expect(create.getByRole('alert')).toHaveText('请填写目标表名');
      await expect(create.getByPlaceholder('新建目标表名')).toBeFocused();
      expect(metadataSelections).toBe(false);
      await page.screenshot({
        path: testInfo.outputPath('missing-target-table.png'),
        fullPage: true,
      });
      await create.getByPlaceholder('新建目标表名').fill('new_orders');
      await expect(create.getByRole('alert')).toHaveCount(0);
      await create.getByRole('button', { name: '保存配置' }).click();
      await expect.poll(() => metadataSelections).toBe(true);
      await page
        .getByRole('dialog', { name: '订单汇总', exact: true })
        .getByRole('button', { name: '关闭', exact: true })
        .click();
    }
    if (readonly)
      await expect(page.getByRole('button', { name: '新增任务' })).toHaveCount(
        0,
      );
    await page.getByRole('link', { name: '订单汇总', exact: true }).click();
    await expect(
      page.getByText('9007199254740993', { exact: true }).first(),
    ).toBeVisible();
    await page.getByRole('tab', { name: '字段与建表计划' }).click();
    const ddl = page.getByRole('textbox', { name: '目标 DDL SQL' });
    await ddl.scrollIntoViewIfNeeded();
    await expect(ddl).toHaveAttribute('aria-readonly', 'true');
    await expect.poll(() => ddl.locator('.cm-line').count()).toBeGreaterThan(3);
    await expect
      .poll(() => ddl.locator('span[class]').count())
      .toBeGreaterThan(0);
    await page
      .context()
      .grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.getByRole('button', { name: '复制 SQL' }).click();
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toContain('CREATE TABLE');
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await ddl.scrollIntoViewIfNeeded();
      await expect(ddl).toBeInViewport({ ratio: 1 });
      await page.screenshot({
        path: testInfo.outputPath(`formatted-ddl-${width}.png`),
        fullPage: true,
      });
    }
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.getByRole('tab', { name: '水位与运行' }).click();
    if (readonly) {
      await expect(page.getByRole('button', { name: '检查结构' })).toHaveCount(
        0,
      );
      await expect(
        page.getByRole('button', { name: '同步', exact: true }),
      ).toHaveCount(0);
    } else {
      await page.getByRole('button', { name: '编辑配置', exact: true }).click();
      const editor = page.getByRole('dialog').filter({ hasText: '任务与目标' });
      await editor
        .locator('label')
        .filter({ hasText: '任务名称' })
        .locator('input')
        .fill('订单汇总已修改');
      await editor.getByRole('button', { name: '保存配置' }).click();
      await expect(
        page.getByRole('link', { name: '订单汇总已修改', exact: true }),
      ).toBeVisible();
      await page.getByRole('button', { name: '检查结构', exact: true }).click();
      await expect(
        page.getByRole('button', { name: '确认建表并启用' }),
      ).toBeEnabled({ timeout: 12_000 });
      await page.getByRole('button', { name: '同步', exact: true }).click();
      await expect(
        page.getByRole('alert').filter({ hasText: 'data_sync_commit_unknown' }),
      ).toBeVisible({ timeout: 12_000 });
    }
    await page.getByRole('button', { name: '#2', exact: true }).click();
    await expect(
      page.getByText('shop_east_01', { exact: true }).last(),
    ).toBeVisible();
    const drawer = page.getByRole('dialog', {
      name: '同步运行 #2',
      exact: true,
    });
    await expect
      .poll(async () => {
        const box = await drawer.boundingBox();
        return Math.round(box?.x ?? 2000);
      })
      .toBe((page.viewportSize()?.width ?? 1280) - 900);
    await page.screenshot({
      path: testInfo.outputPath('data-sync-desktop.png'),
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(
      page.getByText('同步运行 #2', { exact: true }),
    ).toBeInViewport();
    await expect(
      drawer.getByRole('button', { name: '关闭', exact: true }),
    ).toBeInViewport();
    await expect
      .poll(async () => {
        const box = await drawer.boundingBox();
        return box?.width ?? 1000;
      })
      .toBeLessThanOrEqual(390);
    await page.screenshot({
      path: testInfo.outputPath('data-sync-mobile.png'),
      fullPage: true,
    });
  });
}
async function fulfillApi(route: Route, result: unknown) {
  const body = JSON.stringify({ code: 200, msg: 'ok', result });
  await route.fulfill({
    body:
      route.request().headers().security === 'true'
        ? Buffer.from(KxEd.encryptText(body))
        : body,
    contentType: 'application/json',
  });
}

function requestBody(request: Request) {
  const body = request.postDataBuffer();
  if (!body) throw new Error('缺少请求正文');
  return JSON.parse(KxEd.decodeText(KxEd.decrypt(body)));
}
