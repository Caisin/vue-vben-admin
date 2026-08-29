import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type { PayItem, PayItemType, PaySku } from '#/api/asset/pay';

import { enabledSelectOptions } from '#/views/_shared/crud-page';

export const payPlatformOptions = [
  { label: '全部', value: 'any' },
  { label: 'Web', value: 'web' },
  { label: 'iOS', value: 'ios' },
  { label: 'Android', value: 'android' },
];

export const payItemTypeOptions: Array<{
  color?: string;
  label: string;
  value: PayItemType;
}> = [
  { color: 'default', label: '普通余额', value: 'normal' },
  { color: 'success', label: 'VIP 会员', value: 'vip' },
  { color: 'processing', label: '章节解锁', value: 'res_item' },
  { color: 'purple', label: '整本解锁', value: 'res_total' },
];

export const subscriptionOptions = [
  { color: 'success', label: '订阅', value: true },
  { color: 'default', label: '一次性', value: false },
];

export function payItemTypeLabel(value?: PayItemType) {
  return payItemTypeOptions.find((item) => item.value === value)?.label ?? '-';
}

export function formatMinorAmount(amount?: number | string, currency?: string) {
  const value =
    amount === undefined || amount === null || amount === ''
      ? '-'
      : String(amount);
  return currency ? `${value} ${currency}` : value;
}

export function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'InputNumber',
      componentProps: { class: 'w-full', min: 0 },
      fieldName: 'template_id',
      label: '模板 ID',
    },
    { component: 'Input', fieldName: 'code_prefix', label: '商品编码' },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        class: 'w-full',
        options: payItemTypeOptions,
      },
      fieldName: 'item_type',
      label: '业务类型',
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        class: 'w-full',
        options: subscriptionOptions,
      },
      fieldName: 'is_sub',
      label: '订阅',
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        class: 'w-full',
        options: enabledSelectOptions,
      },
      fieldName: 'enabled',
      label: '状态',
    },
  ];
}

function formatBackRules(row: PayItem) {
  const rules = row.ext_info?.fb_back ?? [];
  const fbRuleText =
    rules.length > 0
      ? rules
          .map(
            (rule) => `第${rule.seq_num}次 ${Number(rule.back_percent) / 100}%`,
          )
          .join('，')
      : '默认';
  const backFlags = [
    row.ext_info?.is_back ? '挽回项' : undefined,
    `回传${Number(row.back_percent ?? 10_000) / 100}%`,
    Number(row.back_amount_minor ?? 0) > 0
      ? `金额${formatMinorAmount(row.back_amount_minor, row.currency)}`
      : undefined,
    fbRuleText === '默认' ? undefined : fbRuleText,
  ].filter(Boolean);
  return backFlags.join(' / ') || '-';
}

function formatBusiness(row: PayItem) {
  if (row.item_type === 'res_item') {
    return `章节 × ${row.unlock_episode_count ?? 0}`;
  }
  if (row.item_type === 'res_total') return '整本解锁';
  if (row.item_type === 'vip') return '会员权益';
  return '余额资产';
}

export function useColumns(
  onEnabledChange?: (
    enabled: boolean,
    row: PayItem,
  ) => PromiseLike<boolean | undefined>,
): VxeTableGridColumns<PayItem> {
  return [
    { field: 'code', fixed: 'left', title: '商品编码', width: 160 },
    {
      field: 'title',
      minWidth: 200,
      slots: { default: 'titleCell' },
      title: '商品标题',
    },
    { field: 'template_id', sortable: true, title: '模板 ID', width: 100 },
    {
      cellRender: { name: 'CellTag', options: payItemTypeOptions },
      field: 'item_type',
      title: '业务类型',
      width: 110,
    },
    {
      field: 'unlock_episode_count',
      formatter: ({ row }) => formatBusiness(row),
      title: '权益语义',
      width: 110,
    },
    {
      cellRender: { name: 'CellTag', options: payPlatformOptions },
      field: 'platform',
      title: '平台',
      width: 100,
    },
    {
      cellRender: { name: 'CellTag', options: subscriptionOptions },
      field: 'is_sub',
      title: '订阅',
      width: 90,
    },
    {
      field: 'cycle_day',
      formatter: ({ row }) => (row.is_sub ? `${row.cycle_day} 天` : '-'),
      title: '周期',
      width: 90,
    },
    {
      field: 'amount_minor',
      formatter: ({ row }) => formatMinorAmount(row.amount_minor, row.currency),
      sortable: true,
      title: '价格',
      width: 130,
    },
    { field: 'currency', title: '币种', width: 90 },
    {
      field: 'back_percent',
      formatter: ({ row }) => formatBackRules(row),
      minWidth: 220,
      title: '回传/挽回',
    },
    {
      field: 'id',
      slots: { default: 'skuCell' },
      title: 'Provider SKU',
      width: 140,
    },
    {
      cellRender: {
        attrs: { beforeChange: onEnabledChange },
        name: onEnabledChange ? 'CellSwitch' : 'CellTag',
        props: { checkedValue: true, unCheckedValue: false },
      },
      field: 'enabled',
      title: '状态',
      width: 90,
    },
  ];
}

export const skuProviderOptions = [
  { label: 'Google Play', value: 'google' },
  { label: 'Apple IAP', value: 'ios' },
  { label: '海贝支付', value: 'haipay' },
  { label: '米花支付', value: 'mihua' },
];

export function useSkuColumns(
  onEnabledChange?: (
    enabled: boolean,
    row: PaySku,
  ) => PromiseLike<boolean | undefined>,
): VxeTableGridColumns<PaySku> {
  return [
    { field: 'provider', fixed: 'left', title: 'Provider', width: 120 },
    { field: 'product_id', minWidth: 180, title: 'SKU ID' },
    {
      field: 'product_name',
      minWidth: 180,
      slots: { default: 'skuNameCell' },
      title: 'SKU 名称',
    },
    { field: 'pay_item_id', title: '商品 ID', width: 100 },
    {
      cellRender: { name: 'CellTag', options: subscriptionOptions },
      field: 'subscription',
      title: '类型',
      width: 100,
    },
    {
      cellRender: {
        attrs: { beforeChange: onEnabledChange },
        name: onEnabledChange ? 'CellSwitch' : 'CellTag',
        props: { checkedValue: true, unCheckedValue: false },
      },
      field: 'enabled',
      title: '状态',
      width: 90,
    },
    {
      field: 'id',
      slots: { default: 'skuActionCell' },
      title: '操作',
      width: 90,
    },
  ];
}
