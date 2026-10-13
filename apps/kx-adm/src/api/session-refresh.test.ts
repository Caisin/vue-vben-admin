import { RequestClient } from '@vben/request';

import { addApiSecurityInterceptors, KxEd } from '@kx/admin-core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  addSessionRefreshInterceptors,
  createSessionRefresh,
} from './session-refresh';

function token(seconds: number, uid = 1) {
  return `header.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + seconds, uid }))}.signature-token-id`;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, reject, resolve };
}

function setup(seconds = 600) {
  let current: null | string = token(seconds);
  const old = current;
  const next = token(3600);
  const result = deferred<string>();
  const refresh = vi.fn(() => result.promise);
  const session = createSessionRefresh({
    getToken: () => current,
    refresh,
    setToken: (value) => {
      current = value;
    },
  });
  return {
    get current() {
      return current;
    },
    set current(value) {
      current = value;
    },
    next,
    old,
    refresh,
    result,
    session,
  };
}

afterEach(() => vi.useRealTimers());

describe('web 会话续期', () => {
  it('超过 10 分钟不刷新，10 分钟内并发请求不阻塞且只刷新一次', async () => {
    const fresh = setup(601);
    expect(await fresh.session.prepare()).toBe(fresh.old);
    expect(fresh.refresh).not.toHaveBeenCalled();
    const s = setup();
    expect(
      await Promise.all(Array.from({ length: 20 }, () => s.session.prepare())),
    ).toEqual(Array.from({ length: 20 }, () => s.old));
    expect(s.refresh).toHaveBeenCalledTimes(1);
    const waiting = s.session.refresh(s.old);
    s.result.resolve(s.next);
    expect(await waiting).toBe(s.next);
    expect(s.current).toBe(s.next);
    expect(await s.session.refresh(s.old)).toBe(s.next);
    expect(s.refresh).toHaveBeenCalledTimes(1);
  });

  it('已过期时所有请求等待同一次刷新', async () => {
    const s = setup(-1);
    let finished = false;
    const requests = Promise.all([s.session.prepare(), s.session.prepare()]);
    void requests.then(() => {
      finished = true;
    });
    await Promise.resolve();
    expect(finished).toBe(false);
    expect(s.refresh).toHaveBeenCalledTimes(1);
    s.result.resolve(s.next);
    expect(await requests).toEqual([s.next, s.next]);
  });

  it('后台失败保留 token，冷却 30 秒后允许重试', async () => {
    vi.useFakeTimers();
    const s = setup();
    await s.session.prepare();
    const failed = s.session.refresh(s.old);
    s.result.reject(new Error('offline'));
    await expect(failed).rejects.toThrow('offline');
    await s.session.prepare();
    expect(s.refresh).toHaveBeenCalledTimes(1);
    expect(s.current).toBe(s.old);
    vi.advanceTimersByTime(30_000);
    s.refresh.mockResolvedValue(s.next);
    expect(await s.session.refresh(s.old)).toBe(s.next);
    expect(s.refresh).toHaveBeenCalledTimes(2);
  });

  it.each([null, token(7200, 2)])(
    '退出或换号后不恢复旧会话：%s',
    async (changed) => {
      const s = setup();
      const waiting = s.session.refresh(s.old);
      s.current = changed;
      s.result.resolve(s.next);
      await expect(waiting).rejects.toThrow('登录会话已变化');
      expect(s.current).toBe(changed);
      expect(() => s.session.currentFor(s.old)).toThrow('登录会话已变化');
    },
  );

  it('无法解析的 token 交给服务端验证', async () => {
    const s = setup();
    s.current = 'invalid';
    expect(await s.session.prepare()).toBe('invalid');
    expect(s.refresh).not.toHaveBeenCalled();
  });
});

function clientFor(s: ReturnType<typeof setup>, encrypted = false) {
  const client = new RequestClient({ responseReturn: 'raw' });
  const reAuthenticate = vi.fn(async () => {});
  if (encrypted) addApiSecurityInterceptors(client);
  addSessionRefreshInterceptors(client, s.session, reAuthenticate);
  return { client, reAuthenticate };
}

function unauthorized(config: unknown) {
  return { config, response: { status: 401 } };
}

describe('请求层续期集成', () => {
  it('多个客户端并发 401 共用刷新，迟到 401 复用新 token', async () => {
    const s = setup(3601);
    const a = clientFor(s);
    const b = clientFor(s);
    const oldResponses: Array<() => void> = [];
    for (const { client } of [a, b]) {
      client.instance.defaults.adapter = async (config) => {
        if (config.headers.Authorization === `Bearer ${s.old}`) {
          return new Promise((_resolve, reject) => {
            oldResponses.push(() => reject(unauthorized(config)));
          });
        }
        return {
          config,
          data: 'ok',
          headers: {},
          status: 200,
          statusText: 'OK',
        };
      };
    }
    const requests = [
      a.client.get('/a'),
      b.client.get('/b'),
      a.client.get('/late'),
    ];
    await vi.waitFor(() => expect(oldResponses).toHaveLength(3));
    oldResponses[0]?.();
    oldResponses[1]?.();
    await vi.waitFor(() => expect(s.refresh).toHaveBeenCalledTimes(1));
    s.result.resolve(s.next);
    await Promise.all(requests.slice(0, 2));
    oldResponses[2]?.();
    const responses = await Promise.all(requests);
    expect(responses.map((response) => response.data)).toEqual([
      'ok',
      'ok',
      'ok',
    ]);
    expect(s.refresh).toHaveBeenCalledTimes(1);
    expect(a.reAuthenticate).not.toHaveBeenCalled();
    expect(b.reAuthenticate).not.toHaveBeenCalled();
  });

  it('刷新入口不递归刷新，退出接口不主动续期', async () => {
    const s = setup();
    const { client } = clientFor(s);
    client.instance.defaults.adapter = async (config) => ({
      config,
      data: {},
      headers: {},
      status: 200,
      statusText: 'OK',
    });
    await client.post('/auth/user/refresh_token');
    await client.post('/auth/user/logout');
    expect(s.refresh).not.toHaveBeenCalled();
  });

  it('加密 POST 遇到 401 时按原始 JSON 重试，最多重试一次', async () => {
    const s = setup(3601);
    s.result.resolve(s.next);
    const { client, reAuthenticate } = clientFor(s, true);
    const bodies: unknown[] = [];
    client.instance.defaults.adapter = async (config) => {
      bodies.push(JSON.parse(KxEd.decryptText(config.data)));
      const response = {
        config,
        data: KxEd.toArrayBuffer(KxEd.encryptText('{}')),
        headers: { 'content-type': 'application/json' },
        status: 401,
        statusText: 'Unauthorized',
      };
      throw Object.assign(new Error('unauthorized'), { config, response });
    };
    await expect(
      client.post('/write', { name: '测试', value: 7 }),
    ).rejects.toBeDefined();
    expect(bodies).toEqual([
      { name: '测试', value: 7 },
      { name: '测试', value: 7 },
    ]);
    expect(s.refresh).toHaveBeenCalledTimes(1);
    expect(reAuthenticate).toHaveBeenCalledTimes(1);
  });

  it('明确拒绝已过期凭证时进入重新登录', async () => {
    const s = setup(-1);
    const { client, reAuthenticate } = clientFor(s);
    const request = client.get('/private');
    s.result.reject(unauthorized({}));
    await expect(request).rejects.toBeDefined();
    expect(reAuthenticate).toHaveBeenCalledTimes(1);
  });

  it('旧账号迟到的 401 不重放请求，也不退出新账号', async () => {
    const s = setup(3601);
    const { client, reAuthenticate } = clientFor(s);
    const response = deferred<never>();
    const adapter = vi.fn(async (config) => {
      await response.promise.catch(() => {
        throw Object.assign(new Error('unauthorized'), unauthorized(config));
      });
      throw new Error('unreachable');
    });
    client.instance.defaults.adapter = adapter;
    const request = client.get('/private');
    await vi.waitFor(() => expect(adapter).toHaveBeenCalledTimes(1));
    s.current = token(7200, 2);
    response.reject(new Error('late'));
    await expect(request).rejects.toThrow('登录会话已变化');
    expect(s.refresh).not.toHaveBeenCalled();
    expect(reAuthenticate).not.toHaveBeenCalled();
    expect(adapter).toHaveBeenCalledTimes(1);
  });

  it('刷新暂时断网时所有等待者失败但不退出', async () => {
    const s = setup(-1);
    const { client, reAuthenticate } = clientFor(s);
    const result = Promise.allSettled([client.get('/a'), client.get('/b')]);
    s.result.reject(new Error('offline'));
    const settled = await result;
    expect(settled.every((item) => item.status === 'rejected')).toBe(true);
    expect(s.current).toBe(s.old);
    expect(reAuthenticate).not.toHaveBeenCalled();
  });
});
