import type { MenuProps } from 'antdv-next';

import type { CSSProperties } from 'vue';

import { computed, nextTick, onUnmounted, ref } from 'vue';

interface VxeRowContextGrid<T> {
  $el?: HTMLElement;
  getRowById?: (id: string) => null | T | undefined;
}

export function useVxeRowContextMenu<T>(
  items: MenuProps['items'],
  onClick: (key: string, row: T) => void,
) {
  const open = ref(false);
  const row = ref<T>();
  const anchorStyle = ref<CSSProperties>({ left: '0px', top: '0px' });
  let cleanup: (() => void) | null = null;

  const menu = computed<MenuProps>(() => ({
    items,
    onClick({ key }) {
      const current = row.value;
      open.value = false;
      if (current) onClick(String(key), current);
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
