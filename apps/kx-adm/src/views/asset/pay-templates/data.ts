import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type { PayTemplate } from '#/api/asset/pay';

import { enabledSelectOptions } from '#/views/_shared/crud-page';

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    { component: 'Input', fieldName: 'code_prefix', label: '模板编码' },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        class: 'w-full',
        options: enabledSelectOptions,
      },
      fieldName: 'enabled',
      label: '状态',
    },
  ];
}

export function useColumns(
  onEnabledChange?: (
    enabled: boolean,
    row: PayTemplate,
  ) => PromiseLike<boolean | undefined>,
): VxeTableGridColumns<PayTemplate> {
  return [
    {
      field: 'code',
      sortable: true,
      fixed: 'left',
      title: '模板编码',
      width: 170,
    },
    {
      field: 'name',
      minWidth: 190,
      slots: { default: 'nameCell' },
      title: '模板名称',
    },
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
    { field: 'remark', minWidth: 260, title: '备注' },
  ];
}
