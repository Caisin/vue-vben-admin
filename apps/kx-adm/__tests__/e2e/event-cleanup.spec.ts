import type { EventCleanupRequest } from '../../src/api/msg/device-event';

import { Buffer } from 'node:buffer';

import { KxEd } from '@kx/admin-core';
import { expect, test } from '@playwright/test';

test.use({ headless: true, actionTimeout: 10_000 });
for (const readonly of [false, true]) {
  test(`设备事件清理${readonly ? '只读隔离' : '范围确认与后台反馈'}`, async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const submissions: EventCleanupRequest[] = [];
    let listReads = 0;
    let polls = 0;
    await page
      .context()
      .route('**/{auth,param,notify,msg}/**', async (route) => {
        if (!['fetch', 'xhr'].includes(route.request().resourceType()))
          return route.continue();
        const request = route.request();
        const path = new URL(request.url()).pathname.replace(
          /^\/api(?=\/)/,
          '',
        );
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
            name: '事件管理员',
            enabled: true,
            home_path: '/msg/device-events',
            avatar: '',
            is_guest: false,
          };
        else if (path === '/auth/per/codes')
          result = readonly ? [] : ['device_events:cleanup'];
        else if (path === '/auth/menu/current')
          result = [
            {
              id: 1,
              pid: 0,
              name: 'MsgDeviceEvents',
              title: '设备事件',
              path: '/msg/device-events',
              component: '/msg/device-events/list',
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
        else if (path === '/msg/device-events/filter-options')
          result = { event_kinds: [], process_statuses: [] };
        else if (path === '/msg/device-events') {
          listReads++;
          result = {
            items: [
              {
                id: 1,
                device_code: 'dev-1',
                event_kind: 'refresh_info',
                process_status: 'published',
                received_at: 1,
                error_message: '',
              },
            ],
            total: 1,
          };
        } else if (path === '/msg/device-events/cleanup') {
          const bytes = request.postDataBuffer();
          if (!bytes) throw new Error('missing cleanup input');
          submissions.push(JSON.parse(KxEd.decodeText(KxEd.decrypt(bytes))));
          polls = 0;
          result = {
            id: submissions.length,
            status: 'running',
            message: '正在清理',
          };
        } else if (/\/msg\/device-events\/cleanup\/\d+$/.test(path)) {
          polls++;
          const done = polls >= 2;
          const terminalStatus =
            submissions.length === 1 ? 'succeeded' : 'failed';
          result = {
            id: submissions.length,
            status: done ? terminalStatus : 'running',
            message: done
              ? '清理完成，本轮已删除 1000 条事件'
              : '本轮已删除 500 条事件',
            error_message:
              done && submissions.length === 2 ? '测试数据库暂不可用' : '',
          };
        }
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
    await page.locator("input[name='username']").fill('event-user');
    await page.locator("input[name='password']").fill('test-only');
    await page.getByRole('button', { name: /登录|login/i }).click();
    await expect(page.getByText('refresh_info', { exact: true })).toBeVisible();
    if (readonly) {
      await expect(
        page.getByRole('button', { name: '清理事件', exact: true }),
      ).toHaveCount(0);
      expect(submissions).toHaveLength(0);
      return;
    }
    await page.getByRole('button', { name: '清理事件', exact: true }).click();
    const modal = page.getByRole('dialog', {
      name: '清理设备事件',
      exact: true,
    });
    const confirm = modal.getByRole('button', {
      name: '确认清理',
      exact: true,
    });
    await expect(confirm).toBeDisabled();
    await modal
      .getByRole('checkbox', {
        name: '我确认清理以上范围的事件，删除后无法恢复',
      })
      .check();
    await confirm.click();
    await expect(modal).toContainText('请选择有效的开始和结束时间');
    expect(submissions).toHaveLength(0);
    await modal
      .getByRole('textbox', { name: '清理开始时间' })
      .fill('2026-09-01T00:00');
    await modal
      .getByRole('textbox', { name: '清理结束时间' })
      .fill('2026-09-08T23:59');
    await expect(confirm).toBeDisabled();
    await modal
      .getByRole('checkbox', {
        name: '我确认清理以上范围的事件，删除后无法恢复',
      })
      .check();
    const before = listReads;
    await confirm.click();
    await expect(modal).toContainText('清理完成，本轮已删除 1000 条事件');
    expect(submissions[0]).toMatchObject({
      all_time: false,
      normal_queries_only: true,
    });
    expect(submissions[0]?.start_at).toBeGreaterThan(0);
    expect(submissions[0]?.end_at).toBeGreaterThan(
      submissions[0]?.start_at ?? 0,
    );
    await expect.poll(() => listReads).toBeGreaterThan(before);
    await modal.getByRole('button', { name: '发起新的清理' }).click();
    await modal.getByRole('radio', { name: '全部时间' }).check();
    await modal
      .getByRole('checkbox', {
        name: '仅清理正常的设备信息、号码状态查询事件（保留错误）',
      })
      .uncheck();
    await expect(modal).toContainText('包括错误和手动操作记录');
    await expect(confirm).toBeDisabled();
    await modal
      .getByRole('checkbox', {
        name: '我确认清理以上范围的事件，删除后无法恢复',
      })
      .check();
    await confirm.click();
    await expect(modal).toContainText('测试数据库暂不可用');
    expect(submissions[1]).toEqual({
      all_time: true,
      start_at: null,
      end_at: null,
      normal_queries_only: false,
    });
  });
}
