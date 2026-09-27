import { onScopeDispose, watch } from 'vue';

import { Modal } from 'antdv-next';

type Options = Parameters<typeof Modal.confirm>[0];
type Confirmation = Omit<Options, 'afterClose' | 'onOk'> & {
  onOk: () => Promise<void> | void;
};
type Open = (options: Options) => { destroy: () => void };

/** 静态确认框只在当前角色/权限/项目上下文中有效，不保留已离开页面的写操作。 */
export function useRoleConfirmation(
  context: () => readonly unknown[],
  open: Open = Modal.confirm,
) {
  let generation = 0;
  let disposed = false;
  let active: ReturnType<Open> | undefined;
  function dismiss() {
    generation++;
    const prior = active;
    active = undefined;
    prior?.destroy();
  }
  watch(
    context,
    (next, prior) => {
      if (
        next.length !== prior.length ||
        next.some((value, index) => !Object.is(value, prior[index]))
      ) {
        dismiss();
      }
    },
    { flush: 'sync' },
  );
  onScopeDispose(() => {
    disposed = true;
    dismiss();
  });
  return (options: Confirmation) => {
    if (disposed) return;
    dismiss();
    const current = generation;
    active = open({
      ...options,
      onOk: () => {
        if (disposed || current !== generation) return;
        return options.onOk();
      },
      afterClose: () => {
        if (current === generation) {
          active = undefined;
          generation++;
        }
      },
    });
  };
}
