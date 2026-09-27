import { effectScope, ref } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import { useRoleConfirmation } from '../../confirmation';

vi.mock('antdv-next', () => ({ Modal: { confirm: vi.fn() } }));

type Options = Parameters<
  NonNullable<Parameters<typeof useRoleConfirmation>[1]>
>[0];
function fixture() {
  const role = ref('role-a');
  const permission = ref('owner');
  const project = ref('project-a');
  const dialogs: { destroy: ReturnType<typeof vi.fn>; options: Options }[] = [];
  const scope = effectScope();
  const confirm = scope.run(() =>
    useRoleConfirmation(
      () => [role.value, permission.value, project.value],
      (options) => {
        const dialog = { options, destroy: vi.fn() };
        dialogs.push(dialog);
        return dialog;
      },
    ),
  );
  if (!confirm) throw new Error('inactive fixture');
  return { role, permission, project, dialogs, scope, confirm };
}

describe('role confirmation boundaries', () => {
  it.each(['role', 'permission', 'project'] as const)(
    'dismisses the old dialog and rejects its late callback when %s changes',
    async (field) => {
      const state = fixture();
      const action = vi.fn();
      state.confirm({ title: 'confirm mutation', onOk: action });
      state[field].value = 'changed';
      expect(state.dialogs[0]?.destroy).toHaveBeenCalledOnce();
      await state.dialogs[0]?.options.onOk?.();
      expect(action).not.toHaveBeenCalled();
      state.scope.stop();
    },
  );
  it('invalidates callbacks on unmount, cancel, and replacement', async () => {
    const state = fixture();
    const action = vi.fn();
    state.confirm({ title: 'first', onOk: action });
    state.confirm({ title: 'replacement', onOk: action });
    await state.dialogs[0]?.options.onOk?.();
    state.dialogs[1]?.options.afterClose?.();
    await state.dialogs[1]?.options.onOk?.();
    state.confirm({ title: 'unmount', onOk: action });
    state.scope.stop();
    await state.dialogs[2]?.options.onOk?.();
    state.confirm({ title: 'disposed', onOk: action });
    expect(action).not.toHaveBeenCalled();
    expect(state.dialogs).toHaveLength(3);
    expect(state.dialogs[2]?.destroy).toHaveBeenCalledOnce();
  });
  it('keeps confirmation open when refreshed metadata describes the same context', async () => {
    const metadata = ref({ id: 'role-a', permission: 'owner' });
    const action = vi.fn();
    const destroy = vi.fn();
    let options: Options | undefined;
    const scope = effectScope();
    const confirm = scope.run(() =>
      useRoleConfirmation(
        () => [metadata.value.id, metadata.value.permission],
        (value) => {
          options = value;
          return { destroy };
        },
      ),
    );
    confirm?.({ title: 'current', onOk: action });
    metadata.value = { ...metadata.value };
    expect(destroy).not.toHaveBeenCalled();
    await options?.onOk?.();
    expect(action).toHaveBeenCalledOnce();
    scope.stop();
  });
  it('awaits current actions and preserves API failures for the dialog', async () => {
    const state = fixture();
    const failure = new Error('authorization changed');
    const action = vi
      .fn()
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce(undefined);
    state.confirm({ title: 'current', onOk: action });
    await expect(state.dialogs[0]?.options.onOk?.()).rejects.toBe(failure);
    await state.dialogs[0]?.options.onOk?.();
    expect(action).toHaveBeenCalledTimes(2);
    state.scope.stop();
  });
});
