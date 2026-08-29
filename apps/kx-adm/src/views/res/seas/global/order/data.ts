import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';

export const orderStateOptions = [
  { label: '待付款', value: 'pending' },
  { label: '已付款', value: 'paid' },
  { label: '已退款', value: 'refunded' },
  { label: '已取消', value: 'cancelled' },
];

export const platformOptions = [
  { label: 'iOS', value: 'ios' },
  { label: 'Android', value: 'android' },
  { label: 'Web', value: 'web' },
];

export const environmentOptions = [
  { label: '生产', value: 'prod' },
  { label: '沙盒', value: 'sandbox' },
];

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    { component: 'Input', fieldName: 'idempotency_key', label: '订单幂等键' },
    {
      component: 'Input',
      fieldName: 'provider_order_id',
      label: '支付平台订单',
    },
    { component: 'Input', fieldName: 'acct_id', label: '用户 ID' },
    { component: 'Input', fieldName: 'link_id', label: '链接 ID' },
    { component: 'Input', fieldName: 'content_id', label: '剧 ID' },
    { component: 'Input', fieldName: 'attribution_uid', label: '优化师' },
    {
      component: 'Select',
      componentProps: { allowClear: true, options: orderStateOptions },
      defaultValue: 'paid',
      fieldName: 'state',
      label: '状态',
    },
    {
      component: 'Select',
      componentProps: { allowClear: true, options: platformOptions },
      fieldName: 'platform',
      label: '平台',
    },
    {
      component: 'Select',
      componentProps: { allowClear: true, options: environmentOptions },
      fieldName: 'environment',
      label: '环境',
    },
    { component: 'Input', fieldName: 'country_code', label: '地区' },
    { component: 'Input', fieldName: 'provider', label: '支付渠道' },
    {
      component: 'Input',
      componentProps: { type: 'date' },
      fieldName: 'created_start_date',
      label: '开始日期',
    },
    {
      component: 'Input',
      componentProps: { type: 'date' },
      fieldName: 'created_end_date',
      label: '结束日期',
    },
  ];
}

export function useColumns(): VxeTableGridColumns {
  return [
    { field: 'id', fixed: 'left', title: '订单 ID', width: 100 },
    {
      field: 'provider_order_id',
      minWidth: 190,
      title: '支付平台订单 ID',
    },
    {
      field: 'acct_id',
      slots: { default: 'account' },
      title: '用户 ID',
      width: 100,
    },
    { field: 'attribution_uid', title: '优化师', width: 110 },
    { field: 'link_id', title: '链接 ID', width: 90 },
    {
      field: 'amount',
      slots: { default: 'amount' },
      title: '金额',
      width: 110,
    },
    {
      field: 'item_type',
      slots: { default: 'itemType' },
      title: '充值模板类型',
      width: 130,
    },
    {
      field: 'benefit',
      slots: { default: 'benefit' },
      title: '权益(金币/章节)',
      width: 150,
    },
    { field: 'provider', title: '支付渠道', width: 110 },
    {
      field: 'state',
      slots: { default: 'state' },
      title: '状态',
      width: 100,
    },
    { field: 'environment', title: 'App 环境', width: 100 },
    { field: 'platform', title: '平台', width: 100 },
    { field: 'country_code', title: '地区', width: 100 },
    { field: 'content_purchase_seq', title: '剧第几次充值', width: 120 },
    { field: 'user_purchase_seq', title: '用户第几次充值', width: 130 },
    { field: 'content_id', title: '剧 ID', width: 90 },
    { field: 'episode_id', title: '章节 ID', width: 90 },
    { field: 'client_ip', title: 'IP', width: 130 },
    {
      field: 'remark',
      minWidth: 180,
      showOverflow: 'tooltip',
      title: '备注',
    },
    {
      field: 'created_at',
      sortable: true,
      slots: { default: 'createdAt' },
      title: '时间',
      width: 180,
    },
    {
      align: 'right',
      field: 'operation',
      fixed: 'right',
      headerAlign: 'center',
      slots: { default: 'operation' },
      title: '操作',
      width: 110,
    },
  ];
}
