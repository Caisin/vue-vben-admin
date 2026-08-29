import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type { EnabledStatus, WmxtHomeEntry, WmxtRole } from '#/api/wmxt';

import { Times } from '#/times';

export const homeTargetOptions: { label: string; value: WmxtRole }[] = [
  { label: '管理端', value: 'admin' },
  { label: '个人端', value: 'personal' },
  { label: '单位端', value: 'org' },
];

export const enabledStatusOptions: { label: string; value: EnabledStatus }[] = [
  { label: '启用', value: 'active' },
  { label: '停用', value: 'inactive' },
];

export const builtinIconOptions = [
  { icon: 'lucide:pencil', label: '编辑', value: 'edit-pen' },
  { icon: 'lucide:list', label: '列表', value: 'list' },
  { icon: 'lucide:file-text', label: '文本', value: 'file-text' },
  { icon: 'lucide:store', label: '商城', value: 'shop' },
  { icon: 'lucide:gift', label: '礼物', value: 'gift-fill' },
  { icon: 'lucide:user', label: '账号', value: 'account' },
  { icon: 'lucide:camera', label: '相机', value: 'camera' },
  { icon: 'lucide:map-pin', label: '定位', value: 'map-pin' },
  { icon: 'lucide:info', label: '信息', value: 'info-circle' },
  { icon: 'lucide:clipboard-list', label: '订单', value: 'order' },
  { icon: 'lucide:image', label: '图片', value: 'photo' },
  { icon: 'lucide:circle-check', label: '审核', value: 'checkmark-circle' },
  { icon: 'lucide:coins', label: '积分', value: 'integral' },
  { icon: 'lucide:map', label: '地图', value: 'map' },
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
    { component: 'Input', fieldName: 'code', label: '入口编码' },
    { component: 'Input', fieldName: 'title', label: '入口名称' },
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
    homeTargetOptions.find((item) => item.value === target)?.label ?? target
  );
}

export function useColumns(
  onStatusChange: (
    status: EnabledStatus,
    row: WmxtHomeEntry,
  ) => PromiseLike<boolean | undefined>,
): VxeTableGridColumns<WmxtHomeEntry> {
  return [
    {
      field: 'drag',
      fixed: 'left',
      slots: { default: 'drag' },
      title: '',
      width: 44,
    },
    { field: 'id', fixed: 'left', sortable: true, title: 'ID', width: 90 },
    {
      field: 'title',
      fixed: 'left',
      minWidth: 180,
      slots: { default: 'title' },
      title: '入口名称',
    },
    { field: 'code', minWidth: 150, sortable: true, title: '编码' },
    {
      field: 'icon_name',
      slots: { default: 'icon' },
      title: '图标',
      width: 90,
    },
    { field: 'page_title', minWidth: 160, title: '小程序页面' },
    { field: 'route', minWidth: 260, title: '页面路径' },
    { field: 'sort_order', sortable: true, title: '排序', width: 90 },
    {
      cellRender: {
        attrs: { beforeChange: onStatusChange },
        name: 'CellSwitch',
        props: { checkedValue: 'active', unCheckedValue: 'inactive' },
      },
      field: 'status',
      title: '状态',
      width: 90,
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
