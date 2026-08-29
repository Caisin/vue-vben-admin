import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';

export const stateOptions = [
  { label: '正常', value: 1 },
  { label: '停用', value: 0 },
];

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    { component: 'Input', fieldName: 'product_name', label: 'SKU 名称' },
    { component: 'Input', fieldName: 'product_id', label: 'SKU ID' },
    {
      component: 'Select',
      componentProps: { allowClear: true, options: stateOptions },
      fieldName: 'state',
      label: '状态',
    },
  ];
}

export function useColumns(): VxeTableGridColumns {
  return [
    { field: 'id', fixed: 'left', title: 'ID', width: 80 },
    { field: 'product_id', title: 'SKU ID', width: 180 },
    { field: 'product_name', minWidth: 180, title: 'SKU 名称' },
    { field: 'pay_item_id', title: '支付商品ID', width: 110 },
    {
      field: 'item_type',
      slots: { default: 'itemType' },
      title: '类型',
      width: 110,
    },
    {
      field: 'amount',
      slots: { default: 'amount' },
      title: '金额/权益',
      width: 220,
    },
    {
      field: 'subscription',
      slots: { default: 'subscription' },
      title: '订阅',
      width: 90,
    },
    {
      field: 'enabled',
      slots: { default: 'enabled' },
      title: '状态',
      width: 90,
    },
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
