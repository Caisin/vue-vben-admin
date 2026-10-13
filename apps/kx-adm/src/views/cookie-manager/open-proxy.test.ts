import type { Site } from '#/api/cookie-manager';

import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { openProxySite } from './open-proxy';
const state = vi.hoisted(() => ({
  desktop: false,
  native: vi.fn(),
  grant: vi.fn(),
}));
vi.mock('#/desktop', () => ({
  get desktop() {
    return state.desktop;
  },
  openCookieProxy: state.native,
}));
vi.mock('#/api/cookie-manager', () => ({
  CookieApi: { proxyGrantDirect: state.grant },
}));
const site = {
  id: '7',
  name: '代理网站',
  proxy_url: 'https://site-7.proxy.example.test/_kx/login',
} as Site;
const target =
  'https://site-7.proxy.example.test/_kx/complete?ticket=fixture&proof=fixture';
const popup = () => ({
  opener: {} as unknown,
  document: { title: '', body: { textContent: '' } },
  closed: false,
  close: vi.fn(),
  location: { replace: vi.fn() },
});
beforeEach(() => {
  state.desktop = false;
  state.native.mockReset().mockResolvedValue(undefined);
  state.grant.mockReset().mockResolvedValue({ url: target });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
it('网页在请求前预留窗口并断开opener，成功后在原窗口导航', async () => {
  const child = popup();
  const open = vi.fn(() => child);
  vi.stubGlobal('window', { open });
  state.grant.mockImplementation(async () => {
    expect(open).toHaveBeenCalledWith('about:blank', '_blank');
    expect(child.opener).toBeNull();
    return { url: target };
  });
  await openProxySite(site, false);
  expect(child.location.replace).toHaveBeenCalledWith(target);
  expect(child.close).not.toHaveBeenCalled();
});
it('弹窗被阻止时不签发票据', async () => {
  vi.stubGlobal('window', { open: vi.fn(() => null) });
  await expect(openProxySite(site, false)).rejects.toThrow('浏览器阻止');
  expect(state.grant).not.toHaveBeenCalled();
});
it('授权失败关闭预留窗口并保留服务端错误', async () => {
  const child = popup();
  vi.stubGlobal('window', { open: vi.fn(() => child) });
  state.grant.mockRejectedValue(new Error('网站Cookie已过期'));
  await expect(openProxySite(site, false)).rejects.toThrow('Cookie已过期');
  expect(child.close).toHaveBeenCalledOnce();
});
it('错误源或非HTTP票据不能导航预留窗口', async () => {
  for (const url of [
    'javascript:alert(1)',
    'https://evil.example.test/_kx/complete',
    'https://site-7.proxy.example.test/other',
    'https://user:pass@site-7.proxy.example.test/_kx/complete',
  ]) {
    const child = popup();
    vi.stubGlobal('window', { open: vi.fn(() => child) });
    state.grant.mockResolvedValue({ url });
    await expect(openProxySite(site, false)).rejects.toThrow(
      '代理入口地址无效',
    );
    expect(child.location.replace).not.toHaveBeenCalled();
    expect(child.close).toHaveBeenCalledOnce();
  }
});
it('用户提前关闭窗口会明确提示重新进入', async () => {
  const child = popup();
  vi.stubGlobal('window', { open: vi.fn(() => child) });
  state.grant.mockImplementation(async () => {
    child.closed = true;
    return { url: target };
  });
  await expect(openProxySite(site, false)).rejects.toThrow('代理窗口已关闭');
  expect(child.location.replace).not.toHaveBeenCalled();
});
it('移动网页仍在当前页导航', async () => {
  const assign = vi.fn();
  const open = vi.fn();
  vi.stubGlobal('window', { open, location: { assign } });
  await openProxySite(site, true);
  expect(open).not.toHaveBeenCalled();
  expect(assign).toHaveBeenCalledWith(target);
});
it('tauri无论窗口宽度都走原生命令，不调用浏览器打开或前端签发', async () => {
  state.desktop = true;
  const open = vi.fn();
  vi.stubGlobal('window', { open });
  await openProxySite(site, false);
  await openProxySite(site, true);
  expect(state.native).toHaveBeenNthCalledWith(1, '7');
  expect(state.native).toHaveBeenNthCalledWith(2, '7');
  expect(open).not.toHaveBeenCalled();
  expect(state.grant).not.toHaveBeenCalled();
  state.native.mockRejectedValueOnce(new Error('客户端版本过旧'));
  await expect(openProxySite(site, false)).rejects.toThrow('客户端版本过旧');
});
