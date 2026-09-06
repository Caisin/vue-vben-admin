import type { Page, Route } from '@playwright/test';

import { Buffer } from 'node:buffer';

import { KxEd } from '@kx/admin-core';
import { expect, test } from '@playwright/test';

async function fulfill(route: Route, result: unknown) {
  const body = JSON.stringify({ code: 200, msg: 'ok', result });
  await route.fulfill({
    contentType: 'application/json',
    body:
      route.request().headers().security === 'true'
        ? Buffer.from(KxEd.encryptText(body))
        : body,
  });
}

async function login(
  page: Page,
  home: string,
  business: (path: string) => unknown,
) {
  await page.context().route('**/*', async (route) => {
    if (!['fetch', 'xhr'].includes(route.request().resourceType())) {
      await route.continue();
      return;
    }
    const path = new URL(route.request().url()).pathname.replace(
      /^\/api(?=\/)/,
      '',
    );
    let result: unknown;
    if (path === '/auth/user/access_token')
      result = {
        access_token: 'e2e-only',
        token_type: 'Bearer',
        uid: 1,
        exp_at: 4_102_444_800,
        exp_in: 3600,
      };
    else if (path === '/auth/user/user_info')
      result = {
        id: 1,
        name: '测试管理员',
        enabled: true,
        home_path: home,
        avatar: '',
        dept_id: 0,
        is_guest: false,
        permission_count: 5,
      };
    else if (path === '/auth/per/codes')
      result = [
        'tasks:schedule:manage',
        'tasks:run:cancel',
        'article:manage',
        'article:publish',
      ];
    else if (path === '/auth/menu/current')
      result = [
        {
          id: 1,
          pid: 0,
          name: 'TestPage',
          title: '测试页面',
          path: home,
          component:
            home === '/article' ? '/article/list' : '/system/tasks/index',
          perm_type: 'menu',
          enabled: true,
          order_no: 1,
          auth_code: '',
          meta: {},
          redirect: null,
        },
      ];
    else if (path === '/notify/inbox') result = { items: [], unread_count: 0 };
    else result = business(path) ?? [];
    await fulfill(route, result);
  });
  await page.goto('/');
  await page.locator("input[name='username']").fill('admin');
  await page.locator("input[name='password']").fill('e2e-placeholder');
  await page.getByRole('button', { name: /登录|login/i }).click();
  await expect(page).toHaveURL(new RegExp(`${home}$`), { timeout: 20_000 });
}

test('任务详情自动更新，技术配置按需展开', async ({ page }, info) => {
  let polls = 0;
  const run = (finished = false) => ({
    id: 1,
    executor_code: 'test.export',
    executor_kind: 'business',
    biz_key: 'test:1',
    trigger: 'dispatch',
    status: finished ? 'succeeded' : 'running',
    total_count: 2,
    succeeded_count: finished ? 2 : 0,
    failed_count: 0,
    running_count: finished ? 0 : 1,
    message: finished ? '验证任务已完成' : '验证任务处理中',
    scheduled_at: 1_788_000_000,
    queued_at: 1_788_000_000,
    updated_at: 1_788_000_000,
    attempt: 1,
    max_attempts: 1,
  });
  const executor = {
    executor_code: 'test.export',
    display_name: '测试导出',
    description: '',
    cardinality: 'multiple',
    allow_cron: true,
    minimum_interval_seconds: 60,
    params_version: 1,
    payload_schema: { type: 'object', properties: {} },
  };
  await login(page, '/system/tasks', (path) => {
    if (path === '/task/runs/filter-options')
      return { executors: [executor], biz_keys: ['test:1'] };
    if (path === '/task/runs') return { items: [run()], total: 1 };
    if (path === '/task/runs/1') return run(++polls > 1);
    if (path === '/task/executors') return [executor];
    if (path.includes('/task/executors/')) return executor;
    if (path === '/task/schedules') return { items: [], total: 0 };
    if (path.includes('/task/cron/'))
      return {
        cron_expr: '0 */5 * * * *',
        timezone_offset_seconds: 28_800,
        fire_times: [],
      };
  });
  await page.getByRole('button', { name: '详情', exact: true }).first().click();
  await expect(page.getByText('验证任务已完成', { exact: true })).toBeVisible({
    timeout: 10_000,
  });
  await page.screenshot({
    path: info.outputPath('task-desktop.png'),
    fullPage: true,
  });
  await page.keyboard.press('Escape');
  await page.getByRole('tab', { name: '调度配置' }).click();
  await page.getByRole('button', { name: '新建调度' }).click();
  await expect(page.locator('details')).not.toHaveAttribute('open');
  await page.getByText('高级设置', { exact: true }).click();
  await expect(page.getByText('实例键', { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByText('新建调度配置', { exact: true }),
  ).toBeInViewport();
  await expect(page.locator('.schedule-form > label').first()).toBeInViewport({
    ratio: 1,
  });
  await page.screenshot({
    path: info.outputPath('task-mobile-verified.png'),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test('文章发布记录显示处理中和失败，未发布版本不可恢复', async ({
  page,
}, info) => {
  const article = {
    id: 1,
    title: '验证文章',
    state: 'draft',
    visibility: 'public',
    theme_code: 'default',
    author_name: '',
    summary: '',
    updated_at: 1_788_000_000,
    created_at: 1_788_000_000,
  };
  await login(page, '/article', (path) => {
    if (path === '/article') return { items: [article], total: 1 };
    if (path === '/article/themes')
      return [{ code: 'default', name: '默认', version: '1' }];
    if (path === '/article/1/releases')
      return {
        items: [
          { ...article, id: 2, state: 'preparing', failure_reason: '' },
          {
            ...article,
            id: 3,
            state: 'failed',
            failure_reason: '资源复制失败',
          },
        ],
        total: 2,
      };
  });
  await page.getByRole('button', { name: '发布记录', exact: true }).click();
  await expect(page.getByText('资源复制失败', { exact: true })).toBeVisible();
  await expect(page.getByText('发布中', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: '恢复', exact: true }),
  ).toHaveCount(0);
  await page.screenshot({
    path: info.outputPath('article-desktop.png'),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByText('发布记录：验证文章', { exact: true }),
  ).toBeInViewport();
  await page.screenshot({
    path: info.outputPath('article-mobile.png'),
    fullPage: true,
  });
});
