import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type { WmxtSurvey } from '#/api/wmxt';

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
export const surveyStatusOptions = [
  { label: '进行中', value: 'active' },
  { label: '已结束', value: 'closed' },
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
    { component: 'Input', fieldName: 'title', label: '标题' },
    {
      component: 'Select',
      componentProps: { allowClear: true, options: surveyStatusOptions },
      fieldName: 'status',
      label: '状态',
    },
    {
      component: 'Select',
      componentProps: { allowClear: true, options: targetRoleOptions },
      fieldName: 'target',
      label: '对象',
    },
  ];
}

export function useColumns(): VxeTableGridColumns<WmxtSurvey> {
  return [
    { field: 'id', fixed: 'left', sortable: true, title: 'ID', width: 90 },
    { field: 'title', fixed: 'left', minWidth: 220, title: '问卷标题' },
    {
      cellRender: { name: 'CellTag', options: targetRoleOptions },
      field: 'target',
      title: '对象',
      width: 100,
    },
    {
      cellRender: { name: 'CellTag', options: surveyStatusOptions },
      field: 'status',
      title: '状态',
      width: 90,
    },
    { field: 'points', title: '积分', width: 90 },
    {
      field: 'deadline_at',
      formatter: ({ row }) => Times.formatOptionalUnix(row.deadline_at),
      sortable: true,
      title: '截止时间',
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
