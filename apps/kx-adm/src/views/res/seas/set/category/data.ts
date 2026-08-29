import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    { component: 'InputNumber', fieldName: 'id', label: '分类 ID' },
    {
      component: 'Input',
      componentProps: { allowClear: true, placeholder: '分类名称' },
      fieldName: 'name',
      label: '名称',
    },
  ];
}

export function useColumns(): VxeTableGridColumns {
  return [
    { field: 'id', fixed: 'left', title: '分类 ID', width: 100 },
    { field: 'name', minWidth: 180, title: '分类名称' },
    {
      field: 'state',
      slots: { default: 'state' },
      title: '状态',
      width: 100,
    },
    { field: 'sort_no', title: '排序', width: 100 },
    {
      field: 'create_time',
      slots: { default: 'time' },
      title: '创建时间',
      width: 180,
    },
    {
      field: 'update_time',
      slots: { default: 'time' },
      title: '更新时间',
      width: 180,
    },
    {
      align: 'right',
      field: 'operation',
      fixed: 'right',
      headerAlign: 'center',
      showOverflow: false,
      slots: { default: 'operation' },
      title: '操作',
      width: 150,
    },
  ];
}
