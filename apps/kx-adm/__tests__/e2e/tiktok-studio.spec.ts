import { Buffer } from 'node:buffer';

import { KxEd } from '@kx/admin-core';
import { expect, test } from '@playwright/test';

test.use({ headless: true, actionTimeout: 10_000 });
test('TikTok菜单、云端多账号、独立清单、可视化与并发设置（模拟服务）', async ({
  page,
}) => {
  test.setTimeout(60_000);
  const accounts: Record<string, any> = {};
  await page.addInitScript(() => {
    const host = window as unknown as Record<string, unknown>;
    host.isTauri = true;
    host.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener() {} };
    const profile = (uid: string) => ({
      uid,
      nickname: uid === '7' ? '运营A' : '运营B',
      timezone: 'Asia/Shanghai',
      minDelaySeconds: 900,
      maxDelaySeconds: 864_000,
      privateAccount: false,
    });
    const active = () => sessionStorage.getItem('tt-fixture-active');
    const read = () =>
      JSON.parse(localStorage.getItem(`tt-fixture-${active()}`) || 'null');
    const save = (value: unknown) =>
      localStorage.setItem(`tt-fixture-${active()}`, JSON.stringify(value));
    const kx = {
      apiBase: '/api',
      uid: '7',
      token: 'fixture',
      generation: 1,
      expiresAt: 4_102_444_800,
    };
    host.__TAURI_INTERNALS__ = {
      transformCallback() {
        return 1;
      },
      convertFileSrc() {
        return 'https://example.test/preview.mp4';
      },
      async invoke(command: string, args: Record<string, unknown>) {
        if (command.startsWith('plugin:event|')) return 1;
        if (command === 'desktop_bootstrap')
          return { apiBase: '/api', generation: 1, session: null };
        if (
          [
            'desktop_import_session',
            'desktop_refresh_session',
            'desktop_restore_session',
          ].includes(command)
        )
          return kx;
        if (command === 'desktop_clear_session') return;
        if (command === 'tiktok_import_cookie') {
          const input = args.input as Record<string, unknown>;
          if (input.cookie === 'invalid') throw new Error('Cookie 未通过验证');
          const uid = String(input.cookie).includes('account-B') ? '8' : '7';
          if (input.expectedAccountId && input.expectedAccountId !== uid)
            throw new Error('Cookie 所属账号与目标账号不同');
          if (input.activate !== false)
            sessionStorage.setItem('tt-fixture-active', uid);
          return {
            account: profile(uid),
            cookie: input.cookie,
            userAgent: 'fixture-agent',
          };
        }
        if (command === 'tiktok_session')
          return active()
            ? {
                account: profile(active() ?? '7'),
                cookie: `fixture-account-${active() === '8' ? 'B' : 'A'}`,
                userAgent: 'fixture-agent',
              }
            : null;
        if (command === 'tiktok_account') return profile(active() ?? '7');
        if (command === 'tiktok_logout') {
          sessionStorage.removeItem('tt-fixture-active');
          return;
        }
        if (command === 'tiktok_list') return read();
        if (command === 'tiktok_pick_directory') {
          const value = {
            name: `${profile(active() ?? '7').nickname}的视频`,
            revision: 1,
            account: profile(active() ?? '7'),
            files: ['01.mp4', '02.mp4'].map((name, index) => ({
              id: String(index),
              name,
              relative: name,
              size: 1024,
              bytes: 0,
              uploadPercent: 0,
              status: 'pending',
              message: '',
              schedule: null,
              media: null,
              itemId: null,
            })),
          };
          save(value);
          return value;
        }
        if (command === 'tiktok_plan') {
          const edit = args.edit as {
            items: { id: string; schedule: unknown }[];
          };
          const value = read();
          for (const item of edit.items)
            value.files.find((f: { id: string }) => f.id === item.id).schedule =
              item.schedule;
          value.revision += 1;
          save(value);
          return value;
        }
        if (command === 'tiktok_preview') return '/fixture/01.mp4';
        if (command === 'tiktok_upload') {
          localStorage.setItem('tt-submitted', JSON.stringify(args));
          const value = read();
          value.files[0].status = 'scheduled';
          value.files[0].bytes = 1024;
          value.files[0].itemId = '7000000000000000002';
          value.files[1].status = 'review';
          value.files[1].message = '发布回执丢失，请核对官方预约';
          value.files[1].bytes = 1024;
          value.revision += 1;
          save(value);
          throw new Error('第二条结果未知');
        }
        if (command === 'tiktok_reconcile') {
          const value = read();
          const file = value.files.find(
            (f: { id: string }) => f.id === args.id,
          );
          file.status = args.itemId ? 'scheduled' : 'pending';
          file.itemId = args.itemId;
          value.revision += 1;
          save(value);
          return;
        }
        if (command === 'tiktok_pause') return;
        throw new Error(`Unexpected command ${command}`);
      },
    };
  });
  await page.route('**/api/**', async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname.replace(/^\/api(?=\/)/, '');
    if (!new URL(req.url()).pathname.startsWith('/api/'))
      return route.continue();
    const body = () =>
      JSON.parse(KxEd.decryptText(req.postDataBuffer() ?? Buffer.from([])));
    let result: unknown = {};
    if (path === '/auth/dt/exchange')
      result = {
        access_token: 'fixture',
        uid: 7,
        exp_at: 4_102_444_800,
        exp_in: 3600,
      };
    else if (path === '/auth/user/user_info')
      result = {
        id: 7,
        name: '运营管理员',
        enabled: true,
        home_path: '/tiktok/studio',
      };
    else if (path === '/auth/per/codes') result = ['tiktok:account-manage'];
    else if (path === '/auth/menu/current')
      result = [
        {
          id: 1,
          pid: 0,
          name: 'TikTokStudio',
          title: 'TikTok发布工作台',
          path: '/tiktok/studio',
          component: '/tiktok/studio',
          perm_type: 'menu',
          enabled: true,
          order_no: 1,
          meta: { icon: 'lucide:video' },
        },
      ];
    else if (path === '/notify/inbox') result = { items: [], unread_count: 0 };
    else if (path === '/cookie-manager/tiktok/accounts') {
      if (req.method() === 'POST') {
        const input = body();
        const uid = input.session.account.uid;
        accounts[uid] = {
          ...input,
          account: input.session.account,
          enabled: true,
          version: (accounts[uid]?.version ?? 0) + 1,
          updated_at: 1_800_000_000,
        };
        result = accounts[uid];
      } else
        result = Object.values(accounts).map(
          ({ session: _session, ...view }) => view,
        );
    } else if (
      path.endsWith('/session') &&
      path.startsWith('/cookie-manager/tiktok/')
    )
      result = accounts[path.split('/').at(-2) ?? '']?.session;
    else if (
      path.endsWith('/name') &&
      path.startsWith('/cookie-manager/tiktok/')
    ) {
      const account = accounts[path.split('/').at(-2) ?? ''];
      account.label = body().name;
      account.version += 1;
      result = account;
    } else if (
      path.startsWith('/cookie-manager/tiktok/') &&
      req.method() === 'DELETE'
    ) {
      accounts[path.split('/').at(-1) ?? ''].enabled = false;
      result = true;
    }
    await route.fulfill({
      contentType: 'application/json',
      body: Buffer.from(
        KxEd.encryptText(JSON.stringify({ code: 200, result })),
      ),
    });
  });
  await page.goto('/#/auth/login?exchange_code=fixture');
  await expect(
    page.getByRole('menuitem', { name: 'TikTok发布工作台' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'TikTok 批量预约发布' }),
  ).toBeVisible();
  await page.getByRole('button', { name: '添加账号', exact: true }).click();
  const login = page.getByRole('dialog', { name: '添加TikTok账号' });
  await login.getByLabel('Cookie 请求头').fill('invalid');
  await login.getByRole('button', { name: '验证并保存账号' }).click();
  await expect(login.getByText('Error: Cookie 未通过验证')).toBeVisible();
  await login.getByLabel('Cookie 请求头').fill('fixture-account-A');
  await login.getByLabel('账号备注（可选）').fill('主账号');
  await login.getByRole('button', { name: '验证并保存账号' }).click();
  await expect(login).toHaveCount(0);
  expect(accounts['7'].session.cookie).toBe('fixture-account-A');
  expect(
    await page.evaluate(() => localStorage.getItem('kx-adm.tiktok-cookie.v1')),
  ).toBeNull();
  await page.getByRole('button', { name: '选择本地视频目录' }).click();
  await expect(
    page.getByRole('region', { name: '视频数据概览' }),
  ).toBeVisible();
  await page.getByRole('button', { name: '应用到勾选视频' }).click();
  await page.getByLabel('01.mp4 视频描述').fill('第一条预约标题');
  await expect(
    page.getByRole('checkbox', { name: '01.mp4 内容检测' }),
  ).not.toBeChecked();
  await page.getByRole('checkbox', { name: '01.mp4 内容检测' }).check();
  await page.getByLabel('同时上传视频数').fill('2');
  await page.getByRole('button', { name: '保存预约计划' }).click();
  await page.getByRole('button', { name: '确认批量预约' }).click();
  const confirm = page.getByRole('dialog', { name: '确认预约发布清单' });
  await expect(confirm.getByText(/同时处理 2 个视频/)).toBeVisible();
  await confirm.getByRole('button', { name: '提交这些预约' }).click();
  await expect(page.getByText('存在结果待核对的预约')).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('tt-submitted') ?? 'null').concurrency,
    ),
  ).toBe(2);
  await page.getByRole('button', { name: '添加账号', exact: true }).click();
  await login.getByLabel('Cookie 请求头').fill('fixture-account-B');
  await login.getByRole('button', { name: '验证并保存账号' }).click();
  await expect(page.getByText(/当前账号：运营B/)).toBeVisible();
  await expect(page.getByText('存在结果待核对的预约')).toHaveCount(0);
  await page.getByRole('button', { name: '账号管理', exact: true }).click();
  const manager = page.getByRole('dialog', { name: 'TikTok账号管理' });
  await manager
    .getByRole('row')
    .filter({ hasText: '主账号' })
    .getByRole('button', { name: /^切\s*换$/ })
    .click();
  await expect(page.getByText('视频 ID：7000000000000000002')).toBeVisible();
  await page.getByLabel('官方视频 ID').fill('7000000000000000003');
  await page.getByRole('button', { name: '确认已预约', exact: true }).click();
  await page.getByRole('button', { name: /^(OK|确定|确 定)$/ }).click();
  await expect(page.getByText('存在结果待核对的预约')).toHaveCount(0);
  await page
    .getByRole('heading', { name: 'TikTok 批量预约发布' })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: 'node_modules/.e2e/tiktok-multi-account.png',
    fullPage: true,
  });
  await page.reload();
  await expect(page.getByText('视频 ID：7000000000000000003')).toBeVisible();
  await expect(
    page.getByRole('button', { name: /打开.*官方|扫码/ }),
  ).toHaveCount(0);
});
