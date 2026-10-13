import { Buffer } from 'node:buffer';

import { KxEd } from '@kx/admin-core';
import { expect, test } from '@playwright/test';

test.use({ headless: true, viewport: { width: 1600, height: 1000 } });
test('设备申请人组织展示及服务端人员身份筛选', async ({ page }) => {
  test.setTimeout(60_000);
  const queries: URL[] = [];
  const people: URL[] = [];
  const row = {
    device_id: 'fixture-device',
    name: '研发电脑',
    status: 'pending',
    os: 'Windows',
    app_version: '0.1.7',
    requested_uid: 701,
    requested_name: '张三',
    requested_org_paths: ['甲公司 / 研发部 / 前端组', '甲公司 / 测试部'],
    assigned_uid: 702,
    assigned_name: '李四',
    last_login_uid: null,
    last_login_name: '',
    approved_name: '',
    approved_at: null,
    created_at: 1,
    last_seen_at: 1,
    last_login_at: null,
    last_ip: '',
    remark: '',
  };
  await page.route('**/{auth,param,storage,notify,adm}/**', async (route) => {
    const request = route.request();
    if (!['fetch', 'xhr'].includes(request.resourceType()))
      return route.continue();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api(?=\/)/, '');
    let result: unknown = [];
    if (path === '/auth/user/access_token')
      result = {
        access_token: 'fixture',
        uid: 1,
        exp_in: 3600,
        exp_at: 4_102_444_800,
      };
    else if (path.startsWith('/auth/user/tz')) result = 'Asia/Shanghai';
    else if (path === '/auth/user/user_info')
      result = {
        id: 1,
        name: '管理员',
        enabled: true,
        home_path: '/system/client-devices',
      };
    else if (path === '/auth/per/codes') result = ['client-devices:view'];
    else if (path === '/auth/menu/current')
      result = [
        {
          id: 1,
          pid: 0,
          name: 'SystemClientDevices',
          title: '客户端设备',
          perm_type: 'menu',
          path: '/system/client-devices',
          component: '/system/client-devices/list',
          enabled: true,
          order_no: 1,
          meta: {},
        },
      ];
    else if (path === '/auth/client-devices/users') {
      people.push(url);
      result = {
        items: [
          { uid: '701', name: '张三' },
          { uid: '702', name: '李四' },
        ],
        total: 2,
      };
    } else if (
      path === '/auth/client-devices' ||
      path === '/auth/client-devices/'
    ) {
      queries.push(url);
      result = { items: [row], total: 1 };
    } else if (path.endsWith('/events')) result = { items: [], total: 0 };
    else if (path === '/notify/inbox') result = { items: [], unread_count: 0 };
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
  await page.locator("input[name='username']").fill('admin');
  await page.locator("input[name='password']").fill('123456');
  await page.getByRole('button', { name: /登录|login/i }).click();
  await expect(
    page.getByText('甲公司 / 研发部 / 前端组', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('甲公司 / 测试部', { exact: true }),
  ).toBeVisible();
  const person = page.getByRole('combobox', { name: '人员', exact: true });
  await person.click();
  await person.fill('张三');
  await expect
    .poll(() => people.at(-1)?.searchParams.get('keyword'))
    .toBe('张三');
  await page.getByTitle('张三（701）', { exact: true }).click();
  await expect.poll(() => queries.at(-1)?.searchParams.get('uid')).toBe('701');
  await page.getByRole('combobox', { name: '匹配身份', exact: true }).click();
  await page.getByTitle('申请人', { exact: true }).click();
  await expect
    .poll(() => queries.at(-1)?.searchParams.get('user_role'))
    .toBe('requested');
  await page.getByRole('button', { name: '记录', exact: true }).click();
  const drawer = page.getByRole('dialog');
  await expect(drawer).toContainText('申请人：张三');
  await expect(drawer).toContainText('甲公司 / 研发部 / 前端组');
  await drawer.getByRole('button', { name: /关闭|Close/ }).click();
  await page.getByRole('button', { name: /重\s*置/ }).click();
  await expect.poll(() => queries.at(-1)?.searchParams.get('uid')).toBeNull();
  await expect
    .poll(() => queries.at(-1)?.searchParams.get('user_role'))
    .toBe('any');
  await expect(
    page.getByRole('button', { name: '授权', exact: true }),
  ).toHaveCount(0);
  await page.screenshot({
    path: test.info().outputPath('client-device-people.png'),
    fullPage: true,
  });
});
