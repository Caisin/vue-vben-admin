import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type { EnabledStatus, WmxtBanner } from '#/api/wmxt';

import { Times } from '#/times';

export const enabledStatusOptions = [
  { label: '启用', value: 'active' },
  { label: '停用', value: 'inactive' },
];

export function useFormSchema(): VbenFormSchema[] {
  return [
    { component: 'Input', fieldName: 'title', label: '标题' },
    { component: 'Input', fieldName: 'target', label: '端' },
    {
      component: 'Select',
      componentProps: { allowClear: true, options: enabledStatusOptions },
      fieldName: 'status',
      label: '状态',
    },
  ];
}

export function useColumns(
  onStatusChange?: (
    status: EnabledStatus,
    row: WmxtBanner,
  ) => PromiseLike<boolean | undefined>,
): VxeTableGridColumns<WmxtBanner> {
  return [
    { field: 'id', fixed: 'left', sortable: true, title: 'ID', width: 90 },
    { field: 'title', fixed: 'left', minWidth: 180, title: '标题' },
    { field: 'target', title: '端', width: 100 },
    { field: 'material_type', title: '素材', width: 100 },
    { field: 'link_type', title: '链接类型', width: 110 },
    { field: 'sort_order', sortable: true, title: '排序', width: 90 },
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
      field: 'updated_at',
      formatter: ({ row }) => Times.formatOptionalUnix(row.updated_at),
      sortable: true,
      title: '更新时间',
      width: 180,
    },
    { field: 'url', minWidth: 260, title: '素材文件' },
    {
      field: 'actions',
      fixed: 'right',
      slots: { default: 'actions' },
      title: '操作',
      width: 180,
    },
  ];
}
