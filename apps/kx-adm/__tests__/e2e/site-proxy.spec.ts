import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { resolve } from 'node:path';

import { expect, test } from '@playwright/test';

test('全站代理在浏览器中加载主站、CDN模块、样式和登录Cookie', async ({
  page,
}) => {
  test.setTimeout(60_000);
  let cdnOrigin = '';
  let upstreamOrigin = '';
  let receivedCookie = '';
  const cdnCookies: string[] = [];
  const main = createServer((req, res) => {
    if (req.url === '/') {
      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.setHeader('set-cookie', [
        'SESSION=fixture-session; Domain=127.0.0.1; Path=/; HttpOnly; SameSite=Lax',
        'preference=fixture; Domain=127.0.0.1; Path=/',
      ]);
      res.setHeader(
        'content-security-policy',
        `default-src 'self'; script-src 'self' ${cdnOrigin}; style-src 'self' ${cdnOrigin}`,
      );
      res.end(
        `<html><head><link rel="stylesheet" href="${cdnOrigin}/style.css" integrity="sha256-invalid"></head><body><h1>代理测试网站</h1><p id="result">正在加载</p><script type="module" src="${cdnOrigin}/app.js" integrity="sha256-invalid"></script></body></html>`,
      );
    } else if (req.url === '/api/result') {
      receivedCookie = req.headers.cookie || '';
      res.setHeader('content-type', 'application/json');
      res.end(
        JSON.stringify({
          url: `${upstreamOrigin}/account`,
          loggedIn: receivedCookie.includes('SESSION=fixture-session'),
        }),
      );
    } else {
      res.statusCode = 404;
      res.end();
    }
  });
  const cdn = createServer((req, res) => {
    cdnCookies.push(req.headers.cookie || '');
    if (req.url === '/style.css') {
      res.setHeader('content-type', 'text/css');
      res.end('#result { color: rgb(0, 128, 0); }');
    } else {
      res.setHeader('content-type', 'application/javascript');
      res.end(
        req.url === '/chunk.js'
          ? "export const label = '代理资源加载成功';"
          : `import { label } from './chunk.js'; fetch('${upstreamOrigin}/api/result').then(r => r.json()).then(r => { document.querySelector('#result').textContent = label + (r.loggedIn ? '，已登录' : '，未登录'); document.body.dataset.accountUrl = r.url; });`,
      );
    }
  });
  const bind = async (server: ReturnType<typeof createServer>) => {
    await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
    const address = server.address();
    if (!address || typeof address === 'string')
      throw new Error('missing fixture address');
    return address.port;
  };
  const mainPort = await bind(main);
  const cdnPort = await bind(cdn);
  upstreamOrigin = `http://127.0.0.1:${mainPort}`;
  cdnOrigin = `http://127.0.0.1:${cdnPort}`;
  const reservation = createServer();
  const proxyPort = await bind(reservation);
  await new Promise<void>((done) => reservation.close(() => done()));
  const publicOrigin = `http://localhost:${proxyPort}`;
  const root = resolve('../../..');
  const metadata = JSON.parse(
    execFileSync('cargo', ['metadata', '--format-version', '1', '--no-deps'], {
      cwd: root,
      encoding: 'utf8',
    }),
  );
  const binary = resolve(metadata.target_directory, 'debug/kx-site-proxy');
  const proxy = spawn(
    binary,
    [
      '--allow-unauthenticated',
      '--allow-private-upstream',
      '--listen',
      `127.0.0.1:${proxyPort}`,
      '--public-origin',
      publicOrigin,
      '--upstream',
      upstreamOrigin,
      '--map',
      `cdn=${cdnOrigin}`,
    ],
    { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  try {
    await new Promise<void>((done, reject) => {
      const timer = setTimeout(
        () => reject(new Error('proxy did not start')),
        10_000,
      );
      proxy.once('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
      proxy.stdout.once('data', () => {
        clearTimeout(timer);
        done();
      });
      proxy.once('exit', (code) => {
        clearTimeout(timer);
        reject(new Error(`proxy exited: ${code}`));
      });
    });
    await page.goto(publicOrigin);
    await expect(page.locator('#result')).toHaveText(
      '代理资源加载成功，已登录',
    );
    await expect(page.locator('#result')).toHaveCSS('color', 'rgb(0, 128, 0)');
    await expect(page.locator('body')).toHaveAttribute(
      'data-account-url',
      `${publicOrigin}/account`,
    );
    expect(requests.every((url) => new URL(url).origin === publicOrigin)).toBe(
      true,
    );
    expect(
      requests.some((url) => url.includes('/_kx/upstream/cdn/chunk.js')),
    ).toBe(true);
    expect(cdnCookies.every((cookie) => cookie === '')).toBe(true);
    const cookies = await page.context().cookies(publicOrigin);
    expect(cookies.find((cookie) => cookie.name === 'SESSION')?.httpOnly).toBe(
      true,
    );
    expect(cookies.some((cookie) => cookie.name === 'preference')).toBe(true);
    await page.screenshot({ path: test.info().outputPath('site-proxy.png') });
  } finally {
    proxy.kill('SIGTERM');
    main.closeAllConnections();
    cdn.closeAllConnections();
    await Promise.all([
      new Promise<void>((done) => main.close(() => done())),
      new Promise<void>((done) => cdn.close(() => done())),
    ]);
  }
});
