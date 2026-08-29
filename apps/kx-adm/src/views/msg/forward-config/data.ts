import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type { ForwardConfigDeviceView, RecordUrlMode } from '#/api/msg';

export const boolOptions = [
  { label: '有快照', value: true },
  { label: '无快照', value: false },
];

export const onlineOptions = [
  { label: '在线', value: 'online' },
  { label: '离线', value: 'offline' },
  { label: '未知', value: 'unknown' },
];

export const applyStatusOptions = [
  { label: '已发布', value: 'published' },
  { label: '发布中', value: 'publishing' },
  { label: '失败', value: 'failed' },
  { label: '已跳过', value: 'skipped' },
];

export function useFormSchema(): VbenFormSchema[] {
  return [
    { component: 'Input', fieldName: 'device_code_prefix', label: '设备编号' },
    {
      component: 'Select',
      componentProps: { allowClear: true, options: onlineOptions },
      fieldName: 'online_state',
      label: '在线状态',
    },
    { component: 'Input', fieldName: 'software_version', label: '软件版本' },
    {
      component: 'Select',
      componentProps: { allowClear: true, options: boolOptions },
      fieldName: 'has_snapshot',
      label: '配置快照',
    },
    {
      component: 'Select',
      componentProps: { allowClear: true, options: applyStatusOptions },
      fieldName: 'last_apply_status',
      label: '下发状态',
    },
  ];
}

export const recordModeOptions: Array<{ label: string; value: RecordUrlMode }> =
  [
    { label: '保留各设备原值', value: 'keep' },
    { label: '使用消息录音上传配置', value: 'use_voice_upload_config' },
    { label: '手工填写 URL', value: 'manual' },
    { label: '清空', value: 'clear' },
  ];

export const previewColumns = [
  { dataIndex: 'device_code', key: 'device_code', title: '设备', width: 120 },
  { dataIndex: 'status', key: 'status', title: '状态', width: 90 },
  {
    dataIndex: 'source_event_id',
    key: 'source_event_id',
    title: '快照',
    width: 100,
  },
  {
    dataIndex: 'diff_summary',
    key: 'diff_summary',
    title: '变更字段',
    width: 260,
  },
  { dataIndex: 'message', key: 'message', title: '说明', width: 260 },
];

export function useDeviceColumns(): VxeTableGridColumns<ForwardConfigDeviceView> {
  return [
    { type: 'checkbox', width: 46 },
    {
      field: 'device_code',
      sortable: true,
      fixed: 'left',
      slots: { default: 'deviceCode' },
      title: '设备编号',
      width: 140,
    },
    {
      field: 'online_state',
      sortable: true,
      slots: { default: 'onlineState' },
      title: '在线状态',
      width: 100,
    },
    {
      field: 'software_version',
      slots: { default: 'deviceValue' },
      title: '软件版本',
      width: 130,
    },
    {
      field: 'last_seen_at',
      sortable: true,
      slots: { default: 'lastSeenAt' },
      title: '最近上报',
      width: 170,
    },
    {
      field: 'snapshot_ready',
      slots: { default: 'snapshotReady' },
      title: '配置快照',
      width: 110,
    },
    {
      field: 'snapshot_received_at',
      sortable: true,
      slots: { default: 'snapshotAt' },
      title: '快照时间',
      width: 170,
    },
    {
      field: 'last_apply_status',
      slots: { default: 'applyStatus' },
      title: '最近下发',
      width: 110,
    },
    {
      field: 'last_apply_at',
      sortable: true,
      slots: { default: 'applyAt' },
      title: '下发时间',
      width: 170,
    },
    {
      field: 'actions',
      fixed: 'right',
      slots: { default: 'actions' },
      title: '操作',
      width: 120,
    },
  ];
}
