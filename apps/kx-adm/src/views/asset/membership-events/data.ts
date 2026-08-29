import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type { MembershipEvent } from '#/api/asset/membership';

import { Times } from '#/times';

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'InputNumber',
      componentProps: { class: 'w-full', min: 0 },
      fieldName: 'acct_id',
      label: '资金账户 ID',
    },
  ];
}

export function useColumns(): VxeTableGridColumns<MembershipEvent> {
  return [
    { field: 'id', fixed: 'left', title: '事件 ID', width: 110 },
    { field: 'kind', title: '事件类型', width: 140 },
    { field: 'membership_type_id', title: '会员类型 ID', width: 130 },
    { field: 'before_plan_id', title: '原计划 ID', width: 110 },
    { field: 'after_plan_id', title: '新计划 ID', width: 110 },
    { field: 'duration_seconds', title: '变更秒数', width: 120 },
    { field: 'source_type', title: '来源类型', width: 140 },
    { field: 'source_id', minWidth: 180, title: '来源记录 ID' },
    { field: 'reason', minWidth: 220, title: '原因' },
    {
      field: 'created_at',
      formatter: ({ row }) => Times.formatUnix(row.created_at),
      title: '创建时间',
      width: 180,
    },
  ];
}
