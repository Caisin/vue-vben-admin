import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type { EnabledStatus, WmxtProfileEntry, WmxtRole } from '#/api/wmxt';

import { Times } from '#/times';

export const profileTargetOptions: { label: string; value: WmxtRole }[] = [
  { label: '管理端', value: 'admin' },
  { label: '个人端', value: 'personal' },
  { label: '单位端', value: 'org' },
];

export const enabledStatusOptions: { label: string; value: EnabledStatus }[] = [
  { label: '启用', value: 'active' },
  { label: '停用', value: 'inactive' },
];

export const builtinIconOptions = [
  { icon: 'lucide:pencil', label: '编辑', value: 'edit' },
  { icon: 'lucide:list', label: '列表', value: 'list' },
  { icon: 'lucide:list-ordered', label: '明细', value: 'ordered-list' },
  { icon: 'lucide:file', label: '文件', value: 'file' },
  { icon: 'lucide:store', label: '商城', value: 'store' },
  { icon: 'lucide:gift', label: '赠送', value: 'gift' },
  { icon: 'lucide:user', label: '用户', value: 'user' },
  { icon: 'lucide:users', label: '用户组', value: 'user-group' },
  { icon: 'lucide:camera', label: '相机', value: 'camera' },
  { icon: 'lucide:image', label: '图片', value: 'image' },
  { icon: 'lucide:circle-check', label: '审核', value: 'check-circle' },
  { icon: 'lucide:star', label: '积分', value: 'star' },
  { icon: 'lucide:house', label: '家庭', value: 'home' },
  { icon: 'lucide:building-2', label: '单位', value: 'organization' },
  { icon: 'lucide:bell', label: '通知', value: 'notification' },
  { icon: 'lucide:settings', label: '设置', value: 'settings' },
  { icon: 'lucide:plus', label: '新增', value: 'plus' },
  { icon: 'lucide:grid-3x3', label: '应用', value: 'apps' },
];

const builtinIconMap = new Map(
  builtinIconOptions.map((item) => [item.value, item.icon]),
);

export function builtinIconifyName(iconName?: string) {
  if (!iconName) return 'lucide:grid-3x3';
  return builtinIconMap.get(iconName) ?? 'lucide:grid-3x3';
}

export function useFormSchema(): VbenFormSchema[] {
  return [
    { component: 'Input', fieldName: 'code', label: '功能编码' },
    { component: 'Input', fieldName: 'group_name', label: '分组名称' },
    { component: 'Input', fieldName: 'title', label: '功能名称' },
    {
      component: 'Select',
      componentProps: { allowClear: true, options: enabledStatusOptions },
      fieldName: 'status',
      label: '状态',
    },
  ];
}

export function targetLabel(target: WmxtRole) {
  return (
    profileTargetOptions.find((item) => item.value === target)?.label ?? target
  );
}

export function useColumns(
  onStatusChange: (
    status: EnabledStatus,
    row: WmxtProfileEntry,
  ) => PromiseLike<boolean | undefined>,
): VxeTableGridColumns<WmxtProfileEntry> {
  return [
    {
      field: 'drag',
      fixed: 'left',
      slots: { default: 'drag' },
      title: '',
      width: 44,
    },
    { field: 'id', fixed: 'left', sortable: true, title: 'ID', width: 80 },
    {
      field: 'title',
      fixed: 'left',
      minWidth: 170,
      slots: { default: 'title' },
      title: '功能名称',
    },
    { field: 'group_name', minWidth: 120, title: '分组' },
    { field: 'subtitle', minWidth: 220, title: '说明' },
    { field: 'code', minWidth: 150, sortable: true, title: '编码' },
    {
      field: 'icon_name',
      slots: { default: 'icon' },
      title: '图标',
      width: 90,
    },
    { field: 'page_title', minWidth: 160, title: '小程序页面' },
    { field: 'route', minWidth: 260, title: '页面路径' },
    { field: 'sort_order', sortable: true, title: '排序', width: 80 },
    {
      cellRender: {
        attrs: { beforeChange: onStatusChange },
        name: 'CellSwitch',
        props: { checkedValue: 'active', unCheckedValue: 'inactive' },
      },
      field: 'status',
      title: '状态',
      width: 80,
    },
    {
      field: 'updated_at',
      formatter: ({ row }) => Times.formatOptionalUnix(row.updated_at),
      sortable: true,
      title: '更新时间',
      width: 180,
    },
    {
      field: 'actions',
      fixed: 'right',
      slots: { default: 'actions' },
      title: '操作',
      width: 120,
    },
  ];
}
