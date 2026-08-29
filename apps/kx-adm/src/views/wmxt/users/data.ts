import type { SelectOption } from '../utils';

import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type { EnabledStatus, WmxtAdminUser } from '#/api/wmxt';

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
  orgOptions: SelectOption[] = [],
  familyOptions: SelectOption[] = [],
): VbenFormSchema[] {
  return [
    { component: 'Input', fieldName: 'keyword', label: '昵称' },
    {
      component: 'Select',
      componentProps: { allowClear: true, options: wmxtRoleOptions },
      fieldName: 'role',
      label: '角色',
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        class: 'w-full',
        optionFilterProp: 'label',
        options: orgOptions,
        showSearch: true,
      },
      fieldName: 'org_id',
      label: '单位',
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        class: 'w-full',
        optionFilterProp: 'label',
        options: familyOptions,
        showSearch: true,
      },
      fieldName: 'family_id',
      label: '家庭',
    },
  ];
}

export function useColumns(
  onStatusChange?: (
    status: EnabledStatus,
    row: WmxtAdminUser,
  ) => PromiseLike<boolean | undefined>,
): VxeTableGridColumns<WmxtAdminUser> {
  return [
    {
      field: 'user_id',
      fixed: 'left',
      sortable: true,
      title: 'UID',
      width: 100,
    },
    { field: 'nickname', fixed: 'left', minWidth: 160, title: '昵称' },
    { field: 'username', minWidth: 150, title: '账号' },
    {
      field: 'role_labels',
      formatter: ({ row }) => row.role_labels.join('、') || '-',
      minWidth: 180,
      title: '小程序角色',
    },
    {
      cellRender: onStatusChange
        ? {
            attrs: { beforeChange: onStatusChange },
            name: 'CellSwitch',
            props: { checkedValue: 'active', unCheckedValue: 'inactive' },
          }
        : { name: 'CellTag', options: enabledStatusOptions },
      field: 'status',
      title: '账号状态',
      width: 110,
    },
    { field: 'org_name', minWidth: 160, title: '单位' },
    { field: 'family_name', minWidth: 160, title: '家庭' },
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
