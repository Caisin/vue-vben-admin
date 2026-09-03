import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type { SimCardFilterOptions, SmsMessage } from '#/api/msg';

export type SenderMode = 'carrier' | 'numbers';

const directionOptions = [
  { label: '接收', value: 'inbound' },
  { label: '发送', value: 'outbound' },
];

function deviceOptions(filterOptions: SimCardFilterOptions) {
  return {
    allowClear: true,
    options: filterOptions.devices,
    showSearch: true,
  };
}

export function useMessageFormSchema(
  filterOptions: SimCardFilterOptions,
): VbenFormSchema[] {
  return [
    { component: 'SimCardSelect', fieldName: 'sim_iccid', label: '电话卡' },
    {
      component: 'Select',
      componentProps: deviceOptions(filterOptions),
      fieldName: 'device_code',
      label: '设备',
    },
    {
      component: 'Select',
      componentProps: { allowClear: true, options: directionOptions },
      fieldName: 'direction',
      label: '短信方向',
    },
    {
      component: 'RangePicker',
      componentProps: { showTime: true },
      fieldName: 'received_between',
      label: '接收时间',
    },
  ];
}

export function useMessageColumns(): VxeTableGridColumns<SmsMessage> {
  return [
    { type: 'checkbox', width: 44 },
    {
      field: 'direction',
      sortable: true,
      slots: { default: 'direction' },
      title: '方向',
      width: 90,
    },
    { field: 'sim_iccid', sortable: true, title: '电话卡 ICCID', width: 210 },
    {
      field: 'local_number',
      slots: { default: 'localNumber' },
      title: '本机号码',
      width: 160,
    },
    {
      field: 'device_code',
      sortable: true,
      slots: { default: 'deviceCode' },
      title: '设备',
      width: 110,
    },
    { field: 'remote_number', title: '对方号码', width: 160 },
    {
      field: 'content',
      showOverflow: 'tooltip',
      slots: { default: 'messageContent' },
      title: '短信内容',
      width: 360,
    },
    {
      field: 'received_at',
      sortable: true,
      slots: { default: 'receivedAt' },
      title: '记录时间',
      width: 180,
    },
    {
      field: 'actions',
      fixed: 'right',
      slots: { default: 'actions' },
      title: '操作',
      width: 96,
    },
  ];
}
