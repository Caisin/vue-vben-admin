import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type { EnabledStatus, WmxtNotification } from '#/api/wmxt';

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
  return [{ component: 'Input', fieldName: 'title', label: '标题' }];
}

export function useColumns(
  onStatusChange?: (
    status: EnabledStatus,
    row: WmxtNotification,
  ) => PromiseLike<boolean | undefined>,
): VxeTableGridColumns<WmxtNotification> {
  return [
    { field: 'id', fixed: 'left', sortable: true, title: 'ID', width: 90 },
    { field: 'title', fixed: 'left', minWidth: 220, title: '标题' },
    { field: 'notice_type', title: '类型', width: 110 },
    { field: 'target', title: '目标', width: 100 },
    { field: 'sort_order', title: '排序', width: 90 },
    {
      cellRender: onStatusChange
        ? {
            attrs: { beforeChange: onStatusChange },
            name: 'CellSwitch',
            props: { checkedValue: 'active', unCheckedValue: 'inactive' },
          }
        : { name: 'CellTag', options: enabledStatusOptions },
      field: 'status',
      title: '状态',
      width: 90,
    },
    {
      field: 'published_at',
      formatter: ({ row }) => Times.formatOptionalUnix(row.published_at),
      title: '发布时间',
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
