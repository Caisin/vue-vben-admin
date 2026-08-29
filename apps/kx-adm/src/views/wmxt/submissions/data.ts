import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type { WmxtSubmission } from '#/api/wmxt';

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
      component: 'DicSelect',
      componentProps: { allowClear: true, code: 'wmxt_submission_status' },
      fieldName: 'status',
      label: '状态',
    },
    { component: 'Input', fieldName: 'submission_kind', label: '类型' },
    {
      component: 'InputNumber',
      fieldName: 'submitter_user_id',
      label: '提交人 UID',
    },
  ];
}

export function useColumns(
  taskLabel: (taskId: number | string | undefined) => string,
): VxeTableGridColumns<WmxtSubmission> {
  return [
    { field: 'id', fixed: 'left', sortable: true, title: 'ID', width: 90 },
    { field: 'submitter_name', fixed: 'left', minWidth: 160, title: '提交人' },
    { field: 'submission_kind', title: '类型', width: 130 },
    {
      cellRender: {
        name: 'CellDic',
        props: { code: 'wmxt_submission_status' },
      },
      field: 'status',
      title: '状态',
      width: 100,
    },
    {
      field: 'task_id',
      formatter: ({ row }) => taskLabel(row.task_id),
      minWidth: 180,
      title: '关联任务',
    },
    { field: 'note', minWidth: 260, title: '说明' },
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
