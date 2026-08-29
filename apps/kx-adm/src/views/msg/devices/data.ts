import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type { Device, DeviceCommand, DeviceFilterOptions } from '#/api/msg';

export const mqttSmsOptions = [
  { label: '开启短信 MQTT 转发', value: '开启' },
  { label: '关闭短信 MQTT 转发', value: '关闭' },
];

export const slotColumns = [
  { dataIndex: 'slot_code', key: 'slot_code', title: '卡槽', width: 70 },
  {
    dataIndex: 'current_sim_iccid',
    key: 'current_sim_iccid',
    title: 'ICCID',
    width: 190,
  },
  { dataIndex: 'phone_number', key: 'phone_number', title: '号码', width: 150 },
  { dataIndex: 'carrier', key: 'carrier', title: '运营商', width: 120 },
  { dataIndex: 'balance', key: 'balance', title: '余额', width: 110 },
  { dataIndex: 'expires_at', key: 'expires_at', title: '有效期', width: 180 },
  { dataIndex: 'rsrp', key: 'rsrp', title: '信号', width: 90 },
  {
    dataIndex: 'reported_status',
    key: 'reported_status',
    title: '状态',
    width: 100,
  },
  { key: 'actions', title: '卡片操作', width: 200, fixed: 'right' as const },
];

export const cardMessageColumns = [
  { dataIndex: 'direction', key: 'direction', title: '方向', width: 80 },
  {
    dataIndex: 'remote_number',
    key: 'remote_number',
    title: '对方号码',
    width: 150,
  },
  { dataIndex: 'content', key: 'content', title: '短信内容', width: 360 },
  { dataIndex: 'received_at', key: 'received_at', title: '时间', width: 180 },
];

export const operationColumns = [
  { dataIndex: 'command', key: 'command', title: '命令', width: 150 },
  { dataIndex: 'status', key: 'status', title: '状态', width: 100 },
  { dataIndex: 'created_at', key: 'created_at', title: '下发时间', width: 180 },
  {
    dataIndex: 'error_message',
    ellipsis: true,
    key: 'error_message',
    title: '错误',
    width: 240,
  },
  { key: 'actions', title: '操作', width: 60, fixed: 'right' as const },
];

export const commandLabels: Record<DeviceCommand | string, string> = {
  'refresh-card-status': '号码状态',
  'refresh-forward-config': '转发配置',
  'refresh-info': '设备信息',
  'refresh-mqtt-config': 'MQTT 配置',
  'refresh-system-config': '系统配置',
  restart: '重启系统',
  card_status: '号码状态',
  card_update: '修改卡参数',
  device_info: '设备信息',
  forward_config: '转发配置',
  mqtt_config: 'MQTT 配置',
  refresh_card_status: '号码状态',
  refresh_forward_config: '转发配置',
  refresh_info: '设备信息',
  refresh_mqtt_config: 'MQTT 配置',
  refresh_system_config: '系统配置',
  send_sms: '发送短信',
  system_config: '系统配置',
  update_forward_config: '修改转发配置',
  update_mqtt_config: '修改 MQTT 配置',
  update_system_config: '修改系统配置',
};

export function useFormSchema(
  filterOptions: DeviceFilterOptions,
): VbenFormSchema[] {
  const labels: Record<string, string> = {
    offline: '离线',
    online: '在线',
    unknown: '未知',
  };
  const states =
    filterOptions.online_states.length > 0
      ? filterOptions.online_states
      : ['online', 'offline', 'unknown'];
  const onlineOptions = states.map((value) => ({
    label: labels[value] ?? value,
    value,
  }));
  return [
    { component: 'Input', fieldName: 'device_code_prefix', label: '设备编号' },
    { component: 'Input', fieldName: 'phone_number', label: '卡槽号码' },
    {
      component: 'Select',
      componentProps: { allowClear: true, options: onlineOptions },
      fieldName: 'online_state',
      label: '在线状态',
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: filterOptions.software_versions.map((value) => ({
          label: value,
          value,
        })),
        showSearch: true,
      },
      fieldName: 'software_version',
      label: '软件版本',
    },
  ];
}

export function useDeviceColumns(): VxeTableGridColumns<Device> {
  return [
    {
      field: 'device_code',
      fixed: 'left',
      slots: { default: 'deviceCode' },
      sortable: true,
      title: '设备编号',
      width: 150,
    },
    {
      field: 'online_state',
      slots: { default: 'onlineState' },
      sortable: true,
      title: '在线状态',
      width: 100,
    },
    {
      field: 'slot_1_phone_number',
      slots: { default: 'slotPhoneNumber' },
      title: '卡槽 1 号码',
      width: 150,
    },
    {
      field: 'slot_2_phone_number',
      slots: { default: 'slotPhoneNumber' },
      title: '卡槽 2 号码',
      width: 150,
    },
    {
      field: 'sta_ip',
      slots: { default: 'deviceValue' },
      title: '局域网 IP',
      width: 140,
    },
    {
      field: 'mac',
      slots: { default: 'deviceValue' },
      title: 'MAC',
      width: 160,
    },
    {
      field: 'software_version',
      slots: { default: 'deviceValue' },
      title: '软件版本',
      width: 120,
    },
    {
      field: 'credential_ready',
      slots: { default: 'credentialReady' },
      title: '设备凭据',
      width: 100,
    },
    {
      field: 'last_seen_at',
      slots: { default: 'lastSeenAt' },
      sortable: true,
      title: '最近上报',
      width: 180,
    },
    {
      field: 'actions',
      fixed: 'right',
      slots: { default: 'actions' },
      title: '操作',
      width: 136,
    },
  ];
}
