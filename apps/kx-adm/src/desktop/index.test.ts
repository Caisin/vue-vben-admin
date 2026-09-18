import { beforeEach, describe, expect, it, vi } from 'vitest';
const native = vi.hoisted(() => ({
  invoke: vi.fn(),
  handlers: new Map<string, (event: { payload: unknown }) => void>(),
}));
vi.mock('@tauri-apps/api/core', () => ({
  isTauri: () => true,
  invoke: native.invoke,
}));
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(
    async (name: string, fn: (event: { payload: unknown }) => void) => {
      native.handlers.set(name, fn);
      return () => native.handlers.delete(name);
    },
  ),
}));
const session = (generation: number, token = `token-${generation}`) => ({
  generation,
  token,
  uid: '7',
  expiresAt: 4_102_444_800,
  apiBase: 'https://example.test/api',
});
beforeEach(() => {
  vi.resetModules();
  native.handlers.clear();
  native.invoke.mockReset();
});
describe('桌面会话同步', () => {
  it('刷新推送更新页面；旧事件不能恢复已退出的会话', async () => {
    native.invoke.mockResolvedValue({
      apiBase: 'https://example.test/api',
      session: session(1),
    });
    const bridge = await import('./index');
    await bridge.initDesktop();
    const store = vi.fn();
    await bridge.bindDesktopSession(store);
    expect(store).toHaveBeenLastCalledWith('token-1');
    native.handlers.get('desktop-session-updated')?.({ payload: session(3) });
    expect(store).toHaveBeenLastCalledWith('token-3');
    native.handlers.get('desktop-session-cleared')?.({ payload: 4 });
    native.handlers.get('desktop-session-updated')?.({ payload: session(2) });
    expect(store).toHaveBeenLastCalledWith(null);
  });
  it('启动快照返回前收到的刷新不能被旧快照覆盖', async () => {
    native.invoke.mockImplementation(async () => {
      native.handlers.get('desktop-session-updated')?.({ payload: session(2) });
      return { apiBase: 'https://example.test/api', session: session(1) };
    });
    const bridge = await import('./index');
    await bridge.initDesktop();
    const store = vi.fn();
    await bridge.bindDesktopSession(store);
    expect(store).toHaveBeenLastCalledWith('token-2');
    expect(bridge.desktopApiBase()).toBe('https://example.test/api');
  });
  it('页面刷新委托原生端并携带旧令牌，统一处理并发轮换', async () => {
    native.invoke.mockResolvedValue(session(5));
    const bridge = await import('./index');
    expect(await bridge.refreshDesktopSession('old')).toBe('token-5');
    expect(native.invoke).toHaveBeenCalledWith('desktop_refresh_session', {
      expected: 'old',
    });
  });
});
