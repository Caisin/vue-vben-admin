import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type { MembershipPlan } from '#/api/asset/membership';

import { enabledSelectOptions } from '#/views/_shared/crud-page';

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'InputNumber',
      componentProps: { class: 'w-full', min: 0 },
      fieldName: 'membership_type_id',
      label: '会员类型 ID',
    },
    { component: 'Input', fieldName: 'code_prefix', label: '计划编码' },
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
    row: MembershipPlan,
  ) => PromiseLike<boolean | undefined>,
): VxeTableGridColumns<MembershipPlan> {
  return [
    { field: 'code', fixed: 'left', title: '计划编码', width: 160 },
    {
      field: 'name',
      minWidth: 190,
      slots: { default: 'nameCell' },
      title: '计划名称',
    },
    {
      field: 'membership_type_id',
      sortable: true,
      title: '会员类型 ID',
      width: 130,
    },
    { field: 'tier_rank', sortable: true, title: '等级', width: 90 },
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
    { field: 'intro', minWidth: 220, title: '说明' },
  ];
}
