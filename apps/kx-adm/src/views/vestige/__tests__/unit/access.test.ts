import type { RoleAccess } from '#/api/vestige';

import { effectScope } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import { useRoleAccess } from '../../access';

vi.mock('#/api/vestige', () => ({ VestigeApi: { access: vi.fn() } }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((accept, fail) => {
    resolve = accept;
    reject = fail;
  });
  return { promise, resolve, reject };
}
function role(id: string, permission: RoleAccess['permission']): RoleAccess {
  return {
    permission,
    can_copy: permission === 'owner',
    can_provision: false,
    role: {
      id,
      name: id,
      company_id: null,
      owner_user_id: '1',
      description: '',
      kind: 'personal',
      status: 'ready',
      revision: 1,
      created_at: 1,
      updated_at: 1,
    },
  };
}
describe('role permission requests', () => {
  it('never restores another role’s owner controls from a late response', async () => {
    const first = deferred<RoleAccess>();
    const second = deferred<RoleAccess>();
    const scope = effectScope();
    const state = scope.run(() =>
      useRoleAccess((id) => (id === 'first' ? first.promise : second.promise)),
    );
    if (!state) throw new Error('fixture scope is inactive');
    const pendingFirst = state.select('first');
    const pendingSecond = state.select('second');
    second.resolve(role('second', 'viewer'));
    await pendingSecond;
    expect(state.canManage.value).toBe(false);
    first.resolve(role('first', 'owner'));
    await pendingFirst;
    expect(state.value.value?.role.id).toBe('second');
    expect(state.canCopy.value).toBe(false);
    scope.stop();
  });
  it('removes old controls immediately while rechecking a downgraded grant', async () => {
    const next = deferred<RoleAccess>();
    const load = vi
      .fn()
      .mockResolvedValueOnce(role('selected', 'owner'))
      .mockImplementationOnce(() => next.promise);
    const scope = effectScope();
    const state = scope.run(() => useRoleAccess(load));
    if (!state) throw new Error('fixture scope is inactive');
    await state.select('selected');
    expect(state.canManage.value).toBe(true);
    const refresh = state.select('selected');
    expect(state.canManage.value).toBe(false);
    next.resolve(role('selected', 'viewer'));
    await refresh;
    expect(state.canManage.value).toBe(false);
    expect(state.value.value?.permission).toBe('viewer');
    scope.stop();
  });
  it('fails closed on a wrong role response and after the view is closed', async () => {
    const pending = deferred<RoleAccess>();
    const scope = effectScope();
    const state = scope.run(() =>
      useRoleAccess(
        vi
          .fn()
          .mockResolvedValueOnce(role('wrong', 'owner'))
          .mockImplementationOnce(() => pending.promise),
      ),
    );
    if (!state) throw new Error('fixture scope is inactive');
    await state.select('expected');
    expect(state.error.value).not.toBe('');
    expect(state.value.value).toBeUndefined();
    expect(state.canManage.value).toBe(false);
    const request = state.select('expected');
    state.clear();
    pending.resolve(role('expected', 'owner'));
    await request;
    expect(state.value.value).toBeUndefined();
    expect(state.canCopy.value).toBe(false);
    scope.stop();
  });
});
