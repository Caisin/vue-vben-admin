import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { chromium, expect, test } from '@playwright/test';

test('Chrome扩展真实Cookie写入、账号切换及离线清空退出', async () => {
  test.setTimeout(60_000);
  const temp = await mkdtemp(join(tmpdir(), 'kx-cookie-extension-'));
  const extension = join(temp, 'extension');
  await cp(resolve('../../../browser-extensions/cookie-sync'), extension, {
    recursive: true,
  });
  const manifest = JSON.parse(
    await readFile(join(extension, 'manifest.json'), 'utf8'),
  );
  manifest.host_permissions = [
    'https://*.example.com/*',
    'http://localhost/*',
    'https://share.qinjiu8.com/*',
  ];
  await writeFile(join(extension, 'manifest.json'), JSON.stringify(manifest));
  const context = await chromium.launchPersistentContext(
    join(temp, 'profile'),
    {
      channel: 'chromium',
      headless: true,
      args: [
        `--disable-extensions-except=${extension}`,
        `--load-extension=${extension}`,
      ],
    },
  );
  try {
    let worker = context.serviceWorkers()[0];
    if (!worker) worker = await context.waitForEvent('serviceworker');
    const popup = await context.newPage();
    await popup.goto(
      `chrome-extension://${new URL(worker.url()).host}/popup.html`,
    );
    await popup.locator('#environment').selectOption('development');
    await popup.getByRole('button', { name: '保存环境并授权访问' }).click();
    await expect(popup.getByRole('status')).toContainText('开发环境已保存');
    await popup.evaluate(async () => {
      const api = (globalThis as any).chrome;
      await api.storage.session.set({
        cookieSyncSession: {
          secret: 'test-session',
          api: 'http://localhost:5555/api',
        },
        lastCookieSync: { siteName: 'old' },
      });
    });
    await popup.locator('#environment').selectOption('production');
    await popup.getByRole('button', { name: '保存环境并授权访问' }).click();
    await expect(popup.getByRole('status')).toContainText('生产环境已保存');
    const stored = await popup.evaluate(async () => {
      const api = (globalThis as any).chrome;
      return {
        local: await api.storage.local.get('cookieSyncConfig'),
        session: await api.storage.session.get([
          'cookieSyncSession',
          'lastCookieSync',
        ]),
      };
    });
    expect(stored.local.cookieSyncConfig.api).toBe(
      'https://share.qinjiu8.com/api',
    );
    expect(stored.session).toEqual({});
    const stale = await popup.evaluate(async () => {
      const api = (globalThis as any).chrome;
      return api.runtime.sendMessage({
        action: 'sync',
        environment: 'development',
        siteId: 1,
      });
    });
    expect(stale.ok).toBe(false);
    expect(stale.error).toContain('环境已在其它窗口改变');
    await context.route('https://share.qinjiu8.com/**', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: '<html><body>authorization fixture</body></html>',
      }),
    );
    const loginTabPromise = context.waitForEvent('page');
    await popup
      .getByRole('button', { name: '账号密码 / 钉钉登录', exact: true })
      .click();
    const loginTab = await loginTabPromise;
    await expect
      .poll(() => loginTab.url())
      .toMatch(
        /^https:\/\/share\.qinjiu8\.com\/#\/cookie-manager\/authorize\?challenge=[a-f0-9]{64}$/,
      );
    const authorizationLink = new URL(loginTab.url());
    const challenge = new URLSearchParams(
      authorizationLink.hash.split('?')[1],
    ).get('challenge');
    const expectedChallenge = await popup.evaluate(async () => {
      const api = (globalThis as any).chrome;
      const stored = await api.storage.session.get('cookieSyncSession');
      const bytes = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(stored.cookieSyncSession.secret),
      );
      return Array.from(new Uint8Array(bytes), (b) =>
        b.toString(16).padStart(2, '0'),
      ).join('');
    });
    expect(challenge).toBe(expectedChallenge);
    await loginTab.close();

    const result = await popup.evaluate(async () => {
      const api = (globalThis as any).chrome;
      const module = await import(api.runtime.getURL('cookie.js'));
      const expiration = Math.floor(Date.now() / 1000) + 3600;
      await api.cookies.set({
        url: 'https://app.example.com/',
        name: 'unmanaged',
        value: 'keep',
        secure: true,
        sameSite: 'lax',
        expirationDate: expiration,
      });
      const a = {
        name: 'account_token',
        value: 'fixture-account-A',
        domain: 'example.com',
        path: '/',
        secure: true,
        http_only: true,
        same_site: 'lax',
        expires_at: expiration,
      };
      const first = await module.applyCookies(api.cookies, {
        origin: 'https://app.example.com',
        cookies: [a, { ...a, name: 'old_only', value: 'old' }],
      });
      const second = await module.applyCookies(
        api.cookies,
        {
          origin: 'https://app.example.com',
          cookies: [{ ...a, value: 'fixture-account-B' }],
        },
        [
          {
            url: 'https://app.example.com/',
            name: 'account_token',
            domain: 'example.com',
            path: '/',
          },
          {
            url: 'https://app.example.com/',
            name: 'old_only',
            domain: 'example.com',
            path: '/',
          },
        ],
      );
      const rows = await api.cookies.getAll({
        url: 'https://app.example.com/',
      });
      return { first, second, expiration, rows };
    });
    expect(result.first.success).toBe(true);
    expect(result.second.success).toBe(true);
    const token = result.rows.find((c: any) => c.name === 'account_token');
    expect(token.value).toBe('fixture-account-B');
    expect(token.httpOnly).toBe(true);
    expect(token.expirationDate).toBe(result.expiration);
    expect(result.rows.some((c: any) => c.name === 'old_only')).toBe(false);
    expect(result.rows.find((c: any) => c.name === 'unmanaged').value).toBe(
      'keep',
    );

    await popup.evaluate(async () => {
      const api = (globalThis as any).chrome;
      await api.cookies.set({
        url: 'https://app.example.com/api',
        name: 'account_token',
        value: 'path-fixture',
        path: '/api',
        httpOnly: true,
        secure: true,
      });
      await api.cookies.set({
        url: 'https://example.com/',
        name: 'parent_host_only',
        value: 'keep-parent',
        secure: true,
      });
      await api.cookies.set({
        url: 'https://other.example.com/',
        name: 'other_site',
        value: 'keep-other',
        secure: true,
      });
      await api.cookies.set({
        url: 'https://app.example.com/',
        domain: 'example.com',
        name: 'parent_host_only',
        value: 'shared-cookie',
        secure: true,
      });
      await api.storage.session.remove('cookieSyncSession');
      await api.storage.local.set({
        'syncedSites:production': [
          {
            id: 1,
            name: '测试网站',
            account_label: 'A',
            origin: 'https://app.example.com',
            status: 'local',
            cookies: [
              { name: 'account_token', domain: 'example.com', path: '/' },
            ],
          },
        ],
      });
    });
    await popup.reload();
    await expect(popup.locator('#sites')).toContainText('测试网站');
    await expect(popup.locator('#sync')).toBeDisabled();
    await popup
      .getByRole('button', { name: '退出网站登录（清空 Cookie）', exact: true })
      .click();
    await expect(popup.getByRole('status')).toContainText('已清空 4 项Cookie');
    const remaining = await popup.evaluate(async () => {
      const api = (globalThis as any).chrome;
      const rows = await api.cookies.getAll({});
      return rows.map((c: any) => c.name);
    });
    expect(remaining.toSorted()).toEqual(['other_site', 'parent_host_only']);
    await popup
      .getByRole('button', { name: '退出网站登录（清空 Cookie）', exact: true })
      .click();
    await expect(popup.getByRole('status')).toContainText('已清空 0 项Cookie');
  } finally {
    await context.close();
    await rm(temp, { recursive: true, force: true });
  }
});
