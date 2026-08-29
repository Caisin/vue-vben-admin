import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type { PayOrder } from '#/api/asset/pay';

import { Times } from '#/times';

export const orderStateOptions = [
  { color: 'warning', label: '待支付', value: 'pending' },
  { color: 'success', label: '已支付', value: 'paid' },
  { color: 'default', label: '已取消', value: 'cancelled' },
  { color: 'error', label: '已退款', value: 'refunded' },
];

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'InputNumber',
      componentProps: { class: 'w-full', min: 0 },
      fieldName: 'acct_id',
      label: '资金账户 ID',
    },
    {
      component: 'InputNumber',
      componentProps: { class: 'w-full', min: 0 },
      fieldName: 'pay_item_id',
      label: '商品 ID',
    },
    { component: 'Input', fieldName: 'provider', label: '支付渠道' },
    { component: 'Input', fieldName: 'provider_order_id', label: '渠道订单' },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        class: 'w-full',
        options: orderStateOptions,
      },
      fieldName: 'state',
      label: '状态',
    },
    {
      component: 'InputNumber',
      componentProps: { class: 'w-full', min: 0 },
      fieldName: 'content_id',
      label: '内容 ID',
    },
    {
      component: 'InputNumber',
      componentProps: { class: 'w-full', min: 0 },
      fieldName: 'link_id',
      label: '链接 ID',
    },
    {
      component: 'InputNumber',
      componentProps: { class: 'w-full', min: 0 },
      fieldName: 'attribution_uid',
      label: '归因 UID',
    },
    { component: 'Input', fieldName: 'platform', label: '平台' },
    { component: 'Input', fieldName: 'country_code', label: '地区' },
    { component: 'Input', fieldName: 'environment', label: '环境' },
  ];
}

export function useColumns(): VxeTableGridColumns<PayOrder> {
  return [
    {
      field: 'id',
      sortable: true,
      fixed: 'left',
      title: '订单 ID',
      width: 110,
    },
    { field: 'acct_id', sortable: true, title: '资金账户 ID', width: 130 },
    { field: 'pay_item_id', title: '商品 ID', width: 110 },
    { field: 'content_id', title: '内容 ID', width: 100 },
    { field: 'episode_id', title: '章节 ID', width: 100 },
    { field: 'link_id', title: '链接 ID', width: 100 },
    { field: 'attribution_uid', title: '归因 UID', width: 110 },
    { field: 'provider', title: '支付渠道', width: 120 },
    { field: 'provider_order_id', minWidth: 190, title: '渠道订单号' },
    { field: 'platform', title: '平台', width: 100 },
    { field: 'country_code', title: '地区', width: 90 },
    { field: 'environment', title: '环境', width: 100 },
    { field: 'content_purchase_seq', title: '内容第几次', width: 110 },
    { field: 'user_purchase_seq', title: '用户第几次', width: 110 },
    { field: 'client_ip', title: 'IP', width: 130 },
    {
      cellRender: { name: 'CellTag', options: orderStateOptions },
      field: 'state',
      title: '状态',
      width: 110,
    },
    { field: 'remark', minWidth: 160, title: '备注' },
    {
      field: 'created_at',
      formatter: ({ row }) => Times.formatUnix(row.created_at),
      sortable: true,
      title: '创建时间',
      width: 180,
    },
    {
      field: 'operation',
      fixed: 'right',
      slots: { default: 'actionCell' },
      title: '任务',
      width: 150,
    },
  ];
}
