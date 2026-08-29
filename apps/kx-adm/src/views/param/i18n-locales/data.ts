import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type { KxI18n } from '#/api/param/i18n';

export function useGridFormSchema(): VbenFormSchema[] {
  return [{ component: 'Input', fieldName: 'locale', label: '语言地区' }];
}

export function useColumns(
  onEnabledChange?: (
    enabled: boolean,
    row: KxI18n,
  ) => PromiseLike<boolean | undefined>,
): VxeTableGridColumns<KxI18n> {
  return [
    {
      field: 'locale',
      fixed: 'left',
      slots: { default: 'localeCell' },
      title: '语言地区',
      width: 160,
    },
    { field: 'name', title: '显示名称', width: 160 },
    {
      cellRender: {
        attrs: { beforeChange: onEnabledChange },
        name: onEnabledChange ? 'CellSwitch' : 'CellTag',
        props: { checkedValue: true, unCheckedValue: false },
      },
      field: 'enabled',
      title: '状态',
      width: 90,
    },
    {
      field: 'data',
      minWidth: 480,
      slots: { default: 'dataCell' },
      title: '语言包 JSON',
    },
  ];
}
