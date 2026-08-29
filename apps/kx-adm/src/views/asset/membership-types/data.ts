import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type { MembershipType } from '#/api/asset/membership';

import { enabledSelectOptions } from '#/views/_shared/crud-page';

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    { component: 'Input', fieldName: 'code_prefix', label: '类型编码' },
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
    row: MembershipType,
  ) => PromiseLike<boolean | undefined>,
): VxeTableGridColumns<MembershipType> {
  return [
    {
      field: 'code',
      sortable: true,
      fixed: 'left',
      title: '类型编码',
      width: 160,
    },
    {
      field: 'name',
      minWidth: 190,
      slots: { default: 'nameCell' },
      title: '类型名称',
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
    { field: 'intro', minWidth: 260, title: '说明' },
  ];
}
