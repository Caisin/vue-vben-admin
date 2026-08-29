import type { Ref } from 'vue';

import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type {
  NotifyDeliveryStatus,
  NotifyMessage,
  NotifyMessagePriority,
  NotifyMessageStatus,
} from '#/api/notify';

export interface NotifyChannelOption {
  label: string;
  value: number | string;
}

export const messageStatusOptions: Array<{
  label: string;
  value: NotifyMessageStatus;
}> = [
  { label: '排队中', value: 'queued' },
  { label: '执行中', value: 'running' },
  { label: '重试中', value: 'retry' },
  { label: '成功', value: 'succeeded' },
  { label: '失败', value: 'failed' },
  { label: '已取消', value: 'cancelled' },
];

export const messagePriorityOptions: Array<{
  label: string;
  value: NotifyMessagePriority;
}> = [
  { label: '低', value: 'low' },
  { label: '普通', value: 'normal' },
  { label: '高', value: 'high' },
];

export const deliveryStatusOptions: Array<{
  label: string;
  value: NotifyDeliveryStatus;
}> = [
  { label: '执行中', value: 'running' },
  { label: '成功', value: 'succeeded' },
  { label: '失败', value: 'failed' },
];

export function useFormSchema(
  channelOptions: Ref<NotifyChannelOption[]>,
  includeChannel = true,
): VbenFormSchema[] {
  const channelSchema: VbenFormSchema = {
    component: 'Select',
    componentProps: () => ({
      allowClear: true,
      options: channelOptions.value,
      showSearch: true,
    }),
    fieldName: 'channel_id',
    label: '消息通道',
  };
  const schemas: VbenFormSchema[] = [
    {
      component: 'Select',
      componentProps: { allowClear: true, options: messageStatusOptions },
      fieldName: 'status',
      label: '状态',
    },
    {
      component: 'Select',
      componentProps: { allowClear: true, options: messagePriorityOptions },
      fieldName: 'priority',
      label: '优先级',
    },
    { component: 'Input', fieldName: 'biz_type', label: '业务类型' },
    { component: 'Input', fieldName: 'biz_id', label: '业务 ID' },
  ];
  return includeChannel ? [channelSchema, ...schemas] : schemas;
}

export function messageStatusLabel(value: NotifyMessageStatus) {
  return (
    messageStatusOptions.find((item) => item.value === value)?.label ?? value
  );
}

export function messageStatusColor(value: NotifyMessageStatus) {
  const colors: Record<NotifyMessageStatus, string> = {
    cancelled: 'default',
    failed: 'error',
    queued: 'warning',
    retry: 'processing',
    running: 'processing',
    succeeded: 'success',
  };
  return colors[value];
}

export function messagePriorityLabel(value: NotifyMessagePriority) {
  return (
    messagePriorityOptions.find((item) => item.value === value)?.label ?? value
  );
}

export function messageColumns(): VxeTableGridColumns<NotifyMessage> {
  return [
    { field: 'id', fixed: 'left', sortable: true, title: 'ID', width: 90 },
    {
      field: 'status',
      slots: { default: 'status' },
      title: '状态',
      width: 100,
    },
    {
      field: 'subject',
      fixed: 'left',
      minWidth: 220,
      slots: { default: 'subject' },
      title: '标题',
    },
    {
      field: 'channel_id',
      minWidth: 210,
      slots: { default: 'channel' },
      sortable: true,
      title: '消息通道',
    },
    {
      field: 'priority',
      slots: { default: 'priority' },
      title: '优先级',
      width: 90,
    },
    { field: 'biz_type', minWidth: 140, title: '业务类型' },
    { field: 'biz_id', minWidth: 140, title: '业务 ID' },
    { field: 'attempt_count', title: '尝试', width: 80 },
    {
      field: 'created_at',
      slots: { default: 'createdAt' },
      sortable: true,
      title: '创建时间',
      width: 180,
    },
    {
      field: 'sent_at',
      slots: { default: 'sentAt' },
      sortable: true,
      title: '发送时间',
      width: 180,
    },
    { field: 'last_error', minWidth: 260, title: '最近错误' },
    {
      field: 'operation',
      fixed: 'right',
      slots: { default: 'operation' },
      title: '操作',
      width: 250,
    },
  ];
}
