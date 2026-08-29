import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type { DeviceEvent, DeviceEventFilterOptions } from '#/api/msg';

export const fallbackStatusOptions = [
  { label: '处理失败', value: 'failed' },
  { label: '已忽略', value: 'ignored' },
  { label: '已处理', value: 'processed' },
  { label: '发布中', value: 'publishing' },
  { label: '已发布', value: 'published' },
];

export const eventKindLabels: Record<string, string> = {
  command_ack: '指令成功',
  other: '其它消息',
  processing_error: '处理错误',
};

export function statusOptions(filterOptions: DeviceEventFilterOptions) {
  return filterOptions.process_statuses.length > 0
    ? filterOptions.process_statuses
    : fallbackStatusOptions;
}

export function eventKindOptions(filterOptions: DeviceEventFilterOptions) {
  return filterOptions.event_kinds;
}

export function eventKindLabel(eventKind: string) {
  return eventKindLabels[eventKind] ?? eventKind;
}

export function eventKindColor(eventKind: string) {
  if (eventKind === 'processing_error') return 'error';
  if (eventKind === 'other') return 'warning';
  if (eventKind.startsWith('command_')) return 'blue';
  return 'default';
}

export function useFormSchema(
  filterOptions: DeviceEventFilterOptions,
): VbenFormSchema[] {
  return [
    { component: 'Input', fieldName: 'device_code', label: '设备编号' },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: eventKindOptions(filterOptions),
        showSearch: true,
      },
      fieldName: 'event_kind',
      label: '事件类型',
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: statusOptions(filterOptions),
      },
      fieldName: 'process_status',
      label: '处理状态',
    },
  ];
}

export function formatPayload(payload: unknown) {
  if (typeof payload === 'string') return payload;
  return JSON.stringify(payload, null, 2);
}

export function useColumns(): VxeTableGridColumns<DeviceEvent> {
  return [
    {
      field: 'event_kind',
      sortable: true,
      slots: { default: 'eventKind' },
      title: '事件类型',
      width: 190,
    },
    {
      field: 'process_status',
      sortable: true,
      slots: { default: 'processStatus' },
      title: '处理状态',
      width: 110,
    },
    {
      field: 'device_code',
      sortable: true,
      slots: { default: 'deviceCode' },
      title: '设备',
      width: 130,
    },
    {
      field: 'received_at',
      sortable: true,
      slots: { default: 'receivedAt' },
      title: '接收时间',
      width: 180,
    },
    {
      field: 'error_message',
      minWidth: 420,
      slots: { default: 'errorMessage' },
      title: '错误摘要',
    },
    {
      field: 'actions',
      fixed: 'right',
      slots: { default: 'actions' },
      title: '操作',
      width: 90,
    },
  ];
}
