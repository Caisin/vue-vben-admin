import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';

export const pushStateOptions = [
  { label: '未推送', value: 0 },
  { label: '已推送', value: 1 },
];

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      componentProps: { allowClear: true, placeholder: '推送标题' },
      fieldName: 'title',
      label: '标题',
    },
    { component: 'InputNumber', fieldName: 'uid', label: '用户 ID' },
    { component: 'InputNumber', fieldName: 'res_id', label: '剧 ID' },
    {
      component: 'Select',
      componentProps: { allowClear: true, options: pushStateOptions },
      fieldName: 'state',
      label: '状态',
    },
  ];
}

export function useColumns(): VxeTableGridColumns {
  return [
    { field: 'id', fixed: 'left', title: 'ID', width: 80 },
    { field: 'uid', title: '创建用户', width: 110 },
    { field: 'title', minWidth: 180, title: '标题' },
    {
      field: 'content',
      minWidth: 240,
      showOverflow: 'tooltip',
      title: '内容',
    },
    { field: 'res_id', title: '剧 ID', width: 100 },
    { field: 'item_id', title: '章节 ID', width: 100 },
    { field: 'seq_no', title: '集数', width: 80 },
    {
      field: 'state',
      slots: { default: 'state' },
      title: '状态',
      width: 100,
    },
    {
      field: 'created_at',
      slots: { default: 'time' },
      title: '创建时间',
      width: 180,
    },
    {
      field: 'update_at',
      slots: { default: 'time' },
      title: '发送时间',
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
      width: 130,
    },
  ];
}
