import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { desktopSessionKey } from './session-storage';
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
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    clear: () => values.clear(),
  });
  localStorage.clear();
  vi.resetModules();
  native.handlers.clear();
  native.invoke.mockReset();
});
afterEach(() => vi.unstubAllGlobals());
describe('桌面会话同步', () => {
  it('读取生图环境变量状态但不接收 key', async () => {
    native.invoke.mockResolvedValue({
      available: false,
      variableName: 'IMG_OPEN_AI_KEY',
      baseUrl: 'https://sub2api.qinjiu8.com/',
      configPath: '~/.config/kx-adm/image-gen.env',
      message: '请设置环境变量后重启电脑再试。',
    });
    const bridge = await import('./index');
    await expect(bridge.imageEnvStatus()).resolves.toEqual({
      available: false,
      variableName: 'IMG_OPEN_AI_KEY',
      baseUrl: 'https://sub2api.qinjiu8.com/',
      configPath: '~/.config/kx-adm/image-gen.env',
      message: '请设置环境变量后重启电脑再试。',
    });
    expect(native.invoke).toHaveBeenCalledWith('desktop_image_env_status');
  });

  it('保存生图 Skill 配置只通过原生 IPC，不保存 key 到页面存储', async () => {
    native.invoke.mockResolvedValue({
      available: true,
      variableName: 'IMG_OPEN_AI_KEY',
      baseUrl: 'https://sub2api.qinjiu8.com/',
      configPath: '~/.config/kx-adm/image-gen.env',
      message: '已检测到 IMG_OPEN_AI_KEY。',
    });
    const bridge = await import('./index');
    await expect(bridge.setImageEnv('secret-value')).resolves.toMatchObject({
      available: true,
    });
    expect(native.invoke).toHaveBeenCalledWith('desktop_image_set_env', {
      key: 'secret-value',
    });
  });

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
    expect(
      JSON.parse(localStorage.getItem(desktopSessionKey) ?? 'null'),
    ).toEqual({
      apiBase: session(3).apiBase,
      token: 'token-3',
    });
    native.handlers.get('desktop-session-cleared')?.({ payload: 4 });
    native.handlers.get('desktop-session-updated')?.({ payload: session(2) });
    expect(store).toHaveBeenLastCalledWith(null);
    expect(localStorage.getItem(desktopSessionKey)).toBeNull();
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
  it('进程重启从 localStorage 恢复并保存服务器轮换后的令牌', async () => {
    localStorage.setItem(
      desktopSessionKey,
      JSON.stringify({ apiBase: session(1).apiBase, token: 'cached' }),
    );
    native.invoke.mockImplementation(async (command) =>
      command === 'desktop_bootstrap'
        ? { apiBase: session(1).apiBase, generation: 1, session: null }
        : session(2, 'renewed'),
    );
    const bridge = await import('./index');
    await bridge.initDesktop();
    expect(native.invoke).toHaveBeenCalledWith('desktop_restore_session', {
      token: 'cached',
      apiBase: session(1).apiBase,
      expectedGeneration: 1,
    });
    const store = vi.fn();
    await bridge.bindDesktopSession(store);
    expect(store).toHaveBeenLastCalledWith('renewed');
    expect(
      JSON.parse(localStorage.getItem(desktopSessionKey) ?? 'null').token,
    ).toBe('renewed');
  });
  it.each([
    '{bad-json',
    JSON.stringify({ apiBase: 'https://other.test', token: 'secret' }),
  ])('损坏或跨服务缓存不能恢复：%s', async (raw) => {
    localStorage.setItem(desktopSessionKey, raw);
    native.invoke.mockResolvedValue({
      apiBase: session(1).apiBase,
      generation: 1,
      session: null,
    });
    const bridge = await import('./index');
    await bridge.initDesktop();
    expect(native.invoke).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(desktopSessionKey)).toBeNull();
  });
  it('退出会清除本地缓存，即使原生 IPC 失败', async () => {
    localStorage.setItem(desktopSessionKey, 'cached');
    native.invoke.mockRejectedValue(new Error('IPC unavailable'));
    const bridge = await import('./index');
    await expect(bridge.clearDesktopSession()).rejects.toThrow(
      'IPC unavailable',
    );
    expect(localStorage.getItem(desktopSessionKey)).toBeNull();
  });
  it('失效恢复清除缓存，网络错误保留缓存供下次启动', async () => {
    for (const failure of ['unauthorized', '无法连接服务']) {
      vi.resetModules();
      const raw = JSON.stringify({
        apiBase: session(1).apiBase,
        token: 'cached',
      });
      localStorage.setItem(desktopSessionKey, raw);
      native.invoke.mockImplementation(async (command) => {
        if (command === 'desktop_bootstrap')
          return { apiBase: session(1).apiBase, generation: 1, session: null };
        throw new Error(failure);
      });
      const bridge = await import('./index');
      await bridge.initDesktop();
      expect(localStorage.getItem(desktopSessionKey)).toBe(
        failure === 'unauthorized' ? null : raw,
      );
    }
  });
});
