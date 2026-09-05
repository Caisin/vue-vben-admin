import type { Route } from '@playwright/test';

import { Buffer } from 'node:buffer';

import { KxEd } from '@kx/admin-core';
import { expect, test } from '@playwright/test';

test('周报检查成功后展示未填写人员，失败不显示全部完成', async ({
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  let failed = false;
  let taskId = 41;
  let polls = 0;
  const publish = () => ({
    id: 7,
    title: '测试部第1周工作汇报',
    status: 'content_written',
    reminder_status: 'pending',
    sheet_id: 'sheet',
    doc_url: 'https://example.test/report',
    reminder_round: 0,
    updated_at: 1_788_000_000,
    last_reminder_task_run_id: taskId,
  });
  const pageResult = (items: unknown[]) => ({
    items,
    total: items.length,
    paging: { page: 1, size: 20 },
  });
  await page.context().route('**/{auth,notify,param}/**', async (route) => {
    if (!['fetch', 'xhr'].includes(route.request().resourceType())) {
      await route.continue();
      return;
    }
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/api(?=\/)/, '');
    let result: unknown = null;
    if (
      path.endsWith('/actions/preview-missing') ||
      path.endsWith('/actions/remind-missing')
    ) {
      taskId++;
      polls = 0;
      result = { id: taskId, status: 'running' };
    } else if (path.endsWith('/weekly-report-publishes/7/participants')) {
      result = [
        { id: 1, display_name: '张三', status: 'completed', reminder_count: 0 },
        { id: 2, display_name: '李四', status: 'pending', reminder_count: 0 },
        {
          id: 3,
          display_name: '王五',
          status: 'mapping_invalid',
          reminder_count: 0,
        },
      ];
    } else if (path.endsWith('/weekly-report-publishes/7')) {
      polls++;
      let status = 'running';
      if (failed) {
        status = 'failed';
      } else if (polls > 1) {
        status = 'succeeded';
      }
      result = {
        ...publish(),
        task_run: {
          id: taskId,
          status,
          error_message: failed ? '钉钉表格读取失败' : null,
        },
      };
    } else if (path.endsWith('/weekly-report-publishes')) {
      result = pageResult([publish()]);
    } else if (path === '/auth/user/access_token') {
      result = {
        access_token: 'e2e-token',
        token_type: 'Bearer',
        uid: 1,
        exp_at: 4_102_444_800,
        exp_in: 3600,
      };
    } else if (path === '/auth/user/user_info') {
      result = {
        id: 1,
        name: '测试管理员',
        enabled: true,
        home_path: '/system/user',
        avatar: '',
        created_at: 1,
        dept_id: 0,
        email: '',
        is_guest: false,
        os: 'web',
        permission_count: 1,
        platform: 'web',
        reg_ip: '127.0.0.1',
        tel: '',
        updated_at: 1,
      };
    } else if (path === '/auth/per/codes') {
      result = ['user:weekly-report-dingtalk'];
    } else if (path === '/auth/menu/current') {
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
          redirect: '/system/user',
        },
        {
          id: 2,
          pid: 1,
          name: 'SystemUser',
          title: '用户管理',
          path: '/system/user',
          component: '/system/user/list',
          perm_type: 'menu',
          enabled: true,
          order_no: 1,
          auth_code: '',
          meta: {},
          redirect: null,
        },
      ];
    } else if (path.includes('/user-admin')) {
      result = pageResult([]);
    } else if (path.includes('/dept') || path === '/auth/dt/apps') {
      result = [];
    } else if (path === '/notify/inbox') {
      result = { items: [], unread_count: 0 };
    }
    await fulfillApi(route, result);
  });
  await page.goto('/');
  await page.locator("input[name='username']").fill('admin');
  await page.locator("input[name='password']").fill('e2e-placeholder');
  await page.getByRole('button', { name: /登录|login/i }).click();
  await expect(page).toHaveURL(/\/system\/user/, { timeout: 20_000 });
  await page.getByRole('button', { name: '周报发布记录', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('2. 王五')).toBeVisible();
  await expect(dialog.getByText('1. 李四')).toBeVisible();
  await expect(dialog.getByText('人员映射异常')).toBeVisible();
  await expect(dialog.getByText('张三')).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath('weekly-report-desktop.png'),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    dialog.getByRole('button', { name: '重新推送周报' }),
  ).toBeInViewport();
  await page.screenshot({
    path: testInfo.outputPath('weekly-report-mobile.png'),
    fullPage: true,
  });
  failed = true;
  await dialog.getByRole('button', { name: '刷新名单' }).click();
  await expect(dialog.getByRole('alert')).toHaveText('钉钉表格读取失败');
  await expect(dialog.getByText('当前没有未填写人员')).toHaveCount(0);
});

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
