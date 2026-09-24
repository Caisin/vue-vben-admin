import type { Route } from '@playwright/test';

import { Buffer } from 'node:buffer';

import { KxEd } from '@kx/admin-core';
import { expect, test } from '@playwright/test';

const ok = (result: unknown) => ({ code: 200, msg: 'ok', result });

test.use({ headless: true });
test('按剧详情和单剧停止恢复', async ({ page }) => {
  test.setTimeout(90_000);
  const dramas = [1, 2].map((id) => ({
    res_id: id,
    res_name: `测试短剧${id}`,
    resource_code: `DR-${id}`,
    source_id: `${100 + id}`,
    languages: ['zh-CN'],
    version_count: 1,
    total: 2,
    pending: id === 1 ? 0 : 1,
    running: id === 1 ? 1 : 0,
    succeeded: 0,
    failed: 1,
    conflict: 0,
    paused: 0,
    state: id === 1 ? 'running' : 'failed',
    updated_at: 1,
    failure_reasons: ['HTTP 404: file missing'],
  }));
  let concurrency = 5;
  let failSettingsSave = false;
  const detailRequests: URL[] = [];
  const resumed: number[] = [];
  const stopped: number[] = [];
  await page.route('**/api/**', (route) => {
    if (!new URL(route.request().url()).pathname.startsWith('/api/'))
      return route.continue();
    return fulfillApi(route, { items: [], unread_count: 0 });
  });
  await page.route('**/auth/**', (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api/, '');
    if (!path.startsWith('/auth/')) return route.continue();
    return fulfillApi(route, authFixture(path));
  });
  await page.route('**/adm/res/app-short-sync/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path.endsWith('/settings')) {
      if (route.request().method() === 'PUT') {
        if (failSettingsSave)
          return route.fulfill({ status: 503, body: '暂时不可用' });
        const request = route.request();
        const body =
          request.headers().security === 'true'
            ? JSON.parse(
                KxEd.decodeText(
                  KxEd.decrypt(request.postDataBuffer() as Buffer),
                ),
              )
            : request.postDataJSON();
        concurrency = body.concurrency;
      }
      return fulfillApi(route, { concurrency });
    }
    if (path.endsWith('/videos/resources')) return fulfillApi(route, dramas);
    if (path.endsWith('/runs'))
      return fulfillApi(route, { items: [], total: 0 });
    if (path.endsWith('/videos/migrate')) {
      const request = route.request();
      const body =
        request.headers().security === 'true'
          ? JSON.parse(
              KxEd.decodeText(KxEd.decrypt(request.postDataBuffer() as Buffer)),
            )
          : request.postDataJSON();
      resumed.push(body.res_id);
      const row = dramas[body.res_id - 1];
      if (!row) throw new Error('资源不存在');
      row.state = 'pending';
      row.pending = 2;
      row.paused = 0;
      return fulfillApi(route, { id: 91 });
    }
    if (path.endsWith('/stop')) {
      const id = Number(path.split('/').at(-2));
      stopped.push(id);
      const row = dramas[id - 1];
      if (!row) throw new Error('资源不存在');
      row.state = 'paused';
      row.running = 0;
      row.failed = 0;
      row.paused = 2;
      return fulfillApi(route, null);
    }
    if (path.endsWith('/videos')) {
      detailRequests.push(url);
      return fulfillApi(route, {
        items: [
          {
            video: {
              id: 11,
              res_id: Number(url.searchParams.get('res_id')),
              version_id: 1,
              source_id: 111,
              seq_no: 1,
              state: 'failed',
              stage: 'download_segments',
              progress_current: 1,
              progress_total: 2,
              progress_unit: 'segments',
              attempts: 2,
              error_code: 'HTTP 404: file missing',
              updated_at: 1,
            },
          },
        ],
        total: 1,
        counts: { failed: 1 },
      });
    }
    return fulfillApi(route, null);
  });
  await page.goto('/');
  await page.locator("input[name='username']").fill('admin');
  await page.locator("input[name='password']").fill('123456');
  await page.getByRole('button', { name: /登录|login/i }).click();
  const drama1 = page.getByRole('row').filter({ hasText: '测试短剧1' });
  const drama2 = page.getByRole('row').filter({ hasText: '测试短剧2' });
  await expect(drama1).toBeVisible();
  await expect(drama1).toContainText('DR-1');
  await expect(
    drama1.getByRole('button', { name: '停止', exact: true }),
  ).toBeVisible();
  await expect(
    drama2.getByRole('button', { name: '停止', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: '章节详情', exact: true }),
  ).toHaveCount(0);
  expect(detailRequests).toHaveLength(0);
  const limit = page.getByRole('spinbutton', {
    name: '同时同步集数',
    exact: true,
  });
  await expect(limit).toHaveValue('5');
  await limit.fill('3');
  await page.getByRole('button', { name: '保存同步配置', exact: true }).click();
  await expect.poll(() => concurrency).toBe(3);
  await page.reload();
  await expect(limit).toHaveValue('3');
  failSettingsSave = true;
  await limit.fill('2');
  await page.getByRole('button', { name: '保存同步配置', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '重新加载配置' }),
  ).toBeVisible();
  await expect(limit).toHaveValue('2');
  expect(concurrency).toBe(3);
  failSettingsSave = false;
  await page.getByRole('button', { name: '重新加载配置' }).click();
  await expect(limit).toHaveValue('3');
  await drama1.getByRole('button', { name: '测试短剧1', exact: true }).click();
  const drawer = page.getByRole('dialog');
  await expect(drawer).toContainText('测试短剧1');
  await expect(drawer).toContainText('HTTP 404: file missing');
  await expect(drawer).toContainText('失败于：下载 HLS 分片');
  await expect(drawer).toContainText('1 / 2 个分片');
  await drawer.getByRole('button', { name: '刷新章节', exact: true }).click();
  await expect(drawer).toContainText('失败于：下载 HLS 分片');
  await expect.poll(() => detailRequests.length).toBeGreaterThan(0);
  expect(
    detailRequests.every((u) => u.searchParams.get('res_id') === '1'),
  ).toBe(true);
  await page.getByLabel('章节状态', { exact: true }).click();
  await page.getByTitle('失败', { exact: true }).click();
  await drawer.getByRole('button', { name: '筛选章节' }).click();
  await expect
    .poll(() => detailRequests.at(-1)?.searchParams.get('state'))
    .toBe('failed');
  await drawer.getByRole('button', { name: /close|关闭/i }).click();
  await drama1.getByRole('button', { name: '停止', exact: true }).click();
  await expect.poll(() => stopped).toEqual([1]);
  await expect(drama1).toContainText('已停止');
  await expect(
    drama1.getByRole('button', { name: '停止', exact: true }),
  ).toHaveCount(0);
  await expect(drama2).not.toContainText('已停止');
  await drama1.getByRole('button', { name: '重新同步', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: '重新同步', exact: true })
    .click();
  await expect.poll(() => resumed).toEqual([1]);
  await expect(drama1).toContainText('待同步');
  await expect(
    drama1.getByRole('button', { name: '停止', exact: true }),
  ).toHaveCount(0);
  await page.route('**/auth/per/codes', (route) => fulfillApi(route, []));
  await page.reload();
  await expect(limit).toHaveValue('3');
  await expect(limit).toBeDisabled();
  await expect(
    page.getByRole('button', { name: '保存同步配置', exact: true }),
  ).toHaveCount(0);
});

async function fulfillApi(route: Route, result: unknown) {
  const body = JSON.stringify(ok(result));
  const encrypted = route.request().headers().security === 'true';
  await route.fulfill({
    contentType: 'application/json',
    body: encrypted ? Buffer.from(KxEd.encryptText(body)) : body,
  });
}

function authFixture(path: string) {
  switch (path) {
    case '/auth/dt/apps': {
      return [];
    }
    case '/auth/per/codes': {
      return ['res:app-short-sync:migrate', 'res:app-short-sync:run'];
    }
    case '/auth/menu/current': {
      return menuFixture();
    }
    case '/auth/user/access_token': {
      return {
        access_token: 'e2e-token',
        exp_at: 4_102_444_800,
        exp_in: 3600,
        token_type: 'Bearer',
        uid: 1,
      };
    }
    case '/auth/user/user_info': {
      return {
        avatar: '',
        created_at: 1,
        dept_id: 0,
        email: 'admin@example.test',
        enabled: true,
        home_path: '/res/seas/app_short_sync',
        id: 1,
        is_guest: false,
        name: '管理员',
        os: 'web',
        permission_count: 4,
        platform: 'web',
        reg_ip: '127.0.0.1',
        tel: '',
        updated_at: 1,
      };
    }
    default: {
      return null;
    }
  }
}

function menuFixture() {
  return [
    {
      auth_code: '',
      component: 'BasicLayout',
      enabled: true,
      id: 1,
      meta: { icon: 'lucide:library', keep_alive: true },
      name: 'Res',
      order_no: 1,
      path: '/res',
      perm_type: 'catalog',
      pid: 0,
      redirect: '/res/seas/app_short_sync',
      title: '资源模块',
    },
    {
      auth_code: '',
      component: '/res/seas/app_short_sync/index',
      enabled: true,
      id: 2,
      meta: { keep_alive: true },
      name: 'ResAppShortSync',
      order_no: 1,
      path: '/res/seas/app_short_sync',
      perm_type: 'menu',
      pid: 1,
      redirect: null,
      title: '短剧同步',
    },
  ];
}
