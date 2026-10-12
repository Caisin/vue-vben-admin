import type { PermissionCatalog } from './permission-catalog-cache';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  invalidatePermissionCatalog,
  readPermissionCatalog,
} from './permission-catalog-cache';

const catalog = () => ({ apis: [], menus: [] });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
afterEach(() => {
  invalidatePermissionCatalog();
  vi.useRealTimers();
});

describe('permission catalogue cache', () => {
  it('does not let one editor mutate the catalogue used by another editor', async () => {
    const value: PermissionCatalog = {
      apis: [],
      menus: [
        {
          id: '1',
          pid: '0',
          name: 'Menu',
          path: '/menu',
          status: 1,
          type: 'menu',
          authCode: '',
          meta: { title: '原始名称' },
          apiIds: ['2'],
        },
      ],
    };
    const load = vi.fn(async () => value);
    const first = await readPermissionCatalog(() => 'a', load);
    const firstMenu = first.menus[0];
    if (!firstMenu) throw new Error('缺少测试菜单');
    firstMenu.meta.title = '被修改';
    firstMenu.apiIds?.push('3');
    const second = await readPermissionCatalog(() => 'a', load);
    expect(second.menus[0]?.meta.title).toBe('原始名称');
    expect(second.menus[0]?.apiIds).toEqual(['2']);
    expect(load).toHaveBeenCalledTimes(1);
  });
  it('shares concurrent loads and caches only the catalogue for five minutes', async () => {
    vi.useFakeTimers();
    const load = vi.fn(async () => catalog());
    const [first, second] = await Promise.all([
      readPermissionCatalog(() => 'server:user-a', load),
      readPermissionCatalog(() => 'server:user-a', load),
    ]);
    expect(load).toHaveBeenCalledTimes(1);
    expect(first).not.toBe(second);
    await readPermissionCatalog(() => 'server:user-a', load);
    expect(load).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(5 * 60 * 1000);
    await readPermissionCatalog(() => 'server:user-a', load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('does not retain failures', async () => {
    const load = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(catalog());
    await expect(readPermissionCatalog(() => 'a', load)).rejects.toThrow(
      'offline',
    );
    await expect(readPermissionCatalog(() => 'a', load)).resolves.toEqual(
      catalog(),
    );
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('discards in-flight results after invalidation and reloads them', async () => {
    const pending = deferred<ReturnType<typeof catalog>>();
    const load = vi
      .fn()
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce(catalog());
    const result = readPermissionCatalog(() => 'a', load);
    await Promise.resolve();
    invalidatePermissionCatalog();
    pending.resolve(catalog());
    await result;
    expect(load).toHaveBeenCalledTimes(2);
    await readPermissionCatalog(() => 'a', load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('isolates servers and login sessions and refuses an old session response', async () => {
    let scope = 'server-a:user-a';
    const pending = deferred<ReturnType<typeof catalog>>();
    const old = readPermissionCatalog(
      () => scope,
      () => pending.promise,
    );
    await Promise.resolve();
    scope = 'server-b:user-b';
    const load = vi.fn(async () => catalog());
    await readPermissionCatalog(() => scope, load);
    pending.resolve(catalog());
    await expect(old).rejects.toThrow('登录会话已变更');
    await readPermissionCatalog(() => scope, load);
    expect(load).toHaveBeenCalledTimes(1);
  });
});
