import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';

export const stateOptions = [
  { label: '未完结', value: 0 },
  { label: '已完结', value: 1 },
];

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    { component: 'InputNumber', fieldName: 'uid', label: '用户ID' },
    { component: 'Input', fieldName: 'feed_back_type', label: '反馈类型' },
    {
      component: 'Select',
      componentProps: { allowClear: true, options: stateOptions },
      fieldName: 'is_done',
      label: '是否完结',
    },
  ];
}

export function useColumns(): VxeTableGridColumns {
  return [
    { field: 'id', fixed: 'left', title: 'ID', width: 90 },
    { field: 'uid', title: '用户ID', width: 120 },
    { field: 'feed_back_type', title: '反馈类型', width: 120 },
    {
      field: 'content',
      slots: { default: 'content' },
      title: '反馈内容',
      width: 360,
    },
    {
      field: 'user_has_reply',
      slots: { default: 'boolTag' },
      title: '用户新消息',
      width: 110,
    },
    {
      field: 'kf_has_reply',
      slots: { default: 'boolTag' },
      title: '客服已回复',
      width: 110,
    },
    {
      field: 'is_done',
      slots: { default: 'isDone' },
      title: '状态',
      width: 100,
    },
    { field: 'created_at', sortable: true, title: '时间', width: 170 },
    {
      align: 'right',
      field: 'operation',
      fixed: 'right',
      headerAlign: 'center',
      showOverflow: false,
      slots: { default: 'operation' },
      title: '操作',
      width: 220,
    },
  ];
}
