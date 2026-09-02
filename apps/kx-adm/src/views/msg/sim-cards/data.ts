import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type { SimCardFilterOptions, SimCardView } from '#/api/msg';

export type QuickFilter =
  | 'all'
  | 'apple_developer'
  | 'arrears'
  | 'balance_warning'
  | 'device_has_empty_slot'
  | 'expired'
  | 'expiring'
  | 'has_phone'
  | 'low_balance'
  | 'missing_expiry'
  | 'missing_phone'
  | 'not_apple_developer';

const quickFilterOptions: Array<{ label: string; value: QuickFilter }> = [
  { label: '全部', value: 'all' },
  { label: '无号码', value: 'missing_phone' },
  { label: '有号码', value: 'has_phone' },
  { label: '设备有空卡槽', value: 'device_has_empty_slot' },
  { label: '欠费', value: 'arrears' },
  { label: '欠费 / 充值预警', value: 'balance_warning' },
  { label: '低余额', value: 'low_balance' },
  { label: '即将过期', value: 'expiring' },
  { label: '已过期', value: 'expired' },
  { label: '未知有效期', value: 'missing_expiry' },
  { label: '未注册苹果', value: 'not_apple_developer' },
  { label: '已注册苹果', value: 'apple_developer' },
];

function textSelectOptions(values: string[]) {
  return values.map((value) => ({ label: value, value }));
}

export function useFormSchema(
  filterOptions: SimCardFilterOptions,
): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      componentProps: {
        allowClear: true,
        placeholder: 'ICCID / IMSI / 号码 / 实名 / 设备 / 卡槽',
      },
      fieldName: 'keyword',
      label: '全文搜索',
    },
    {
      component: 'Select',
      componentProps: { allowClear: false, options: quickFilterOptions },
      defaultValue: 'all',
      fieldName: 'quick_filter',
      label: '快捷筛选',
    },
    {
      component: 'Input',
      defaultValue: '10',
      dependencies: {
        show: (values) => values.quick_filter === 'low_balance',
        triggerFields: ['quick_filter'],
      },
      fieldName: 'balance_lt',
      label: '余额低于',
    },
    {
      component: 'InputNumber',
      componentProps: { min: 0, precision: 0 },
      defaultValue: 30,
      dependencies: {
        show: (values) => values.quick_filter === 'expiring',
        triggerFields: ['quick_filter'],
      },
      fieldName: 'expires_within_days',
      label: '过期天数',
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: [
          { label: '在线', value: 'online' },
          { label: '离线', value: 'offline' },
        ],
      },
      fieldName: 'online_state',
      label: '在线状态',
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: textSelectOptions(filterOptions.slot_codes),
        showSearch: true,
      },
      fieldName: 'slot_code',
      label: '卡槽',
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: filterOptions.phone_regions,
      },
      fieldName: 'phone_region',
      label: '号码地区',
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: filterOptions.lifecycle_states,
      },
      fieldName: 'lifecycle_state',
      label: '生命周期',
    },
  ];
}

export const historyColumns = [
  { dataIndex: 'device_code', key: 'device_code', title: '设备', width: 120 },
  { dataIndex: 'slot_key', key: 'slot_key', title: '卡槽', width: 160 },
  {
    dataIndex: 'first_seen_at',
    key: 'first_seen_at',
    title: '首次发现',
    width: 180,
  },
  {
    dataIndex: 'last_seen_at',
    key: 'last_seen_at',
    title: '最近发现',
    width: 180,
  },
  { dataIndex: 'removed_at', key: 'removed_at', title: '离开时间', width: 180 },
];

export const messageColumns = [
  { dataIndex: 'direction', key: 'direction', title: '方向', width: 80 },
  {
    dataIndex: 'remote_number',
    key: 'remote_number',
    title: '对方号码',
    width: 150,
  },
  { dataIndex: 'content', key: 'content', title: '短信内容', width: 360 },
  {
    dataIndex: 'upstream_time',
    key: 'upstream_time',
    title: '设备时间',
    width: 180,
  },
  {
    dataIndex: 'received_at',
    key: 'received_at',
    title: '记录时间',
    width: 180,
  },
];

export function useCardColumns(): VxeTableGridColumns<SimCardView> {
  return [
    { fixed: 'left', type: 'checkbox', width: 44 },
    {
      field: 'iccid',
      sortable: true,
      fixed: 'left',
      slots: { default: 'iccid' },
      title: 'ICCID',
      width: 210,
    },
    {
      field: 'phone_number',
      sortable: true,
      slots: { default: 'phoneNumber' },
      title: '号码',
      width: 238,
    },
    {
      field: 'account_count',
      slots: { default: 'accounts' },
      title: '关联账号',
      width: 110,
    },
    {
      field: 'device_code',
      slots: { default: 'deviceLocation' },
      title: '设备 / 卡槽',
      width: 190,
    },
    {
      field: 'online_state',
      slots: { default: 'onlineState' },
      title: '在线状态',
      width: 100,
    },
    {
      field: 'apple_developer_registered',
      slots: { default: 'appleDeveloper' },
      title: '苹果开发者',
      width: 120,
    },
    {
      field: 'real_name',
      slots: { default: 'profileField' },
      title: '实名',
      width: 140,
    },
    {
      field: 'management_note',
      slots: { default: 'profileField' },
      title: '备注',
      width: 180,
    },
    {
      field: 'carrier',
      sortable: true,
      slots: { default: 'cardValue' },
      title: '运营商',
      width: 130,
    },
    {
      field: 'balance',
      slots: { default: 'balance' },
      title: '余额',
      width: 150,
    },
    {
      field: 'expires_at',
      sortable: true,
      slots: { default: 'expiresAt' },
      title: '卡片有效期',
      width: 180,
    },
    {
      field: 'lifecycle_state',
      slots: { default: 'lifecycleState' },
      title: '生命周期',
      width: 100,
    },
    {
      field: 'last_seen_at',
      sortable: true,
      slots: { default: 'lastSeenAt' },
      title: '最近发现',
      width: 180,
    },
  ];
}
