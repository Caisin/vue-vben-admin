import type { Route } from '@playwright/test';

import { Buffer } from 'node:buffer';

import { KxEd } from '@kx/admin-core';
import { expect, test } from '@playwright/test';

test.use({ headless: true });

test('原生安装先检测已有软件，接管需明确勾选且保存包配置', async ({
  page,
}, info) => {
  let saved: Record<string, any> | undefined;
  let failDetection = false;
  const host = {
    id: 1,
    code: 'local',
    name: '本机',
    access_kind: 'local',
    os: 'darwin',
    arch: 'aarch64',
    service_manager: 'launchd',
    state: 'enabled',
    version: 0,
  };
  const app = {
    id: 2,
    code: 'mysql',
    name: 'MySQL',
    provider: 'mysql',
    application_kind: 'service',
    install_root: '/opt/kx',
    service_spec: { default_port: 3306 },
    state: 'enabled',
    version: 0,
  };
  await page.context().route('**/*', async (route) => {
    if (!['fetch', 'xhr'].includes(route.request().resourceType())) {
      await route.continue();
      return;
    }
    const path = new URL(route.request().url()).pathname.replace(
      /^\/api(?=\/)/,
      '',
    );
    let result: unknown = [];
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
        home_path: '/software/installations',
        avatar: '',
        dept_id: 0,
        is_guest: false,
        permission_count: 5,
      };
    else if (path === '/auth/per/codes')
      result = [
        'software:installation:create',
        'software:installation:install',
      ];
    else if (path === '/auth/menu/current')
      result = [
        {
          id: 1,
          pid: 0,
          name: 'SoftwareInstallations',
          title: '安装实例',
          path: '/software/installations',
          component: '/software/installations/list',
          perm_type: 'menu',
          enabled: true,
          order_no: 1,
          auth_code: '',
          meta: {},
          redirect: null,
        },
      ];
    else if (path === '/notify/inbox') result = { items: [], unread_count: 0 };
    else if (path === '/software/servers') result = { items: [host], total: 1 };
    else if (path === '/software/applications')
      result = { items: [app], total: 1 };
    else if (path === '/software/servers/1/software/detect') {
      if (failDetection) {
        await fulfill(route, null, 500, 'software_detection_failed');
        return;
      }
      result = {
        installed: true,
        manager: 'brew',
        service_manager: 'launchd',
        service_name: 'homebrew.mxcl.mysql@8.4',
        service_config_path:
          '/Users/operator/Library/LaunchAgents/homebrew.mxcl.mysql@8.4.plist',
        binary_path: '/opt/homebrew/opt/mysql@8.4/bin/mysqld',
        version_output: 'mysqld Ver 8.4.6',
        service_status: 'mysql@8.4:started',
      };
    } else if (
      path === '/software/installations' &&
      route.request().method() === 'POST'
    ) {
      const request = route.request();
      const body = request.postDataBuffer();
      if (!body) throw new Error('missing body');
      saved = JSON.parse(
        request.headers().security === 'true'
          ? KxEd.decodeText(KxEd.decrypt(body))
          : body.toString(),
      );
      result = { id: 3, ...saved };
    } else if (path === '/software/installations')
      result = { items: [], total: 0 };
    await fulfill(route, result);
  });
  await page.goto('/');
  await page.locator("input[name='username']").fill('admin');
  await page.locator("input[name='password']").fill('e2e-placeholder');
  await page.getByRole('button', { name: /登录|login/i }).click();
  await expect(page).toHaveURL(/software\/installations$/, { timeout: 20_000 });
  await page.getByRole('button', { name: '新建实例', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '新建安装实例' });
  await dialog.getByRole('combobox').nth(0).click();
  await page.getByTitle('本机 (local)', { exact: true }).click();
  await dialog.getByRole('combobox').nth(1).click();
  await page.getByTitle('MySQL (mysql)', { exact: true }).click();
  await expect(dialog.getByText('系统包管理器', { exact: true })).toBeVisible();
  await expect(
    dialog.getByText('数据库管理员凭证', { exact: true }),
  ).toHaveCount(0);
  const adopt = dialog.getByRole('checkbox', {
    name: '允许接管设备上已有的软件包与服务',
  });
  await expect(adopt).not.toBeChecked();
  await dialog.getByRole('button', { name: '检测已有安装' }).click();
  await expect(
    dialog.getByText('mysqld Ver 8.4.6', { exact: true }),
  ).toBeVisible();
  await expect(dialog.getByText('launchd', { exact: true })).toBeVisible();
  await expect(adopt).not.toBeChecked();
  await page.screenshot({
    path: info.outputPath('software-package-desktop.png'),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await adopt.scrollIntoViewIfNeeded();
  await expect(adopt).toBeInViewport();
  await page.screenshot({
    path: info.outputPath('software-package-mobile.png'),
    fullPage: true,
  });
  failDetection = true;
  await dialog.getByRole('button', { name: '检测已有安装' }).click();
  await expect(dialog.getByRole('alert')).toContainText(
    'software_detection_failed',
  );
  await expect(dialog.getByText('标准路径未发现安装')).toHaveCount(0);
  await adopt.check();
  await dialog
    .getByRole('button', { name: /创建实例|保存配置/ })
    .last()
    .click();
  await expect.poll(() => saved?.config_json.install_method).toBe('package');
  expect(saved?.config_json.package.adopt_existing).toBe(true);
  expect(saved?.admin_credential_code).toBeUndefined();
});

async function fulfill(route: Route, result: unknown, code = 200, msg = 'ok') {
  const body = JSON.stringify({ code, msg, result });
  await route.fulfill({
    contentType: 'application/json',
    body:
      route.request().headers().security === 'true'
        ? Buffer.from(KxEd.encryptText(body))
        : body,
  });
}
