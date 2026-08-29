import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type { MallAfterSaleView } from '#/api/mall';

import { Times } from '#/times';

export const mallAfterSaleStatusOptions = [
  { color: 'processing', label: '待审核', value: 'requested' },
  { color: 'blue', label: '已通过', value: 'approved' },
  { color: 'warning', label: '退货中', value: 'returning' },
  { color: 'cyan', label: '已收货', value: 'received' },
  { color: 'purple', label: '退款中', value: 'refunding' },
  { color: 'success', label: '已完成', value: 'completed' },
  { color: 'error', label: '已拒绝', value: 'rejected' },
  { color: 'default', label: '已取消', value: 'cancelled' },
];

export function afterSaleStatusLabel(value?: string) {
  return (
    mallAfterSaleStatusOptions.find((item) => item.value === value)?.label ??
    value ??
    '-'
  );
}

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    { component: 'Input', fieldName: 'after_sale_no', label: '售后单号' },
    {
      component: 'Select',
      componentProps: { allowClear: true, options: mallAfterSaleStatusOptions },
      fieldName: 'status',
      label: '状态',
    },
    {
      component: 'InputNumber',
      componentProps: { class: 'w-full', min: 1 },
      fieldName: 'order_id',
      label: '订单 ID',
    },
    {
      component: 'InputNumber',
      componentProps: { class: 'w-full', min: 1 },
      fieldName: 'user_id',
      label: '用户 ID',
    },
  ];
}

export function useColumns(): VxeTableGridColumns<MallAfterSaleView> {
  return [
    {
      field: 'after_sale_no',
      fixed: 'left',
      minWidth: 190,
      slots: { default: 'noCell' },
      title: '售后单号',
    },
    { field: 'order_id', title: '订单 ID', width: 110 },
    { field: 'user_id', title: '用户 ID', width: 110 },
    {
      cellRender: { name: 'CellTag', options: mallAfterSaleStatusOptions },
      field: 'status',
      title: '状态',
      width: 110,
    },
    { field: 'refund_points', title: '退款积分', width: 110 },
    {
      field: 'return_required',
      formatter: ({ row }) => (row.return_required ? '需退货' : '仅退款'),
      title: '退货',
      width: 100,
    },
    { field: 'description_summary', minWidth: 220, title: '摘要' },
    {
      field: 'created_at',
      formatter: ({ row }) => Times.formatUnix(row.created_at),
      sortable: true,
      title: '申请时间',
      width: 180,
    },
  ];
}
