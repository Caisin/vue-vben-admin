import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type { UserMembershipView } from '#/api';

import { Times } from '#/times';

export interface MembershipRow extends UserMembershipView {
  row_key: string;
}

export function useFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'InputNumber',
      componentProps: { class: 'w-full', min: 1 },
      fieldName: 'acct_id',
      label: '资金账户 ID',
    },
  ];
}

export function useColumns(): VxeTableGridColumns<MembershipRow> {
  return [
    {
      field: 'membership_type.name',
      fixed: 'left',
      title: '会员类型',
      width: 170,
    },
    { field: 'plan.name', title: '当前计划', width: 180 },
    { field: 'plan.tier_rank', title: '等级', width: 90 },
    { field: 'membership.state', title: '状态', width: 110 },
    {
      field: 'effective_period_start',
      formatter: ({ row }) => Times.formatUnix(row.effective_period_start),
      title: '生效时间',
      width: 180,
    },
    {
      field: 'effective_period_end',
      formatter: ({ row }) => Times.formatUnix(row.effective_period_end),
      title: '到期时间',
      width: 180,
    },
    { field: 'entitlements.length', title: '权益数', width: 100 },
    {
      cellRender: {
        name: 'CellTag',
        options: [
          { color: 'warning', label: '待切换', value: true },
          { color: 'default', label: '当前计划', value: false },
        ],
      },
      field: 'using_pending_plan',
      title: '计划来源',
      width: 110,
    },
  ];
}
