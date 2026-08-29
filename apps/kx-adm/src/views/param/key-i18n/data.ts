import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type { KxKeyI18n } from '#/api/param/i18n';

export interface KeyI18nRow extends KxKeyI18n {
  row_key: string;
  value: string;
}

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    { component: 'Input', fieldName: 'key_prefix', label: '翻译键' },
    { component: 'Input', fieldName: 'lang', label: '语言编码' },
  ];
}

export function useColumns(): VxeTableGridColumns<KeyI18nRow> {
  return [
    {
      field: 'lang',
      sortable: true,
      fixed: 'left',
      title: '语言编码',
      width: 140,
    },
    {
      field: 'key',
      sortable: true,
      minWidth: 240,
      slots: { default: 'keyCell' },
      title: '翻译键',
    },
    {
      field: 'value',
      minWidth: 300,
      slots: { default: 'valueCell' },
      title: '翻译文本',
    },
  ];
}
