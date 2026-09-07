import type { Page, Route } from '@playwright/test';

import { Buffer } from 'node:buffer';

import { KxEd } from '@kx/admin-core';
import { expect, test } from '@playwright/test';

const ok = (result: unknown) => ({ code: 200, msg: 'ok', result });
test.use({ headless: true });

test('Apple 设备资产搜索、账户筛选和分页重置', async ({ page }, info) => {
  await mockAuth(page, true);
  const queries: URLSearchParams[] = [];
  const devices = Array.from({ length: 25 }, (_, index) => ({
    id: index + 1,
    device_no: `DEVICE-${index + 1}`,
    name: `MacBook ${index + 1}`,
    developer_account_id: index === 24 ? 2 : 1,
    model: 'MacBook Air',
    serial_number: `SERIAL-${index + 1}`,
    user: 'Alice',
    remark: '办公资产',
    updated_at: 1,
  }));
  let slowStarted = false;
  let slowFinished = false;
  await page.context().route('**/developer-account/**', async (route) => {
    if (!['fetch', 'xhr'].includes(route.request().resourceType()))
      return route.continue();
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/accounts')) {
      await fulfillApi(
        route,
        pageResult([
          accountListItem(),
          { ...accountListItem(), id: 2, account: 'other@example.test' },
        ]),
      );
      return;
    }
    if (url.pathname.endsWith('/apple-devices')) {
      queries.push(url.searchParams);
      const keyword = url.searchParams.get('keyword') ?? '';
      if (keyword === 'slow') {
        slowStarted = true;
        await new Promise((resolve) => setTimeout(resolve, 600));
      }
      const items = devices.filter(
        (device) =>
          (!url.searchParams.has('developer_account_id') ||
            String(device.developer_account_id) ===
              url.searchParams.get('developer_account_id')) &&
          [
            device.device_no,
            device.name,
            device.model,
            device.serial_number,
            device.user,
            device.remark,
          ].some((value) => value.includes(keyword)),
      );
      await fulfillApi(route, items);
      if (keyword === 'slow') slowFinished = true;
      return;
    }
    await fulfillApi(route, null);
  });
  await page.goto('/');
  await page.locator("input[name='username']").fill('admin');
  await page.locator("input[name='password']").fill('test-only');
  await page.getByRole('button', { name: /登录|login/i }).click();
  await expect(page).toHaveURL(/developer-account\/apple-devices/);
  await expect(
    page.getByRole('cell', { name: 'DEVICE-1', exact: true }),
  ).toBeVisible();
  await page.locator('.ant-pagination-item-3').click();
  await expect(
    page.getByRole('cell', { name: 'DEVICE-25', exact: true }),
  ).toBeVisible();
  const search = page.getByRole('textbox', { name: '搜索设备资产' });
  await search.fill(' SERIAL-25 ');
  await search.press('Enter');
  await expect.poll(() => queries.at(-1)?.get('keyword')).toBe('SERIAL-25');
  await expect(
    page.getByRole('cell', { name: 'DEVICE-25', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.ant-pagination-item-active')).toHaveText('1');
  await search.fill('slow');
  await search.press('Enter');
  await expect.poll(() => slowStarted).toBe(true);
  await search.fill('SERIAL-25');
  await search.press('Enter');
  await expect.poll(() => slowFinished).toBe(true);
  await expect(
    page.getByRole('cell', { name: 'DEVICE-25', exact: true }),
  ).toBeVisible();
  await page.locator('.device-search .ant-input-clear-icon').click();
  await expect.poll(() => queries.at(-1)?.has('keyword')).toBe(false);
  await expect(
    page.getByRole('cell', { name: 'DEVICE-1', exact: true }),
  ).toBeVisible();
  await page.getByRole('combobox', { name: '筛选开发者账户' }).click();
  await page.getByTitle('other@example.test', { exact: true }).click();
  await expect
    .poll(() => queries.at(-1)?.get('developer_account_id'))
    .toBe('2');
  await expect(
    page.getByRole('cell', { name: 'DEVICE-25', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('cell', { name: 'DEVICE-1', exact: true }),
  ).toHaveCount(0);
  await search.fill('missing-device');
  await search.press('Enter');
  await expect(page.locator('.ant-empty-description')).toHaveText('暂无数据');
  await page.getByRole('button', { name: '刷新设备资产' }).click();
  await expect
    .poll(() => queries.at(-1)?.get('keyword'))
    .toBe('missing-device');
  expect(queries.at(-1)?.get('developer_account_id')).toBe('2');
  await search.fill('SERIAL-25');
  await search.press('Enter');
  await expect(
    page.getByRole('cell', { name: 'DEVICE-25', exact: true }),
  ).toBeVisible();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.waitForTimeout(500);
    await expect(page.getByText('登录成功', { exact: true })).toBeHidden();
    await expect
      .poll(async () => {
        const box = await page.locator('.device-search').boundingBox();
        return box ? box.x + box.width : 2000;
      })
      .toBeLessThanOrEqual(width);
    await page.screenshot({
      path: info.outputPath(`apple-device-search-${width}.png`),
      fullPage: true,
      animations: 'disabled',
    });
  }
});

test('developer account relation and credential controls form a complete workflow', async ({
  page,
}) => {
  await mockAuth(page);
  await mockDeveloperAccount(page);
  await mockDictionary(page);
  const requestedCredentialKinds = await mockCredential(page);

  await page.goto('/');
  await page.locator("input[name='username']").fill('admin');
  await page.locator("input[name='password']").fill('123456');
  await page.getByRole('button', { name: /登录|login/i }).click();

  await expect(page.getByText('developer@example.test')).toBeVisible();
  await page.getByRole('button', { name: '未关联主体' }).click();

  const accountDialog = page.getByRole('dialog', { name: '编辑开发者账户' });
  await expect(accountDialog).toBeVisible();
  await expect(
    accountDialog.getByText('账户状态', { exact: true }),
  ).toBeVisible();
  await expect(
    accountDialog.getByRole('button', { name: '刷新凭证列表' }),
  ).toBeVisible();
  await expect
    .poll(() => [...requestedCredentialKinds].toSorted())
    .toEqual(['password', 'username_password']);

  await accountDialog
    .locator('.ant-form-item')
    .filter({ hasText: '密码凭证' })
    .getByRole('combobox')
    .click();
  await page.getByRole('button', { name: '新增凭证', exact: true }).click();
  const create = page.getByRole('dialog', { name: '新增凭证', exact: true });
  await expect(create).toBeVisible();
  await expect(create.getByText('密钥', { exact: true })).toBeVisible();
  await create.getByRole('button', { name: /取\s*消/ }).click();
});

async function mockAuth(page: Page, deviceHome = false) {
  await page.context().route('**/{notify,param}/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    await fulfillApi(
      route,
      path.endsWith('/notify/inbox') ? { items: [], unread_count: 0 } : null,
    );
  });
  await page.context().route('**/auth/**', async (route) => {
    const path = new URL(route.request().url()).pathname.replace(
      /^\/api(?=\/)/,
      '',
    );
    const result = authFixture(path);
    if (deviceHome && result && 'home_path' in result)
      result.home_path = '/developer-account/apple-devices';
    await fulfillApi(route, result);
  });
}

async function mockDeveloperAccount(page: Page) {
  await page.context().route('**/developer-account/**', async (route) => {
    const path = new URL(route.request().url()).pathname.replace(
      /^\/api(?=\/)/,
      '',
    );
    if (path === '/developer-account/accounts') {
      await fulfillApi(route, pageResult([accountListItem()]));
      return;
    }
    if (path === '/developer-account/accounts/1') {
      await fulfillApi(route, accountDetail());
      return;
    }
    if (path === '/developer-account/apple-devices') {
      await fulfillApi(route, []);
      return;
    }
    if (path === '/developer-account/subjects') {
      await fulfillApi(route, []);
      return;
    }
    if (path === '/developer-account/certifiers') {
      await fulfillApi(route, []);
      return;
    }
    await fulfillApi(route, null);
  });
}

async function mockDictionary(page: Page) {
  await page.context().route('**/param/dic/**', async (route) => {
    const path = new URL(route.request().url()).pathname.replace(
      /^\/api(?=\/)/,
      '',
    );
    if (path.endsWith('/get_dic/developer_account_status')) {
      await fulfillApi(route, {
        code: 'developer_account_status',
        created_at: 1,
        dic_name: '开发者账户状态',
        enabled: true,
        help_msg: '',
        remark: '',
      });
      return;
    }
    if (path.endsWith('/data_list/developer_account_status')) {
      await fulfillApi(route, [
        {
          created_at: 1,
          dic_code: 'developer_account_status',
          enabled: true,
          id: 1,
          is_def: true,
          label: '注册完成',
          remark: '',
          sort_no: 1,
          value: '注册完成',
        },
      ]);
      return;
    }
    await fulfillApi(route, null);
  });
}

async function mockCredential(page: Page) {
  const requestedKinds = new Set<string>();
  await page.context().route('**/credential/**', async (route) => {
    if (route.request().resourceType() === 'document') {
      await route.continue();
      return;
    }
    const path = new URL(route.request().url()).pathname.replace(
      /^\/api(?=\/)/,
      '',
    );
    if (path === '/credential/types') {
      await fulfillApi(route, {
        profiles: [
          {
            allowed_headers: [],
            fields: [
              {
                field_type: 'password',
                label: '密码',
                max_length: 512,
                name: 'password',
                required: true,
              },
            ],
            kind: 'password',
            label: '密码',
            profile: 'generic',
          },
          {
            allowed_headers: [],
            fields: [
              {
                field_type: 'text',
                label: '账号',
                max_length: 160,
                name: 'username',
                required: true,
              },
              {
                field_type: 'password',
                label: '密码',
                max_length: 512,
                name: 'password',
                required: true,
              },
              {
                field_type: 'text',
                label: '登录地址',
                max_length: 512,
                name: 'base_url',
                required: false,
              },
            ],
            kind: 'username_password',
            label: '账号密码',
            profile: 'generic',
          },
        ],
      });
      return;
    }
    if (path === '/credential/items' || path === '/credential/items/all') {
      const kind = new URL(route.request().url()).searchParams.get('kind');
      if (kind) requestedKinds.add(kind);
      const items =
        kind === 'password'
          ? [credentialItem('password', 'developer-account.shared')]
          : [credentialItem('username_password', 'developer-account.main')];
      await fulfillApi(
        route,
        path.endsWith('/all') ? items : pageResult(items),
      );
      return;
    }
    if (path === '/credential/items/developer-account.main') {
      await fulfillApi(route, credentialItem());
      return;
    }
    await fulfillApi(route, null);
  });
  return requestedKinds;
}

async function fulfillApi(route: Route, result: unknown) {
  if (!['fetch', 'xhr'].includes(route.request().resourceType())) {
    await route.continue();
    return;
  }
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
      return [
        'credential:create',
        'developer-account:create',
        'developer-account:update',
      ];
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
        home_path: '/developer-account/accounts',
        id: 1,
        is_guest: false,
        name: '管理员',
        os: 'web',
        permission_count: 3,
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
      id: 5,
      pid: 1,
      name: 'AppleDevices',
      title: 'Apple 设备资产',
      path: '/developer-account/apple-devices',
      component: '/developer-account/devices/list',
      perm_type: 'menu',
      enabled: true,
      order_no: 2,
      auth_code: '',
      meta: {},
    },
    {
      auth_code: '',
      component: 'BasicLayout',
      enabled: true,
      id: 1,
      meta: { icon: 'lucide:contact-round', keep_alive: true },
      name: 'DeveloperAccount',
      order_no: 1,
      path: '/developer-account',
      perm_type: 'catalog',
      pid: 0,
      redirect: '/developer-account/accounts',
      title: '账户管理',
    },
    {
      auth_code: '',
      component: '/developer-account/accounts/list',
      enabled: true,
      id: 2,
      meta: { keep_alive: true },
      name: 'DeveloperAccountList',
      order_no: 1,
      path: '/developer-account/accounts',
      perm_type: 'menu',
      pid: 1,
      redirect: null,
      title: '开发者账户',
    },
    {
      auth_code: '',
      component: 'BasicLayout',
      enabled: true,
      id: 3,
      meta: { icon: 'lucide:key-round', keep_alive: true },
      name: 'Credential',
      order_no: 2,
      path: '/credential',
      perm_type: 'catalog',
      pid: 0,
      redirect: '/credential/items',
      title: '凭证管理',
    },
    {
      auth_code: '',
      component: '/credential/items/list',
      enabled: true,
      id: 4,
      meta: { keep_alive: true },
      name: 'CredentialItems',
      order_no: 1,
      path: '/credential/items',
      perm_type: 'menu',
      pid: 3,
      redirect: null,
      title: '凭证中心',
    },
  ];
}

function pageResult<T>(items: T[]) {
  return {
    items,
    paging: { page: 1, size: 100 },
    total: items.length,
    total_pages: 1,
  };
}

function accountListItem() {
  return {
    access_group_count: 0,
    access_user_count: 1,
    account: 'developer@example.test',
    app_count: 0,
    certifier_id: null,
    certifier_name: '',
    certifier_phone: '',
    device_count: 0,
    id: 1,
    platform: 'apple',
    registered_at: 1,
    renewal_due_at: 0,
    status: '注册完成',
    subject_id: null,
    subject_name_cn: '',
    subject_name_en: '',
    updated_at: 1,
    version: 0,
  };
}

function accountDetail() {
  return {
    account: 'developer@example.test',
    apps: [],
    certifier_id: null,
    created_at: 1,
    created_by: 1,
    credential_code: 'developer-account.main',
    devices: [],
    id: 1,
    payment_account: '',
    platform: 'apple',
    registered_at: 1,
    remark: '',
    renewal_due_at: 0,
    screen_share_account: '',
    screen_share_ip: '',
    status: '注册完成',
    subject_id: null,
    updated_at: 1,
    version: 0,
  };
}

function credentialItem(
  kind: 'password' | 'username_password' = 'username_password',
  code = 'developer-account.main',
) {
  return {
    binding_count: 1,
    code,
    created_at: 1,
    created_by: 1,
    expires_at: 0,
    id: 1,
    kind,
    name: kind === 'password' ? '共享开发者账号密码' : '开发者账号密码',
    not_before: 0,
    profile: 'generic',
    remark: '',
    retired_at: 0,
    state: 'active',
    summary: { fields: [] },
    updated_at: 1,
  };
}
