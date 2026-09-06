import type { Route } from '@playwright/test';

import { Buffer } from 'node:buffer';

import { KxEd } from '@kx/admin-core';
import { expect, test } from '@playwright/test';

test.use({ headless: true });
test('卡片、启停、配置生效与 SSE 补读闭环', async ({ page }, info) => {
  test.setTimeout(90_000);
  const host = {
    id: 1,
    code: 'local',
    name: '测试节点',
    access_kind: 'local',
    os: 'linux',
    arch: 'x86_64',
    service_manager: 'systemd',
    state: 'enabled',
    version: 0,
  };
  const app = {
    id: 2,
    code: 'redis',
    name: 'Redis',
    provider: 'redis',
    application_kind: 'service',
    install_root: '/opt/kx',
    service_spec: { default_port: 6379 },
    source_kind: 'redis_official',
    state: 'enabled',
    version: 0,
  };
  const installation = {
    id: 3,
    server_id: 1,
    application_id: 2,
    instance_key: 'default',
    application_name: 'Redis',
    application_code: 'redis',
    server_name: '测试节点',
    server_code: 'local',
    observed_version: '7.2.0',
    previous_version: '7.1.0',
    state: 'running',
    health: 'healthy',
    version: 0,
    active_operation_id: null,
    config_pending: false,
    config_json: {
      install_method: 'package',
      package: { manager: 'apt' },
      runtime_settings: { port: '6379' },
    },
  };
  let operationId = 0;
  let action = '';
  const cursors: string[] = [];
  await page.context().route('**/*', async (route) => {
    if (!['fetch', 'xhr'].includes(route.request().resourceType())) {
      await route.continue();
      return;
    }
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/api(?=\/)/, '');
    if (!/^\/(auth|notify|param|software)(\/|$)/.test(path)) {
      await route.continue();
      return;
    }
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
        permission_count: 10,
      };
    else if (path === '/auth/per/codes')
      result = [
        'software:installation:create',
        'software:installation:lifecycle',
        'software:installation:config-apply',
        'software:server:edit',
        'software:server:probe',
        'software:application:edit',
      ];
    else if (path === '/auth/menu/current')
      result = ['installations', 'servers', 'applications', 'operations'].map(
        (name, index) => ({
          id: index + 1,
          pid: 0,
          name: `Software${name}`,
          title: name,
          path: `/software/${name}`,
          component: `/software/${name}/list`,
          perm_type: 'menu',
          enabled: true,
          order_no: index,
          auth_code: '',
          meta: {},
          redirect: null,
        }),
      );
    else if (path === '/notify/inbox') result = { items: [], unread_count: 0 };
    else if (path === '/software/servers') result = { items: [host], total: 1 };
    else if (path === '/software/applications')
      result = { items: [app], total: 1 };
    else if (path === '/software/installations')
      result = { items: [installation], total: 1 };
    else if (path === '/software/installations/3/config') {
      const data = body(route);
      expect(data.config_json.runtime_settings.port).toBe('6388');
      installation.config_json = data.config_json;
      installation.version++;
      installation.config_pending = true;
      result = installation;
    } else if (path.startsWith('/software/installations/3/actions/')) {
      action = path.split('/').at(-1) ?? '';
      const data = body(route);
      expect(data.target_version).toBeUndefined();
      expect(data.expected_row_version).toBe(installation.version);
      operationId++;
      result = { id: operationId, state: 'pending', step: 0, action };
    } else if (path.endsWith('/events')) {
      const after = url.searchParams.get('after') ?? '0';
      cursors.push(after);
      const complete = after !== '0';
      if (complete) {
        installation.state = action === 'stop' ? 'stopped' : 'running';
        if (action === 'apply-config') installation.config_pending = false;
      }
      const log = (id: number, content: string) =>
        `event: log\nid: ${id}\ndata: ${JSON.stringify({ id, operation_id: operationId, step: 1, stream: 'stdout', content })}\n\n`;
      const first = operationId * 10 + 1;
      const payload = `${
        log(first, `开始 ${action}\n`) +
        (complete ? log(first + 1, `完成 ${action}\n`) : '')
      }event: state\ndata: ${JSON.stringify({ id: operationId, state: complete ? 'succeeded' : 'running', step: complete ? 2 : 1, total_steps: 2, action, error_summary: '' })}\n\n`;
      await route.fulfill({ contentType: 'text/event-stream', body: payload });
      return;
    }
    await fulfill(route, result);
  });
  await page.goto('/');
  await page.locator("input[name='username']").fill('admin');
  await page.locator("input[name='password']").fill('e2e-placeholder');
  await page.getByRole('button', { name: /登录|login/i }).click();
  await expect(page).toHaveURL(/software\/installations$/, { timeout: 20_000 });
  for (const name of ['停止', '启动', '重启']) {
    await page.getByRole('button', { name, exact: true }).click();
    await page
      .getByRole('button', { name: `确认${name}`, exact: true })
      .click();
    const progress = page.getByRole('dialog', { name: '软件操作进度' });
    await expect(progress.getByRole('log')).toContainText('完成', {
      timeout: 10_000,
    });
    const logText = await progress.getByRole('log').innerText();
    expect(logText.match(/开始/g)?.length).toBe(1);
    await progress.getByRole('button', { name: /关闭|close/i }).click();
  }
  expect(cursors.slice(0, 2)).toEqual(['0', '11']);
  await page.getByRole('button', { name: '修改配置', exact: true }).click();
  const config = page.getByRole('dialog', { name: '编辑安装配置' });
  await config.getByRole('spinbutton').first().fill('6388');
  await config.getByRole('button', { name: '保存并应用', exact: true }).click();
  const progress = page.getByRole('dialog', { name: '软件操作进度' });
  await expect(progress.getByRole('log')).toContainText('完成 apply-config', {
    timeout: 10_000,
  });
  await page.screenshot({
    path: info.outputPath('live-log-desktop.png'),
    fullPage: true,
  });
  await progress.getByRole('button', { name: /关闭|close/i }).click();
  expect(installation.observed_version).toBe('7.2.0');
  for (const path of ['servers', 'applications']) {
    await page.goto(`/software/${path}`);
    await expect(page.locator('.software-resource-card')).toHaveCount(1);
    await page.screenshot({
      path: info.outputPath(`${path}-desktop.png`),
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.keyboard.press('Escape');
    const sidebarToggle = page.locator(
      '[data-layout-action="toggle-sidebar-collapse"]',
    );
    if (await sidebarToggle.isVisible()) await sidebarToggle.click();
    await expect(page.locator('.software-resource-card')).toBeInViewport({
      ratio: 1,
    });
    await page.locator('.software-resource-card h3').click({ trial: true });
    await page.screenshot({
      path: info.outputPath(`${path}-mobile.png`),
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.setViewportSize({ width: 1280, height: 720 });
  }
});

function body(route: Route) {
  const data = route.request().postDataBuffer();
  if (!data) throw new Error('missing body');
  return JSON.parse(
    route.request().headers().security === 'true'
      ? KxEd.decodeText(KxEd.decrypt(data))
      : data.toString(),
  );
}
async function fulfill(route: Route, result: unknown) {
  const data = JSON.stringify({ code: 200, msg: 'ok', result });
  await route.fulfill({
    contentType: 'application/json',
    body:
      route.request().headers().security === 'true'
        ? Buffer.from(KxEd.encryptText(data))
        : data,
  });
}
