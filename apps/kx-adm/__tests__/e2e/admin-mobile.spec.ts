import type { Page } from '@playwright/test';

import { Buffer } from 'node:buffer';

import { KxEd } from '@kx/admin-core';
import { expect, test } from '@playwright/test';

test.use({ headless: true, actionTimeout: 10_000 });
test.describe.configure({ mode: 'parallel' });

const cases = [
  {
    path: '/developer-account/subjects',
    component: '/developer-account/subjects/list',
    title: '开发者主体',
    action: '新增主体',
  },
  {
    path: '/developer-account/accounts',
    component: '/developer-account/accounts/list',
    title: '开发者账户',
    action: '新增账户',
  },
  {
    path: '/developer-account/access-groups',
    component: '/developer-account/access-groups/list',
    title: '账户权限分组',
    action: '新增分组',
  },
  {
    path: '/software/applications',
    component: '/software/applications/list',
    title: '软件应用',
    action: '新增应用',
  },
  {
    path: '/res/seas/set/def_tmplate_lib',
    component: '/res/seas/set/def_tmplate_lib/index',
    title: '默认模板配置',
  },

  {
    path: '/system/user',
    component: '/system/user/list',
    title: '用户管理',
    action: '新增用户名',
  },
  {
    path: '/system/role',
    component: '/system/role/list',
    title: '角色管理',
    action: /新增角色/,
  },
  {
    path: '/system/data-sources',
    component: '/system/data-sources/list',
    title: '数据源管理',
    action: '新增数据源',
  },
  {
    path: '/developer-account/certifiers',
    component: '/developer-account/certifiers/list',
    title: '认证人',
    action: '新增认证人',
  },
  {
    path: '/account-manager/types',
    component: '/account-manager/types',
    title: '账户类型',
    action: '新增账户类型',
  },
  {
    path: '/payment-monitor/accounts',
    component: '/payment-monitor/accounts',
    title: '支付账户',
    action: '接入支付账户',
  },
  {
    path: '/data-sync',
    component: '/data-sync/index',
    title: '数据同步',
    action: '新增任务',
  },
  {
    path: '/cookie-manager/assignments',
    component: '/cookie-manager/assignments',
    title: '网站使用授权',
  },
  {
    path: '/system/settings',
    component: '/system/settings/index',
    title: '系统设置',
  },
  { path: '/msg/overview', component: '/msg/overview/list', title: '设备概览' },
  {
    path: '/official-sites/themes',
    component: '/official-sites/themes',
    title: '官网主题',
  },
];

async function fixture(page: Page, target: (typeof cases)[number]) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/*', async (route) => {
    const req = route.request();
    if (!['fetch', 'xhr'].includes(req.resourceType())) return route.continue();
    const path = new URL(req.url()).pathname.replace(/^\/api(?=\/)/, '');
    const emptyPage = {
      items: [],
      total: 0,
      total_pages: 0,
      paging: { page: 1, size: 20 },
    };
    let result: unknown = [];
    if (path === '/auth/dt/exchange')
      result = {
        access_token: 'fixture-token',
        uid: 7,
        exp_at: 4_102_444_800,
        exp_in: 3600,
      };
    else if (path === '/auth/user/user_info')
      result = {
        id: 7,
        name: '管理员',
        enabled: true,
        roles: [{ role_id: 'admin', role_name: '管理员', enabled: true }],
        home_path: target.path,
      };
    else if (path === '/auth/per/codes')
      result = [
        'AC_100100',
        'cookie-manager:manage',
        'account-manager:type-write',
        'developer-account:certifier-create',
        'roles:manage',
        'payment-monitor:manage',
        'developer-account:subject-create',
        'developer-account:create',
        'developer_account_access:manage',
        'software:application:edit',
        'data-sync:configure',
      ];
    else if (path === '/auth/menu/current')
      result = [
        {
          id: 1,
          pid: 0,
          name: 'TestPage',
          title: target.title,
          path: target.path,
          component: target.component,
          perm_type: 'menu',
          enabled: true,
          order_no: 1,
          meta: {},
        },
      ];
    else if (path === '/notify/inbox') result = { items: [], unread_count: 0 };
    else if (path.includes('system-settings'))
      result = {
        display_name: '移动端测试',
        system_name: 'test',
        login_title: '',
        login_description: '',
        login_logo_url: '',
        login_banner_url: '',
        copyright_text: '',
        meilisearch_source: 'custom',
        meilisearch_url: '',
        meilisearch_credential_code: '',
        cookie_proxy_public: '',
        cookie_proxy_admin: '',
        cookie_proxy_listen: '',
      };
    else if (
      /page|user-admin$|roles$|data-sources$|accounts$|jobs$|sites$|assignment-candidates$|access-groups$|applications$/.test(
        path,
      )
    )
      result = emptyPage;
    else if (path === '/auth/dept/companies')
      result = [
        { id: -1, name: '公司', source_id: 'org', enabled: true, children: [] },
      ];
    const body = JSON.stringify({ code: 200, msg: 'ok', result });
    await route.fulfill({
      contentType: 'application/json',
      body:
        req.headers().security === 'true'
          ? Buffer.from(KxEd.encryptText(body))
          : body,
    });
  });
  await page.goto('/#/auth/login?exchange_code=fixture');
  await expect(page).toHaveURL(new RegExp(target.path));
  await expect(page.getByText('登录成功', { exact: true })).toBeHidden();
  return errors;
}

async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
}

for (const target of cases) {
  test(`${target.title}：360px布局与弹层`, async ({ page }, info) => {
    await page.setViewportSize({ width: 360, height: 800 });
    const errors = await fixture(page, target);
    await expect(page.locator('main').first()).not.toBeEmpty();
    await noOverflow(page);
    if (target.action) {
      const action = page.getByRole('button', {
        name: target.action,
        exact: typeof target.action === 'string',
      });
      await action.first().click();
      const dialog = page.getByRole('dialog').last();
      await expect(dialog).toBeVisible();
      await expect
        .poll(async () => {
          const box = await dialog.boundingBox();
          return !!box && box.x >= -1 && box.x + box.width <= 361;
        })
        .toBe(true);
      const save = dialog
        .getByRole('button', { name: /^(保\s*存|确\s*定|确\s*认)$/ })
        .last();
      if (await save.count()) await expect(save).toBeInViewport();
      await noOverflow(page);
    }
    await page.screenshot({
      path: info.outputPath('mobile.png'),
      animations: 'disabled',
    });
    expect(errors).toEqual([]);
  });
}
