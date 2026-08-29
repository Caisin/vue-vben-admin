import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type { CallRecord } from '#/api/msg';

export function useFormSchema(): VbenFormSchema[] {
  return [
    { component: 'Input', fieldName: 'device_code', label: '设备编号' },
    { component: 'Input', fieldName: 'local_number_prefix', label: '本机号码' },
    { component: 'Input', fieldName: 'peer_number_prefix', label: '对方号码' },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: [{ label: '来电', value: '来电' }],
      },
      fieldName: 'call_state',
      label: '来电状态',
    },
    {
      component: 'RangePicker',
      componentProps: { showTime: true },
      fieldName: 'received_between',
      label: '来电时间',
    },
  ];
}

export function useColumns(): VxeTableGridColumns<CallRecord> {
  return [
    {
      field: 'received_at',
      sortable: true,
      fixed: 'left',
      slots: { default: 'receivedAt' },
      title: '来电时间',
      width: 180,
    },
    { field: 'device_code', sortable: true, title: '设备', width: 130 },
    { field: 'slot_code', title: '卡槽', width: 76 },
    { field: 'local_number', sortable: true, title: '本机号码', width: 170 },
    { field: 'peer_number', sortable: true, title: '对方号码', width: 170 },
    {
      field: 'call_state',
      sortable: true,
      slots: { default: 'callState' },
      title: '状态',
      width: 100,
    },
    { field: 'note', minWidth: 180, title: '备注' },
    {
      field: 'voice_media_id',
      slots: { default: 'recording' },
      title: '录音',
      width: 150,
    },
  ];
}
