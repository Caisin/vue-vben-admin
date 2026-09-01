import type { Page, Route } from '@playwright/test';

import { Buffer } from 'node:buffer';

import { KxEd } from '@kx/admin-core';
import { expect, test } from '@playwright/test';

const ok = (result: unknown) => ({ code: 200, msg: 'ok', result });

test('file share details, owner files, and protected copy form a complete workflow', async ({
  context,
  page,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await mockAuth(page);
  await mockNotifications(page);
  const storageRequests = await mockStorage(page);

  await page.goto('/');
  await page.getByPlaceholder(/请输入用户名|username/i).fill('admin');
  await page.getByPlaceholder(/密码|password/i).fill('123456');
  await page.getByRole('button', { name: /登录|login/i }).click();
  await page.waitForURL('**/storage/shares');

  await expect(page.getByText('商务方案与报价资料')).toBeVisible();
  await page.getByRole('button', { name: /商务方案与报价资料/ }).click();

  await expect(page.getByText('分享详情 · 商务方案与报价资料')).toBeVisible();
  await expect(page.getByRole('tab', { name: '概览' })).toBeVisible();
  await page.getByRole('tab', { name: '文件 (1)' }).click();
  await expect(page.getByText('proposal.pdf')).toBeVisible();

  await page.getByRole('button', { name: '下载', exact: true }).click();
  await expect.poll(() => storageRequests.ownerFileReads).toBe(1);

  await page.locator('.ant-drawer-close').click();
  await page.getByLabel('复制分享信息').click();
  const confirm = page.getByRole('dialog', { name: '需要重新生成下载密码' });
  await expect(confirm).toBeVisible();
  await confirm.getByRole('button', { name: '重置并复制分享信息' }).click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toContain('下载密码：A1B2C3');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
    '/s/share1234',
  );
  await page.getByRole('button', { name: '有密码' }).click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe('A1B2C3');
});

async function mockAuth(page: Page) {
  await page.context().route('**/auth/**', async (route) => {
    if (['document', 'script'].includes(route.request().resourceType())) {
      await route.continue();
      return;
    }
    const path = new URL(route.request().url()).pathname.replace(/^\/api/, '');
    await fulfillApi(route, authFixture(path));
  });
}

async function mockStorage(page: Page) {
  const requests = { ownerFileReads: 0 };
  await page.context().route('**/storage/share**', async (route) => {
    if (['document', 'script'].includes(route.request().resourceType())) {
      await route.continue();
      return;
    }
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/api/, '');
    if (path.endsWith('/files/11/content')) {
      requests.ownerFileReads += 1;
      await route.fulfill({
        body: 'proposal-content',
        contentType: 'application/pdf',
        headers: {
          'content-disposition': 'attachment; filename="proposal.pdf"',
        },
      });
      return;
    }
    if (
      path.endsWith('/download-policy') &&
      route.request().method() === 'PUT'
    ) {
      await fulfillApi(route, {
        ...shareFixture(),
        download_password: 'A1B2C3',
      });
      return;
    }
    if (path === '/storage/share') {
      await fulfillApi(route, pageResult([shareFixture()]));
      return;
    }
    await fulfillApi(route, null);
  });
  return requests;
}

async function mockNotifications(page: Page) {
  await page.context().route('**/notify/inbox**', async (route) => {
    if (['document', 'script'].includes(route.request().resourceType())) {
      await route.continue();
      return;
    }
    await fulfillApi(route, pageResult([]));
  });
}

async function fulfillApi(route: Route, result: unknown) {
  const body = JSON.stringify(ok(result));
  const encrypted = route.request().headers().security === 'true';
  await route.fulfill({
    body: encrypted ? Buffer.from(KxEd.encryptText(body)) : body,
    contentType: 'application/json',
  });
}

function authFixture(path: string) {
  switch (path) {
    case '/auth/dt/apps': {
      return [];
    }
    case '/auth/menu/current': {
      return menuFixture();
    }
    case '/auth/per/codes': {
      return [];
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
        business_contact: {
          company: 'KX 商务中心',
          contact_name: '张经理',
          email: 'biz@example.test',
          phone: '13800000000',
          title: '商务合作',
          website: 'https://example.test',
          wechat: 'kx-business',
        },
        created_at: 1,
        dept_id: 0,
        email: 'admin@example.test',
        enabled: true,
        home_path: '/storage/shares',
        id: 1,
        is_guest: false,
        name: '管理员',
        os: 'web',
        permission_count: 0,
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
      meta: { icon: 'lucide:folder', keep_alive: true },
      name: 'Storage',
      order_no: 1,
      path: '/storage',
      perm_type: 'catalog',
      pid: 0,
      redirect: '/storage/shares',
      title: '文件管理',
    },
    {
      auth_code: '',
      component: '/storage/shares/list',
      enabled: true,
      id: 2,
      meta: { keep_alive: true },
      name: 'StorageShares',
      order_no: 1,
      path: '/storage/shares',
      perm_type: 'menu',
      pid: 1,
      redirect: null,
      title: '文件分享',
    },
  ];
}

function pageResult<T>(items: T[]) {
  return {
    items,
    paging: { page: 1, size: 20 },
    total: items.length,
    total_pages: 1,
  };
}

function shareFixture() {
  const now = Math.floor(Date.now() / 1000);
  return {
    business_contact: {
      company: 'KX 商务中心',
      contact_name: '张经理',
      email: 'biz@example.test',
      phone: '13800000000',
      title: '商务合作',
      website: 'https://example.test',
      wechat: 'kx-business',
    },
    created_at: now,
    created_by: 1,
    downloadable: true,
    download_count: 2,
    download_limit: 10,
    download_start_at: 0,
    download_started: true,
    expired: false,
    expires_at: now + 86_400,
    file_count: 1,
    file_ext: 'pdf',
    file_id: 11,
    file_name: '商务方案与报价资料',
    files: [
      {
        file_ext: 'pdf',
        file_id: 11,
        file_name: 'proposal',
        size: 1024,
        storage_code: 'local',
      },
    ],
    id: 1,
    password_required: true,
    remaining_download_count: 8,
    share_url: '/s/share1234',
    sharer: '管理员',
    show_business_contact: true,
    size: 1024,
    storage_code: 'local',
    total_size: 1024,
    updated_at: now,
    view_count: 4,
  };
}
