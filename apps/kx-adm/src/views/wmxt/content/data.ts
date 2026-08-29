import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type { EnabledStatus, WmxtModule, WmxtModuleItem } from '#/api/wmxt';

import { Times } from '#/times';

export const enabledStatusOptions = [
  { label: '启用', value: 'active' },
  { label: '停用', value: 'inactive' },
];
export const contentStatusOptions = [
  { label: '草稿', value: 'draft' },
  { label: '已发布', value: 'published' },
  { label: '已归档', value: 'archived' },
];
export const contentTypeOptions = [
  { label: '视频', value: 'video' },
  { label: '系统文章', value: 'article' },
  { label: '微信公众号文章', value: 'wechat' },
  { label: '指定链接', value: 'link' },
];

export function useModuleFormSchema(): VbenFormSchema[] {
  return [{ component: 'Input', fieldName: 'page_code', label: '页面编码' }];
}

export function useItemFormSchema(): VbenFormSchema[] {
  return [
    { component: 'Input', fieldName: 'title', label: '标题' },
    {
      component: 'Select',
      componentProps: { allowClear: true, options: contentTypeOptions },
      fieldName: 'content_type',
      label: '类型',
    },
    {
      component: 'Select',
      componentProps: { allowClear: true, options: contentStatusOptions },
      fieldName: 'status',
      label: '状态',
    },
  ];
}

export function useModuleColumns(
  onStatusChange?: (
    status: EnabledStatus,
    row: WmxtModule,
  ) => PromiseLike<boolean | undefined>,
): VxeTableGridColumns<WmxtModule> {
  return [
    { field: 'id', fixed: 'left', title: 'ID', width: 90 },
    { field: 'page_code', fixed: 'left', minWidth: 140, title: '页面编码' },
    { field: 'module_code', minWidth: 160, title: '模块编码' },
    { field: 'module_name', minWidth: 180, title: '模块名称' },
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
    { field: 'vote_enabled', title: '投票', width: 90 },
    {
      field: 'created_at',
      formatter: ({ row }) => Times.formatOptionalUnix(row.created_at),
      title: '创建时间',
      width: 180,
    },
    {
      field: 'actions',
      fixed: 'right',
      slots: { default: 'actions' },
      title: '操作',
      width: 220,
    },
  ];
}

export function useItemColumns(): VxeTableGridColumns<WmxtModuleItem> {
  return [
    { field: 'id', fixed: 'left', title: 'ID', width: 90 },
    { field: 'title', fixed: 'left', minWidth: 220, title: '标题' },
    {
      cellRender: { name: 'CellTag', options: contentTypeOptions },
      field: 'content_type',
      title: '内容类型',
      width: 110,
    },
    { field: 'sort_order', title: '排序', width: 90 },
    {
      cellRender: { name: 'CellTag', options: contentStatusOptions },
      field: 'status',
      title: '状态',
      width: 100,
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
      width: 200,
    },
  ];
}

export function useModuleManageColumns(
  onStatusChange?: (
    status: EnabledStatus,
    row: WmxtModule,
  ) => PromiseLike<boolean | undefined>,
): VxeTableGridColumns<WmxtModule> {
  return [
    {
      field: 'drag',
      fixed: 'left',
      slots: { default: 'drag' },
      title: '',
      width: 42,
    },
    {
      field: 'module_name',
      fixed: 'left',
      minWidth: 140,
      slots: { default: 'module_name' },
      title: '模块名称',
    },
    { field: 'module_code', minWidth: 125, title: '模块编码' },
    { field: 'sort_order', title: '顺序', width: 56 },
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
      width: 84,
    },
    {
      cellRender: {
        name: 'CellTag',
        options: [
          { color: 'success', label: '允许', value: true },
          { color: 'default', label: '关闭', value: false },
        ],
      },
      field: 'vote_enabled',
      title: '投票',
      width: 66,
    },
    {
      field: 'actions',
      fixed: 'right',
      slots: { default: 'actions' },
      title: '',
      width: 44,
    },
  ];
}

export function useItemManageColumns(): VxeTableGridColumns<WmxtModuleItem> {
  return [
    {
      field: 'drag',
      fixed: 'left',
      slots: { default: 'drag' },
      title: '',
      width: 42,
    },
    {
      field: 'title',
      fixed: 'left',
      minWidth: 220,
      slots: { default: 'title' },
      title: '内容标题',
    },
    {
      cellRender: { name: 'CellTag', options: contentTypeOptions },
      field: 'content_type',
      title: '类型',
      width: 90,
    },
    { field: 'sort_order', title: '顺序', width: 56 },
    {
      cellRender: { name: 'CellTag', options: contentStatusOptions },
      field: 'status',
      title: '状态',
      width: 84,
    },
    { field: 'view_count', title: '浏览', width: 64 },
    {
      field: 'actions',
      fixed: 'right',
      slots: { default: 'actions' },
      title: '',
      width: 82,
    },
  ];
}
