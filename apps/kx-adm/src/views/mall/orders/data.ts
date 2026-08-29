import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type { MallAdminOrder } from '#/api/mall';

import { Times } from '#/times';

import { fulfillmentTypeOptions } from '../shared';

export const mallOrderStatusOptions = [
  { color: 'processing', label: '已支付', value: 'paid' },
  { color: 'blue', label: '履约中', value: 'fulfilling' },
  { color: 'cyan', label: '已发货', value: 'shipped' },
  { color: 'warning', label: '待自提', value: 'ready_for_pickup' },
  { color: 'success', label: '已完成', value: 'completed' },
  { color: 'default', label: '已取消', value: 'cancelled' },
  { color: 'purple', label: '已退款', value: 'refunded' },
];

export const mallRefundStateOptions = [
  { color: 'default', label: '无退款', value: 'none' },
  { color: 'warning', label: '部分退款', value: 'partial' },
  { color: 'purple', label: '全额退款', value: 'full' },
];

export function orderStatusLabel(value?: string) {
  return (
    mallOrderStatusOptions.find((item) => item.value === value)?.label ??
    value ??
    '-'
  );
}

export function fulfillmentLabel(value?: string) {
  return (
    fulfillmentTypeOptions.find((item) => item.value === value)?.label ??
    value ??
    '-'
  );
}

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    { component: 'Input', fieldName: 'keyword', label: '订单号/商品' },
    {
      component: 'Select',
      componentProps: { allowClear: true, options: mallOrderStatusOptions },
      fieldName: 'status',
      label: '订单状态',
    },
    {
      component: 'Select',
      componentProps: { allowClear: true, options: fulfillmentTypeOptions },
      fieldName: 'fulfillment_type',
      label: '履约类型',
    },
    {
      component: 'InputNumber',
      componentProps: { class: 'w-full', min: 1 },
      fieldName: 'uid',
      label: '用户 ID',
    },
  ];
}

export function useColumns(): VxeTableGridColumns<MallAdminOrder> {
  return [
    {
      field: 'order_no',
      fixed: 'left',
      minWidth: 190,
      slots: { default: 'orderNoCell' },
      title: '订单号',
    },
    { field: 'uid', title: '用户 ID', width: 110 },
    {
      cellRender: { name: 'CellTag', options: mallOrderStatusOptions },
      field: 'status',
      sortable: true,
      title: '状态',
      width: 110,
    },
    {
      cellRender: { name: 'CellTag', options: fulfillmentTypeOptions },
      field: 'fulfillment_type',
      title: '履约',
      width: 110,
    },
    { field: 'points_total', sortable: true, title: '积分', width: 110 },
    {
      cellRender: { name: 'CellTag', options: mallRefundStateOptions },
      field: 'refund_state',
      title: '退款',
      width: 110,
    },
    { field: 'address_masked', minWidth: 220, title: '收货/履约摘要' },
    {
      field: 'created_at',
      formatter: ({ row }) => Times.formatUnix(row.created_at),
      sortable: true,
      title: '下单时间',
      width: 180,
    },
  ];
}
