import type { MenuProps } from 'antdv-next';

import type { CSSProperties } from 'vue';

import { computed, nextTick, onUnmounted, ref } from 'vue';

import { useAccess } from '@vben/access';

interface VxeRowContextGrid<T> {
  $el?: HTMLElement;
  getRowById?: (id: string) => null | T | undefined;
}

export function useVxeRowContextMenu<T>(
  items: MenuProps['items'],
  onClick: (key: string, row: T) => void,
  permissions: Record<string, string> = {},
) {
  const { hasAccessByCodes } = useAccess();
  const allowed = (key: string) =>
    !permissions[key] || hasAccessByCodes([permissions[key]]);
  const open = ref(false);
  const row = ref<T>();
  const anchorStyle = ref<CSSProperties>({ left: '0px', top: '0px' });
  let cleanup: (() => void) | null = null;

  const menu = computed<MenuProps>(() => ({
    items: items?.filter(
      (item) => !item || !('key' in item) || allowed(String(item.key)),
    ),
    onClick({ key }) {
      const current = row.value;
      open.value = false;
      if (current && allowed(String(key))) onClick(String(key), current);
    },
  }));

  function onOpenChange(value: boolean) {
    open.value = value;
    if (!value) row.value = undefined;
  }

  async function bind(grid: undefined | VxeRowContextGrid<T>) {
    await nextTick();
    cleanup?.();
    cleanup = null;
    const root = grid?.$el;
    if (!root) return;

    const handler = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest('.vxe-table--body')) return;

      const rowElement = target.closest('tr[rowid]');
      const rowid = rowElement?.getAttribute('rowid');
      const current = rowid ? grid.getRowById?.(rowid) : undefined;
      if (!current) return;

      event.preventDefault();
      event.stopPropagation();
      row.value = current;
      anchorStyle.value = {
        left: `${event.clientX}px`,
        top: `${event.clientY}px`,
      };
      open.value = false;
      void nextTick(() => {
        open.value = true;
      });
    };

    root.addEventListener('contextmenu', handler);
    cleanup = () => root.removeEventListener('contextmenu', handler);
  }

  onUnmounted(() => cleanup?.());

  return {
    anchorStyle,
    bind,
    menu,
    onOpenChange,
    open,
  };
}
