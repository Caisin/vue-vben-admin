import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const native = vi.hoisted(() => ({ invoke: vi.fn() }));
const cloud = vi.hoisted(() => ({
  list: vi.fn(),
  save: vi.fn(),
  session: vi.fn(),
}));
vi.mock('@tauri-apps/api/core', () => ({
  invoke: native.invoke,
  convertFileSrc: (path: string) => path,
}));
vi.mock('./tiktok-accounts', () => ({ tikTokAccounts: cloud }));
const fixture = {
  cookie: 'sessionid=fixture-a; sessionid=fixture-b',
  userAgent: 'fixture-agent',
  account: {
    uid: '7000000000000000001',
    nickname: 'fixture',
    timezone: 'Asia/Shanghai',
    minDelaySeconds: 900,
    maxDelaySeconds: 864_000,
    privateAccount: false,
  },
};
beforeEach(() => {
  vi.resetModules();
  native.invoke.mockReset();
  for (const value of Object.values(cloud)) value.mockReset();
  cloud.list.mockResolvedValue([]);
  cloud.save.mockResolvedValue({});
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
});
afterEach(() => vi.unstubAllGlobals());
describe('tikTok后端账号管理', () => {
  it('验证后保存到数据库，Cookie不会写入localStorage', async () => {
    const bridge = await import('./tiktok');
    native.invoke.mockResolvedValue(fixture);
    await bridge.importTikTokCookie(fixture.cookie, fixture.userAgent, '运营A');
    expect(cloud.save).toHaveBeenCalledWith(fixture, '运营A', 0);
    expect(localStorage.getItem(bridge.tiktokLoginKey)).toBeNull();
  });
  it('更新已有账号携带版本；数据库失败保留旧缓存供重试迁移', async () => {
    const bridge = await import('./tiktok');
    native.invoke.mockResolvedValue(fixture);
    cloud.list.mockResolvedValue([
      { account: fixture.account, label: '原备注', version: 8, enabled: true },
    ]);
    localStorage.setItem(bridge.tiktokLoginKey, JSON.stringify(fixture));
    cloud.save.mockRejectedValue(new Error('版本冲突'));
    await expect(bridge.importTikTokCookie(fixture.cookie)).rejects.toThrow(
      '版本冲突',
    );
    expect(cloud.save).toHaveBeenCalledWith(fixture, '原备注', 8);
    expect(bridge.legacyTikTokLogin()).toEqual(fixture);
    expect(native.invoke).toHaveBeenCalledTimes(1);
    expect(native.invoke).toHaveBeenCalledWith('tiktok_import_cookie', {
      input: expect.objectContaining({ activate: false }),
    });
  });
  it('新增其他账号不删除尚未迁移的旧账号Cookie', async () => {
    const bridge = await import('./tiktok');
    localStorage.setItem(bridge.tiktokLoginKey, JSON.stringify(fixture));
    native.invoke.mockResolvedValue({
      ...fixture,
      account: { ...fixture.account, uid: '8' },
    });
    await bridge.importTikTokCookie('fixture-B');
    expect(bridge.legacyTikTokLogin()).toEqual(fixture);
  });
  it('切换从后端读取Cookie，并要求原生校验目标UID', async () => {
    const bridge = await import('./tiktok');
    cloud.session.mockResolvedValue(fixture);
    native.invoke.mockResolvedValue(fixture);
    await bridge.switchTikTokAccount(fixture.account.uid);
    expect(cloud.session).toHaveBeenCalledWith(fixture.account.uid);
    expect(native.invoke).toHaveBeenCalledWith('tiktok_import_cookie', {
      input: expect.objectContaining({
        expectedAccountId: fixture.account.uid,
        cookie: fixture.cookie,
      }),
    });
  });
  it('已撤销的数据库账号不会复用旧原生会话', async () => {
    const bridge = await import('./tiktok');
    native.invoke.mockResolvedValueOnce(fixture);
    cloud.list.mockResolvedValue([
      { account: fixture.account, enabled: false },
    ]);
    expect(await bridge.restoreTikTokLogin()).toBeNull();
    expect(native.invoke).toHaveBeenLastCalledWith('tiktok_logout');
  });
  it('退出当前会话不删除云端其他账号，也不隐式迁移旧缓存', async () => {
    const bridge = await import('./tiktok');
    native.invoke.mockResolvedValue(null);
    localStorage.setItem(bridge.tiktokLoginKey, JSON.stringify(fixture));
    expect(await bridge.restoreTikTokLogin()).toBeNull();
    expect(cloud.save).not.toHaveBeenCalled();
    await bridge.logoutTikTok();
    expect(native.invoke).toHaveBeenLastCalledWith('tiktok_logout');
    expect(bridge.legacyTikTokLogin()).toEqual(fixture);
  });
});
