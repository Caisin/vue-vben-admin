import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type {
  NotifyChannel,
  NotifyChannelStatus,
  NotifyChannelType,
} from '#/api/notify';

export const channelTypeOptions: Array<{
  label: string;
  value: NotifyChannelType;
}> = [
  { label: '钉钉自定义群机器人', value: 'dingtalk_custom_robot' },
  { label: '钉钉企业群机器人', value: 'dingtalk_group_bot' },
  { label: '邮件', value: 'email' },
  { label: 'Firebase 推送', value: 'push' },
  { label: '短信', value: 'sms' },
];

export const channelStatusOptions: Array<{
  label: string;
  value: NotifyChannelStatus;
}> = [
  { label: '启用', value: 'enabled' },
  { label: '停用', value: 'disabled' },
];

export function channelTypeLabel(value: NotifyChannelType) {
  return (
    channelTypeOptions.find((item) => item.value === value)?.label ?? value
  );
}

export function useFormSchema(): VbenFormSchema[] {
  return [
    { component: 'Input', fieldName: 'channel_code_prefix', label: '通道编码' },
    {
      component: 'Select',
      componentProps: { allowClear: true, options: channelTypeOptions },
      fieldName: 'channel_type',
      label: '通道类型',
    },
    {
      component: 'Select',
      componentProps: { allowClear: true, options: channelStatusOptions },
      fieldName: 'status',
      label: '状态',
    },
  ];
}

export function channelColumns(
  onStatusChange?: (
    status: NotifyChannelStatus,
    row: NotifyChannel,
  ) => PromiseLike<boolean | undefined>,
): VxeTableGridColumns<NotifyChannel> {
  return [
    { field: 'id', fixed: 'left', sortable: true, title: 'ID', width: 90 },
    {
      field: 'channel_name',
      fixed: 'left',
      minWidth: 180,
      slots: { default: 'channelName' },
      sortable: true,
      title: '通道名称',
    },
    { field: 'channel_code', minWidth: 200, sortable: true, title: '通道编码' },
    {
      field: 'channel_type',
      slots: { default: 'channelType' },
      title: '类型',
      width: 170,
    },
    { field: 'provider_code', minWidth: 190, title: 'Provider 配置' },
    {
      cellRender: {
        attrs: { beforeChange: onStatusChange },
        name: onStatusChange ? 'CellSwitch' : 'CellTag',
        props: { checkedValue: 'enabled', unCheckedValue: 'disabled' },
      },
      field: 'status',
      title: '状态',
      width: 90,
    },
    { field: 'rate_limit_per_minute', title: '每分钟限速', width: 120 },
    { field: 'max_retry_count', title: '最大重试', width: 100 },
    {
      field: 'updated_at',
      slots: { default: 'updatedAt' },
      sortable: true,
      title: '更新时间',
      width: 180,
    },
    { field: 'last_error', minWidth: 240, title: '最近错误' },
    {
      field: 'operation',
      fixed: 'right',
      slots: { default: 'operation' },
      title: '操作',
      width: 210,
    },
  ];
}
