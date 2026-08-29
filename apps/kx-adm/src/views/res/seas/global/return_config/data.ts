import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';

export const yesNoOptions = [
  { label: '否', value: 0 },
  { label: '是', value: 1 },
];

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    { component: 'Input', fieldName: 'name', label: '模板名称' },
    {
      component: 'Select',
      componentProps: { allowClear: true, options: yesNoOptions },
      fieldName: 'is_def',
      label: '是否默认',
    },
    {
      component: 'Input',
      defaultValue: 'link',
      fieldName: 'dimension',
      label: '维度',
    },
  ];
}

export function useColumns(): VxeTableGridColumns {
  return [
    { field: 'id', fixed: 'left', title: 'ID', width: 80 },
    { field: 'name', minWidth: 180, title: '回传模板名称' },
    {
      field: 'percent',
      slots: { default: 'percent' },
      title: '回传比例',
      width: 110,
    },
    {
      field: 'money_map',
      slots: { default: 'moneyMap' },
      title: '回传卡点',
      width: 320,
    },
    {
      field: 'is_def',
      slots: { default: 'isDef' },
      title: '是否默认',
      width: 100,
    },
    { field: 'uid', title: '创建用户ID', width: 120 },
    { field: 'remark', minWidth: 180, title: '备注' },
    { field: 'create_time', title: '时间', width: 150 },
    {
      align: 'right',
      field: 'operation',
      fixed: 'right',
      headerAlign: 'center',
      slots: { default: 'operation' },
      title: '操作',
      width: 90,
    },
  ];
}
