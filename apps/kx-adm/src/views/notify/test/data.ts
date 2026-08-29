import type { Ref } from 'vue';

import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type { NotifyMessage } from '#/api/notify';

export interface NotifySelectOption<T = number | string> {
  label: string;
  value: T;
}

export function useTestQuerySchema(
  channelOptions: Ref<NotifySelectOption[]>,
): VbenFormSchema[] {
  return [
    {
      component: 'Select',
      componentProps: () => ({
        allowClear: true,
        optionFilterProp: 'label',
        options: channelOptions.value,
        showSearch: true,
      }),
      fieldName: 'channel_id',
      label: '消息通道',
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: [
          { label: '排队中', value: 'queued' },
          { label: '执行中', value: 'running' },
          { label: '重试中', value: 'retry' },
          { label: '成功', value: 'succeeded' },
          { label: '失败', value: 'failed' },
          { label: '已取消', value: 'cancelled' },
        ],
      },
      fieldName: 'status',
      label: '状态',
    },
  ];
}

export function testMessageColumns(): VxeTableGridColumns<NotifyMessage> {
  return [
    {
      field: 'status',
      slots: { default: 'status' },
      title: '状态',
      width: 100,
    },
    {
      field: 'subject',
      minWidth: 220,
      slots: { default: 'subject' },
      title: '标题',
    },
    {
      field: 'channel_id',
      minWidth: 210,
      slots: { default: 'channel' },
      title: '消息通道',
    },
    { field: 'biz_id', minWidth: 160, title: '消息目标' },
    { field: 'attempt_count', title: '尝试', width: 80 },
    {
      field: 'created_at',
      slots: { default: 'createdAt' },
      sortable: true,
      title: '提交时间',
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
      width: 180,
    },
  ];
}
