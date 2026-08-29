import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type { MallInventoryTx, MallInventoryView } from '#/api/mall';

import { Times } from '#/times';

export const inventoryTxKindOptions = [
  { color: 'success', label: '增加', value: 'increase' },
  { color: 'warning', label: '减少', value: 'decrease' },
  { color: 'processing', label: '销售', value: 'sale' },
  { color: 'default', label: '释放', value: 'release' },
];

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'InputNumber',
      componentProps: { class: 'w-full', min: 1 },
      fieldName: 'sku_id',
      label: 'SKU ID',
    },
  ];
}

export function useLogGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'InputNumber',
      componentProps: { class: 'w-full', min: 1 },
      fieldName: 'sku_id',
      label: 'SKU ID',
    },
    {
      component: 'InputNumber',
      componentProps: { class: 'w-full', min: 1 },
      fieldName: 'order_id',
      label: '订单 ID',
    },
  ];
}

export function useColumns(): VxeTableGridColumns<MallInventoryView> {
  return [
    {
      field: 'id',
      fixed: 'left',
      sortable: true,
      title: '库存 ID',
      width: 110,
    },
    {
      field: 'sku_id',
      fixed: 'left',
      sortable: true,
      title: 'SKU ID',
      width: 110,
    },
    { field: 'available_stock', sortable: true, title: '可售库存', width: 120 },
    { field: 'sold_stock', sortable: true, title: '已售数量', width: 120 },
    {
      field: 'updated_at',
      formatter: ({ row }) => Times.formatOptionalUnix(row.updated_at),
      sortable: true,
      title: '更新时间',
      width: 180,
    },
    {
      field: 'operation',
      fixed: 'right',
      slots: { default: 'operation' },
      title: '操作',
      width: 120,
    },
  ];
}

export function useLogColumns(): VxeTableGridColumns<MallInventoryTx> {
  return [
    {
      field: 'id',
      fixed: 'left',
      sortable: true,
      title: '流水 ID',
      width: 110,
    },
    { field: 'sku_id', sortable: true, title: 'SKU ID', width: 110 },
    {
      cellRender: { name: 'CellTag', options: inventoryTxKindOptions },
      field: 'kind',
      title: '类型',
      width: 100,
    },
    { field: 'quantity', title: '数量', width: 100 },
    { field: 'before_available_stock', title: '调整前可售', width: 130 },
    { field: 'after_available_stock', title: '调整后可售', width: 130 },
    { field: 'before_sold_stock', title: '调整前已售', width: 130 },
    { field: 'after_sold_stock', title: '调整后已售', width: 130 },
    { field: 'business_key', minWidth: 200, title: '业务键' },
    { field: 'operator_uid', title: '操作人', width: 110 },
    { field: 'reason', minWidth: 240, title: '原因' },
    {
      field: 'created_at',
      formatter: ({ row }) => Times.formatUnix(row.created_at),
      sortable: true,
      title: '创建时间',
      width: 180,
    },
  ];
}
