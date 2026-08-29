import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type { WmxtPointHistoryItem } from '#/api/wmxt';

import { Times } from '#/times';

export function useFormSchema(): VbenFormSchema[] {
  return [
    { component: 'InputNumber', fieldName: 'uid', label: '用户 UID' },
    { component: 'Input', fieldName: 'keyword', label: '原因' },
    { component: 'Input', fieldName: 'source_prefix', label: '来源前缀' },
  ];
}

export function useColumns(): VxeTableGridColumns<WmxtPointHistoryItem> {
  return [
    { field: 'id', fixed: 'left', title: 'ID', width: 100 },
    { field: 'uid', title: 'UID', width: 120 },
    { field: 'amount', title: '积分变动', width: 120 },
    { field: 'reason', minWidth: 220, title: '原因' },
    { field: 'source_type', minWidth: 160, title: '来源类型' },
    { field: 'source_id', minWidth: 160, title: '来源 ID' },
    {
      field: 'created_at',
      formatter: ({ row }) => Times.formatOptionalUnix(row.created_at),
      title: '发生时间',
      width: 180,
    },
    {
      field: 'actions',
      fixed: 'right',
      slots: { default: 'actions' },
      title: '操作',
      width: 180,
    },
  ];
}
