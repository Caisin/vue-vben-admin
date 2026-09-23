import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type { ResourceCode } from '#/api/res/seas/global/resource_codes';

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      componentProps: { allowClear: true, placeholder: '编号、名称或作者' },
      fieldName: 'keyword',
      label: '关键字',
    },
  ];
}

export function useColumns(): VxeTableGridColumns<ResourceCode> {
  return [
    { field: 'code', title: '作品编号', minWidth: 170 },
    { field: 'name', title: '作品名称', minWidth: 180 },
    { field: 'author', title: '作者', minWidth: 140 },
    { field: 'remark', title: '备注', minWidth: 220, showOverflow: 'tooltip' },
    { field: 'updated_at', title: '更新时间', width: 170 },
    {
      field: 'operation',
      title: '操作',
      width: 100,
      fixed: 'right',
      align: 'right',
      showOverflow: false,
      slots: { default: 'operation' },
    },
  ];
}
