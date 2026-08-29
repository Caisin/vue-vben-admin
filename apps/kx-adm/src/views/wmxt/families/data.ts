import type { SelectOption } from '../utils';

import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type { WmxtFamily } from '#/api/wmxt';

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

export function useFormSchema(
  userOptions: SelectOption[] = [],
): VbenFormSchema[] {
  return [
    { component: 'Input', fieldName: 'name', label: '家庭名称' },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        class: 'w-full',
        optionFilterProp: 'label',
        options: userOptions,
        showSearch: true,
      },
      fieldName: 'creator_user_id',
      label: '创建者',
    },
  ];
}

export function useColumns(
  userLabel: (uid: number | string) => string,
): VxeTableGridColumns<WmxtFamily> {
  return [
    { field: 'id', fixed: 'left', sortable: true, title: 'ID', width: 90 },
    { field: 'name', fixed: 'left', minWidth: 180, title: '家庭名称' },
    {
      field: 'creator_user_id',
      formatter: ({ row }) => userLabel(row.creator_user_id),
      minWidth: 160,
      title: '创建者',
    },
    { field: 'member_count', title: '成员数', width: 90 },
    { field: 'invite_code', minWidth: 160, title: '邀请码' },
    { field: 'available_score', title: '可用积分', width: 120 },
    {
      field: 'created_at',
      formatter: ({ row }) => Times.formatOptionalUnix(row.created_at),
      sortable: true,
      title: '创建时间',
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
