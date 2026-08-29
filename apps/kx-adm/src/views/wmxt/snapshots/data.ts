import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type { WmxtSnapshot } from '#/api/wmxt';

import { Times } from '#/times';

export const enabledStatusOptions = [
  { label: '启用', value: 'active' },
  { label: '停用', value: 'inactive' },
];
export const taskStatusOptions = [
  { label: '草稿', value: 'draft' },
  { label: '已发布', value: 'published' },
  { label: '已关闭', value: 'closed' },
];
export const reviewStatusOptions = [
  { label: '待审核', value: 'pending' },
  { label: '已通过', value: 'approved' },
  { label: '已拒绝', value: 'rejected' },
  { label: '已整改', value: 'rectified' },
];
export const targetRoleOptions = [
  { label: '全部', value: 'all' },
  { label: '个人', value: 'personal' },
  { label: '家庭', value: 'family' },
  { label: '单位', value: 'org' },
];
export const wmxtRoleOptions = [
  { label: '个人', value: 'personal' },
  { label: '单位', value: 'org' },
  { label: '管理员', value: 'admin' },
];

export function useFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Select',
      componentProps: { allowClear: true, options: reviewStatusOptions },
      fieldName: 'status',
      label: '状态',
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: [
          { label: '问题', value: 'problem' },
          { label: '好人好事', value: 'good_deed' },
          { label: '快速提交', value: 'quick_submit' },
        ],
      },
      fieldName: 'snapshot_type',
      label: '类型',
    },
    { component: 'InputNumber', fieldName: 'user_id', label: '用户 UID' },
  ];
}

export function useColumns(): VxeTableGridColumns<WmxtSnapshot> {
  return [
    { field: 'id', fixed: 'left', sortable: true, title: 'ID', width: 90 },
    { field: 'title', fixed: 'left', minWidth: 180, title: '标题' },
    { field: 'user_name', title: '提交人', width: 130 },
    { field: 'snapshot_type', title: '类型', width: 120 },
    {
      cellRender: { name: 'CellTag', options: reviewStatusOptions },
      field: 'status',
      title: '状态',
      width: 100,
    },
    { field: 'location', minWidth: 180, title: '位置' },
    {
      field: 'created_at',
      formatter: ({ row }) => Times.formatOptionalUnix(row.created_at),
      sortable: true,
      title: '提交时间',
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
