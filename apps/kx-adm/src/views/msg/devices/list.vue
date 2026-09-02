<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type {
  Device,
  DeviceCommand,
  DeviceConfigKind,
  DeviceFilterOptions,
  DeviceOperation,
  DeviceOperationDetail,
  DeviceSlot,
  DeviceSlotView,
  SmsMessage,
} from '#/api/msg';

import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { useAccess } from '@vben/access';
import { Page } from '@vben/common-ui';
import {
  Copy,
  ExternalLink,
  Eye,
  Link2,
  MessageSquareCode,
  Pin,
  RotateCw,
  Settings,
} from '@vben/icons';

import {
  AutoComplete,
  Button,
  DatePicker,
  Descriptions,
  DescriptionsItem,
  Dropdown,
  Form,
  FormItem,
  Input,
  InputNumber,
  InputPassword,
  Menu,
  MenuItem,
  message,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  TextArea,
  Tooltip,
  TypographyParagraph,
} from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  DeviceApi,
  DeviceLocateError,
  MsgConfigApi,
  SimCardApi,
} from '#/api/msg';
import { JsonEditor } from '#/components/codemirror';
import { StatusTag } from '#/components/management';
import SimCardAccounts from '#/components/management/sim-card-accounts.vue';
import {
  createIdempotencyKey,
  displayValue,
  formatPaginationTotal,
} from '#/management';
import { Times } from '#/times';
import { vxeSortParams } from '#/vxe-sort';

import {
  cardMessageColumns,
  commandLabels,
  mqttSmsOptions,
  operationColumns,
  slotColumns,
  useDeviceColumns,
  useFormSchema,
} from './data';
import PopupDrawer from './modules/popup-drawer.vue';
import PopupModal from './modules/popup-modal.vue';

const actionLoading = ref('');
const filterOptions = ref<DeviceFilterOptions>({
  online_states: [],
  software_versions: [],
});
const drawerOpen = ref(false);
const drawerLoading = ref(false);
const selectedDevice = ref<Device | null>(null);
const slots = ref<DeviceSlotView[]>([]);
const operationsLoading = ref(false);
const operations = ref<DeviceOperation[]>([]);
const operationsPage = ref(1);
const operationsPageSize = ref(10);
const operationsTotal = ref(0);
const operationDrawerOpen = ref(false);
const operationDrawerLoading = ref(false);
const selectedOperation = ref<DeviceOperationDetail | null>(null);
const selectedSlot = ref<DeviceSlotView | null>(null);
const cardAccountsOpen = ref(false);
const cardMessagesOpen = ref(false);
const cardMessagesLoading = ref(false);
const cardMessages = ref<SmsMessage[]>([]);
const smsOpen = ref(false);
const smsSubmitting = ref(false);
const smsForm = reactive({ content: '', to: '' });
const balanceRefreshingIccid = ref('');
const balanceOpen = ref(false);
const balanceSubmitting = ref(false);
const balanceForm = reactive({ balance: '', balanceCurrency: 'CNY' });
const expiryOpen = ref(false);
const expirySubmitting = ref(false);
const expiryForm = reactive({ expiresAt: undefined as string | undefined });
const cardUpdateOpen = ref(false);
const cardUpdateSubmitting = ref(false);
const cardUpdateForm = reactive({
  call: '接听',
  lock_carrier: '自动',
  note: '',
  number: '',
});
const configEditorOpen = ref(false);
const configSubmitting = ref(false);
const configForm = reactive({
  json: '',
  kind: 'system_config' as DeviceConfigKind,
});
const systemConfigForm = reactive({
  DeviceID: '',
  Token: '',
  password: '',
  wifi: '',
});
const mqttConfigForm = reactive({
  mqtt_key: '',
  mqtt_password: '',
  mqtt_port: undefined as number | undefined,
  mqtt_server: '',
  mqtt_user: '',
  mqttsms: '开启',
  topic_prefix: '',
});
const otaOpen = ref(false);
const otaSubmitting = ref(false);
const otaForm = reactive({
  firmware_path: '3200/S2260711.bin',
  online_only: true,
  target_version: '',
});
const route = useRoute();
const router = useRouter();
const { hasAccessByCodes } = useAccess();
const canManageDevices = computed(() => hasAccessByCodes(['devices:manage']));
const canLocateDevice = computed(() => hasAccessByCodes(['devices:locate']));
const canManageSystemConfig = computed(() =>
  hasAccessByCodes(['devices:system-config']),
);
const canRunOta = computed(() => hasAccessByCodes(['devices:ota']));
const canViewPhoneAccounts = computed(() =>
  hasAccessByCodes(['phone_accounts:view']),
);
const deviceSortFields = ['device_code', 'online_state', 'last_seen_at'];

const [Grid, gridApi] = useVbenVxeGrid<Device>({
  formOptions: {
    schema: useFormSchema(filterOptions.value),
    submitOnChange: true,
  },
  gridOptions: {
    columns: useDeviceColumns(),
    height: 'auto',
    pagerConfig: { pageSize: 20, pageSizes: [10, 20, 50, 100] },
    proxyConfig: {
      autoLoad: false,
      ajax: {
        query: async (params, formValues) => {
          const { page } = params;
          const result = await DeviceApi.list({
            device_code_prefix:
              String(formValues.device_code_prefix ?? '').trim() || undefined,
            online_state:
              String(formValues.online_state ?? '').trim() || undefined,
            page: page.currentPage,
            phone_number:
              String(formValues.phone_number ?? '').trim() || undefined,
            size: page.pageSize,
            ...vxeSortParams(params, deviceSortFields),
            software_version:
              String(formValues.software_version ?? '').trim() || undefined,
          });
          return { items: result.items, total: result.total };
        },
      },
    },
    rowConfig: { keyField: 'device_code' },
    sortConfig: { remote: true },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<Device>,
});

const configEditorTitle = computed(() => {
  const deviceCode = selectedDevice.value?.device_code;
  const label = commandLabels[configForm.kind] ?? '设备配置';
  return deviceCode ? `${label}：${deviceCode}` : label;
});

function deviceSlotPhoneNumber(device: Device, field: unknown) {
  if (field === 'slot_1_phone_number') return device.slot_1_phone_number;
  if (field === 'slot_2_phone_number') return device.slot_2_phone_number;
  return '';
}

function deviceDisplay(device: Device, key: unknown) {
  switch (String(key)) {
    case 'mac': {
      return displayValue(device.mac);
    }
    case 'software_version': {
      return displayValue(device.software_version);
    }
    case 'sta_ip': {
      return displayValue(device.sta_ip);
    }
    default: {
      return '未知';
    }
  }
}

function slotDisplay(slot: DeviceSlot, key: unknown) {
  switch (String(key)) {
    case 'carrier': {
      return displayValue(slot.carrier);
    }
    case 'current_sim_iccid': {
      return displayValue(slot.current_sim_iccid);
    }
    case 'phone_number': {
      return displayValue(slot.phone_number);
    }
    case 'reported_status': {
      return displayValue(slot.reported_status);
    }
    case 'rsrp': {
      return displayValue(slot.rsrp);
    }
    default: {
      return '未知';
    }
  }
}

function slotHasCard(slot: DeviceSlot) {
  return Boolean(slot.current_sim_iccid.trim());
}

async function openCardMessages(slot: DeviceSlotView) {
  if (!slotHasCard(slot)) return;
  selectedSlot.value = slot;
  cardMessagesOpen.value = true;
  cardMessagesLoading.value = true;
  try {
    cardMessages.value = await SimCardApi.messages(slot.current_sim_iccid);
  } finally {
    cardMessagesLoading.value = false;
  }
}

function openSlotSms(slot: DeviceSlotView) {
  if (!slotHasCard(slot)) return;
  selectedSlot.value = slot;
  smsForm.to = '';
  smsForm.content = '';
  smsOpen.value = true;
}

function openSlotAccounts(slot: DeviceSlotView) {
  if (!slotHasCard(slot) || !slot.phone_number.trim()) return;
  selectedSlot.value = slot;
  cardAccountsOpen.value = true;
}

async function submitSlotSms() {
  const slot = selectedSlot.value;
  if (!slot || !smsForm.to.trim() || !smsForm.content.trim()) {
    message.warning('请填写目标号码和短信内容');
    return;
  }
  smsSubmitting.value = true;
  try {
    const result = await SimCardApi.sendSms(slot.current_sim_iccid, {
      content: smsForm.content.trim(),
      idempotency_key: createIdempotencyKey(),
      target_number: smsForm.to.trim(),
    });
    message.success(`短信任务 ${result.job_key} 已受理`);
    smsOpen.value = false;
  } finally {
    smsSubmitting.value = false;
  }
}

async function refreshSlotBalance(slot: DeviceSlot) {
  if (!slotHasCard(slot)) return;
  balanceRefreshingIccid.value = slot.current_sim_iccid;
  try {
    const result = await SimCardApi.refreshBalance(slot.current_sim_iccid);
    message.success(`余额查询任务 ${result.job_key} 已受理`);
  } finally {
    balanceRefreshingIccid.value = '';
  }
}

function openSlotBalance(slot: DeviceSlotView) {
  if (!slotHasCard(slot)) return;
  selectedSlot.value = slot;
  balanceForm.balance = slot.balance;
  balanceForm.balanceCurrency =
    slot.balance_currency ||
    (slot.phone_number.startsWith('+852') ? 'HKD' : 'CNY');
  balanceOpen.value = true;
}

async function submitSlotBalance() {
  const slot = selectedSlot.value;
  if (!slot || !balanceForm.balance.trim()) {
    message.warning('请填写余额');
    return;
  }
  balanceSubmitting.value = true;
  try {
    const updated = await SimCardApi.updateBalance(slot.current_sim_iccid, {
      balance: balanceForm.balance.trim(),
      balance_currency: balanceForm.balanceCurrency,
    });
    slot.balance = updated.balance;
    slot.balance_currency = updated.balance_currency;
    message.success('余额已更新');
    balanceOpen.value = false;
  } finally {
    balanceSubmitting.value = false;
  }
}

function openSlotExpiry(slot: DeviceSlotView) {
  if (!slotHasCard(slot)) return;
  selectedSlot.value = slot;
  expiryForm.expiresAt =
    slot.expires_at > 0 ? String(slot.expires_at) : undefined;
  expiryOpen.value = true;
}

async function submitSlotExpiry() {
  const slot = selectedSlot.value;
  const expiresAt = Number(expiryForm.expiresAt);
  if (!slot || !Number.isSafeInteger(expiresAt) || expiresAt <= 0) {
    message.warning('请选择有效期');
    return;
  }
  expirySubmitting.value = true;
  try {
    const updated = await SimCardApi.updateExpiry(slot.current_sim_iccid, {
      expires_at: expiresAt,
    });
    slot.expires_at = updated.expires_at;
    message.success('卡片有效期已更新');
    expiryOpen.value = false;
  } finally {
    expirySubmitting.value = false;
  }
}

function lockCarrierOptions(slot?: DeviceSlotView | null) {
  return ['自动', slot?.lock_carrier]
    .filter((value): value is string => Boolean(value?.trim()))
    .map((value) => value.trim())
    .filter((value, index, values) => values.indexOf(value) === index)
    .map((value) => ({ label: value, value }));
}

function openSlotUpdate(slot: DeviceSlotView) {
  if (!slotHasCard(slot)) return;
  selectedSlot.value = slot;
  cardUpdateForm.call = ['挂断', '接听', '无操作'].includes(slot.call_state)
    ? slot.call_state
    : '接听';
  cardUpdateForm.lock_carrier = '自动';
  cardUpdateForm.note = '';
  cardUpdateForm.number = slot.phone_number;
  cardUpdateOpen.value = true;
}

async function submitSlotUpdate() {
  const slot = selectedSlot.value;
  if (!slot || !cardUpdateForm.number.trim()) {
    message.warning('请填写本机号码');
    return;
  }
  cardUpdateSubmitting.value = true;
  try {
    await SimCardApi.updateDevice(slot.current_sim_iccid, {
      call: cardUpdateForm.call,
      lock_carrier: cardUpdateForm.lock_carrier.trim(),
      note: cardUpdateForm.note.trim(),
      number: cardUpdateForm.number.trim(),
    });
    message.success('设备卡片配置已受理');
    cardUpdateOpen.value = false;
    if (selectedDevice.value) {
      operationsPage.value = 1;
      await loadOperations(selectedDevice.value.device_code);
    }
  } finally {
    cardUpdateSubmitting.value = false;
  }
}

function deviceBackendUrl(device: Device) {
  const value = device.base_url.trim();
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}

async function openDevice(deviceCode: string) {
  drawerOpen.value = true;
  drawerLoading.value = true;
  if (selectedDevice.value?.device_code !== deviceCode) {
    operationsPage.value = 1;
  }
  try {
    const [device, deviceSlots, operationPage] = await Promise.all([
      DeviceApi.detail(deviceCode),
      DeviceApi.slots(deviceCode),
      DeviceApi.operations(deviceCode, {
        page: operationsPage.value,
        size: operationsPageSize.value,
      }),
    ]);
    selectedDevice.value = device;
    slots.value = deviceSlots;
    operations.value = operationPage.items;
    operationsTotal.value = operationPage.total;
  } finally {
    drawerLoading.value = false;
  }
}

async function loadOperations(deviceCode: string) {
  operationsLoading.value = true;
  try {
    const result = await DeviceApi.operations(deviceCode, {
      page: operationsPage.value,
      size: operationsPageSize.value,
    });
    operations.value = result.items;
    operationsTotal.value = result.total;
  } finally {
    operationsLoading.value = false;
  }
}

function handleOperationsTable(pagination: {
  current?: number;
  pageSize?: number;
}) {
  if (!selectedDevice.value) return;
  operationsPage.value = pagination.current ?? 1;
  operationsPageSize.value = pagination.pageSize ?? 10;
  loadOperations(selectedDevice.value.device_code);
}

async function openOperation(operation: DeviceOperation) {
  operationDrawerOpen.value = true;
  operationDrawerLoading.value = true;
  try {
    selectedOperation.value = await DeviceApi.operationDetail(
      operation.device_code,
      operation.id,
    );
  } finally {
    operationDrawerLoading.value = false;
  }
}

async function copyOperationValue(label: string, value: string) {
  await navigator.clipboard.writeText(value);
  message.success(`${label}已复制`);
}

function formatJsonValue(value: unknown) {
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2);
}

async function copyOperationPayload(value: unknown) {
  await copyOperationValue('MQTT Payload', formatJsonValue(value));
}

async function executeDeviceCommand(command: DeviceCommand) {
  const device = selectedDevice.value;
  if (!device) return;
  actionLoading.value = `${device.device_code}:${command}`;
  try {
    await DeviceApi.sendCommand(device.device_code, command);
    message.success(`${commandLabels[command]}指令已发布`);
    operationsPage.value = 1;
    await Promise.all([loadOperations(device.device_code), gridApi.query()]);
  } finally {
    actionLoading.value = '';
  }
}

function handleCommandMenu({ key }: { key: string }) {
  const updateKinds: Record<string, DeviceConfigKind> = {
    'update-mqtt-config': 'mqtt_config',
    'update-system-config': 'system_config',
  };
  if (key === 'open-forward-config') {
    void openForwardConfigPage();
    return;
  }
  if (updateKinds[key]) {
    void openConfigEditor(updateKinds[key]);
    return;
  }
  const command = key as DeviceCommand;
  if (command === 'restart') {
    Modal.confirm({
      content: '设备会立即重启并短暂离线。',
      okButtonProps: { danger: true },
      okText: '重启系统',
      title: '确认重启设备',
      onOk: () => executeDeviceCommand(command),
    });
    return;
  }
  executeDeviceCommand(command);
}

async function openForwardConfigPage() {
  const deviceCode = selectedDevice.value?.device_code;
  await router.push({
    path: '/msg/forward-config',
    query: deviceCode ? { device_code: deviceCode } : undefined,
  });
}

function forwardConfigTemplate() {
  return {
    http_post: [],
    record_url: '',
    robot: { body: '', url: {} },
    tts_txt: '',
  };
}

function resetSystemConfigForm() {
  Object.assign(systemConfigForm, {
    DeviceID: selectedDevice.value?.device_code ?? '',
    Token: '',
    password: '',
    wifi: selectedDevice.value?.wifi ?? '',
  });
}

function resetMqttConfigForm() {
  Object.assign(mqttConfigForm, {
    mqtt_key: '',
    mqtt_password: '',
    mqtt_port: undefined,
    mqtt_server: '',
    mqtt_user: '',
    mqttsms: '开启',
    topic_prefix: '',
  });
}

function resetConfigForm(kind: DeviceConfigKind) {
  configForm.kind = kind;
  if (kind === 'system_config') {
    resetSystemConfigForm();
    return;
  }
  if (kind === 'mqtt_config') {
    resetMqttConfigForm();
    return;
  }
  configForm.json = JSON.stringify(forwardConfigTemplate(), null, 2);
}

async function applyCurrentMqttDefaults() {
  try {
    const value = await MsgConfigApi.s2();
    if (configForm.kind !== 'mqtt_config') return;
    Object.assign(mqttConfigForm, {
      mqtt_port: value.mqtt_port || undefined,
      mqtt_server: value.mqtt_host,
      mqtt_user: value.mqtt_username,
      topic_prefix: value.topic_prefix,
    });
  } catch {
    // 读取平台 MQTT 配置失败不阻塞手工填写设备 MQTT 配置。
  }
}

async function openConfigEditor(kind: DeviceConfigKind) {
  resetConfigForm(kind);
  configEditorOpen.value = true;
  if (kind === 'mqtt_config') await applyCurrentMqttDefaults();
}

async function handleConfigKindChange(kind: DeviceConfigKind) {
  resetConfigForm(kind);
  if (kind === 'mqtt_config') await applyCurrentMqttDefaults();
}

function requireConfigFields(
  payload: Record<string, unknown>,
  fields: Array<[string, string]>,
) {
  const empty = fields.find(([key]) => !String(payload[key] ?? '').trim());
  if (!empty) return true;
  message.warning(`请填写${empty[1]}`);
  return false;
}

function buildConfigPayload() {
  if (configForm.kind === 'system_config') {
    const payload = {
      DeviceID: systemConfigForm.DeviceID.trim(),
      Token: systemConfigForm.Token.trim(),
      password: systemConfigForm.password.trim(),
      wifi: systemConfigForm.wifi.trim(),
    };
    return requireConfigFields(payload, [
      ['DeviceID', '设备编号'],
      ['Token', '系统 Token'],
      ['wifi', 'Wi-Fi 名称'],
      ['password', 'Wi-Fi 密码'],
    ])
      ? payload
      : undefined;
  }
  if (configForm.kind === 'mqtt_config') {
    const payload = {
      mqtt_key: mqttConfigForm.mqtt_key.trim(),
      mqtt_password: mqttConfigForm.mqtt_password.trim(),
      mqtt_port: String(mqttConfigForm.mqtt_port ?? '').trim(),
      mqtt_server: mqttConfigForm.mqtt_server.trim(),
      mqtt_user: mqttConfigForm.mqtt_user.trim(),
      mqttsms: mqttConfigForm.mqttsms,
      topic_prefix: mqttConfigForm.topic_prefix
        .trim()
        .replaceAll(/^\/+|\/+$/g, ''),
    };
    return requireConfigFields(payload, [
      ['mqtt_server', 'MQTT 主机'],
      ['mqtt_port', 'MQTT 端口'],
      ['mqttsms', '短信转发开关'],
      ['topic_prefix', 'Topic 前缀'],
    ])
      ? payload
      : undefined;
  }
  try {
    return JSON.parse(configForm.json) as unknown;
  } catch {
    message.warning('配置内容不是有效 JSON');
    return undefined;
  }
}

async function submitConfig() {
  const device = selectedDevice.value;
  if (!device) return;
  const payload = buildConfigPayload();
  if (payload === undefined) return;
  configSubmitting.value = true;
  try {
    await DeviceApi.updateConfig(device.device_code, configForm.kind, payload);
    message.success('设备配置已发布');
    configEditorOpen.value = false;
    operationsPage.value = 1;
    await loadOperations(device.device_code);
  } finally {
    configSubmitting.value = false;
  }
}

function operationStatusColor(status: string) {
  if (status === 'published') return 'success';
  if (status === 'failed') return 'error';
  return 'processing';
}

async function refreshAll(kind: 'all' | 'cards' | 'devices' | 'system-config') {
  actionLoading.value = kind;
  try {
    if (kind === 'all') await DeviceApi.refreshAll();
    if (kind === 'cards') await DeviceApi.refreshCardStatus();
    if (kind === 'devices') await DeviceApi.refreshInfo();
    if (kind === 'system-config') {
      await DeviceApi.refreshSystemConfigAll();
      message.success('系统配置同步后台任务已提交');
      return;
    }
    message.success('刷新指令已受理');
  } finally {
    actionLoading.value = '';
  }
}

function inferOtaTargetVersion(path: string) {
  const name = path.trim().split(/[\\/]/).pop() ?? '';
  const dot = name.lastIndexOf('.');
  return (dot > 0 ? name.slice(0, dot) : name).trim();
}

function openOtaBatch() {
  if (!otaForm.target_version.trim()) {
    otaForm.target_version = inferOtaTargetVersion(otaForm.firmware_path);
  }
  otaOpen.value = true;
}

async function submitOtaBatch() {
  const firmwarePath = otaForm.firmware_path.trim();
  if (!firmwarePath) {
    message.warning('请填写固件路径');
    return;
  }
  otaSubmitting.value = true;
  try {
    await DeviceApi.batchOta({
      firmware_path: firmwarePath,
      online_only: otaForm.online_only,
      target_version:
        otaForm.target_version.trim() || inferOtaTargetVersion(firmwarePath),
    });
    message.success('批量版本升级后台任务已提交');
    otaOpen.value = false;
  } finally {
    otaSubmitting.value = false;
  }
}

async function locateDeviceHttp(device: Device) {
  if (device.online_state !== 'online') {
    message.warning('设备不在线，无法直连定位');
    return;
  }
  actionLoading.value = `${device.device_code}:locate`;
  try {
    const result = await DeviceApi.locateByHttp(device.device_code);
    message.success(result.message || '定位命令已发送');
  } catch (error) {
    if (error instanceof DeviceLocateError) message.error(error.message);
  } finally {
    actionLoading.value = '';
  }
}

async function runDeviceAction(device: Device, kind: 'locate' | 'sync') {
  if (kind === 'locate') {
    await locateDeviceHttp(device);
    return;
  }
  actionLoading.value = `${device.device_code}:${kind}`;
  try {
    await DeviceApi.sync(device.device_code);
    message.success('号码状态刷新已受理');
    if (drawerOpen.value) await openDevice(device.device_code);
    await gridApi.query();
  } finally {
    actionLoading.value = '';
  }
}

function firstQueryValue(value: unknown) {
  return Array.isArray(value) ? value[0] : value;
}

function queryString(key: string) {
  const value = firstQueryValue(route.query[key]);
  return typeof value === 'string' && value.trim() ? value : undefined;
}

async function loadInitialDevices() {
  const deviceCode = queryString('device_code');
  const onlineState = queryString('online_state');
  const phoneNumber = queryString('phone_number');
  const softwareVersion = queryString('software_version');
  const options = await DeviceApi.filterOptions();
  filterOptions.value = {
    online_states: options.online_states ?? [],
    software_versions: options.software_versions ?? [],
  };
  await gridApi.formApi.updateSchema(useFormSchema(filterOptions.value));
  await gridApi.formApi.setValues({
    device_code_prefix: deviceCode,
    online_state: onlineState,
    phone_number: phoneNumber,
    software_version: softwareVersion,
  });
  await gridApi.query();
  if (deviceCode && route.query.open === '1') {
    await openDevice(deviceCode);
  }
}

onMounted(loadInitialDevices);
</script>

<template>
  <Page
    auto-content-height
    class="management-page"
    content-class="management-content"
  >
    <header class="page-heading">
      <div>
        <h1>设备管理</h1>
        <p>查看在线状态、卡槽位置并执行设备操作</p>
      </div>
      <Space wrap>
        <Button
          v-if="canManageDevices"
          :loading="actionLoading === 'devices'"
          @click="refreshAll('devices')"
        >
          刷新设备信息
        </Button>
        <Button
          v-if="canManageDevices"
          :loading="actionLoading === 'cards'"
          @click="refreshAll('cards')"
        >
          刷新号码状态
        </Button>
        <Button
          v-if="canManageSystemConfig"
          :loading="actionLoading === 'system-config'"
          @click="refreshAll('system-config')"
        >
          同步系统配置
        </Button>
        <Button
          v-if="canManageDevices"
          :loading="actionLoading === 'all'"
          type="primary"
          @click="refreshAll('all')"
        >
          <template #icon><RotateCw /></template>完整刷新
        </Button>
        <Button v-if="canRunOta" @click="openOtaBatch"> 批量版本升级 </Button>
      </Space>
    </header>

    <Grid class="management-grid" table-title="设备">
      <template #deviceCode="{ row }">
        <Tooltip title="查看设备详情">
          <Button
            class="cell-edit-button"
            type="link"
            @click="openDevice(row.device_code)"
          >
            {{ row.device_code }}
          </Button>
        </Tooltip>
      </template>
      <template #slotPhoneNumber="{ column, row }">
        {{ displayValue(deviceSlotPhoneNumber(row, column.field)) }}
      </template>
      <template #onlineState="{ row }">
        <StatusTag :status="row.online_state" />
      </template>
      <template #deviceValue="{ column, row }">
        {{ deviceDisplay(row, column.field) }}
      </template>
      <template #credentialReady="{ row }">
        <Tag :color="row.credential_ready ? 'success' : 'warning'">
          {{ row.credential_ready ? '已就绪' : '待获取' }}
        </Tag>
      </template>
      <template #lastSeenAt="{ row }">
        {{ Times.formatUnix(row.last_seen_at) }}
      </template>
      <template #actions="{ row }">
        <Space size="small">
          <Tooltip title="设备后台">
            <Button
              aria-label="设备后台"
              size="small"
              type="link"
              :disabled="!deviceBackendUrl(row)"
              :href="deviceBackendUrl(row)"
              target="_blank"
              rel="noopener noreferrer"
            >
              <template #icon><ExternalLink /></template>
            </Button>
          </Tooltip>
          <Tooltip v-if="canManageDevices" title="同步">
            <Button
              aria-label="同步"
              size="small"
              type="link"
              :loading="actionLoading === `${row.device_code}:sync`"
              @click="runDeviceAction(row, 'sync')"
            >
              <template #icon><RotateCw /></template>
            </Button>
          </Tooltip>
          <Tooltip v-if="canLocateDevice" title="定位">
            <Button
              aria-label="定位"
              size="small"
              type="link"
              :disabled="row.online_state !== 'online'"
              :loading="actionLoading === `${row.device_code}:locate`"
              @click="runDeviceAction(row, 'locate')"
            >
              <template #icon><Pin /></template>
            </Button>
          </Tooltip>
        </Space>
      </template>
    </Grid>

    <PopupDrawer
      v-model:open="drawerOpen"
      :loading="drawerLoading"
      placement="right"
      size="min(1120px, 100vw)"
      title="设备详情"
    >
      <template v-if="selectedDevice">
        <div class="drawer-actions">
          <StatusTag :status="selectedDevice.online_state" />
          <Space wrap>
            <Button
              :disabled="!deviceBackendUrl(selectedDevice)"
              :href="deviceBackendUrl(selectedDevice)"
              target="_blank"
              rel="noopener noreferrer"
            >
              <template #icon><ExternalLink /></template>设备后台
            </Button>
            <Button
              v-if="canManageDevices"
              :loading="actionLoading === `${selectedDevice.device_code}:sync`"
              @click="runDeviceAction(selectedDevice, 'sync')"
            >
              <template #icon><RotateCw /></template>同步号码
            </Button>
            <Button
              v-if="canLocateDevice"
              :disabled="selectedDevice.online_state !== 'online'"
              :loading="
                actionLoading === `${selectedDevice.device_code}:locate`
              "
              @click="runDeviceAction(selectedDevice, 'locate')"
            >
              <template #icon><Pin /></template>定位设备
            </Button>
            <Dropdown v-if="canManageDevices || canManageSystemConfig">
              <Button
                :disabled="selectedDevice.online_state !== 'online'"
                :loading="
                  actionLoading.startsWith(
                    `${selectedDevice.device_code}:refresh`,
                  ) || actionLoading === `${selectedDevice.device_code}:restart`
                "
              >
                <template #icon><Settings /></template>设备指令
              </Button>
              <template #popupRender>
                <Menu @click="handleCommandMenu">
                  <MenuItem key="refresh-info">设备信息</MenuItem>
                  <MenuItem key="refresh-card-status">号码状态</MenuItem>
                  <MenuItem
                    v-if="canManageSystemConfig"
                    key="refresh-system-config"
                  >
                    系统配置
                  </MenuItem>
                  <MenuItem key="refresh-mqtt-config">MQTT 配置</MenuItem>
                  <MenuItem key="refresh-forward-config">转发配置</MenuItem>
                  <MenuItem key="update-system-config">修改系统配置</MenuItem>
                  <MenuItem key="update-mqtt-config">修改 MQTT 配置</MenuItem>
                  <MenuItem key="open-forward-config">打开转发配置</MenuItem>
                  <MenuItem danger key="restart">重启系统</MenuItem>
                </Menu>
              </template>
            </Dropdown>
          </Space>
        </div>
        <Descriptions :column="{ xs: 1, sm: 2 }" bordered size="small">
          <DescriptionsItem label="设备编号">
            {{ selectedDevice.device_code }}
          </DescriptionsItem>
          <DescriptionsItem label="UID">
            {{ displayValue(selectedDevice.uid) }}
          </DescriptionsItem>
          <DescriptionsItem label="局域网 IP">
            {{ displayValue(selectedDevice.sta_ip) }}
          </DescriptionsItem>
          <DescriptionsItem label="MAC">
            {{ displayValue(selectedDevice.mac) }}
          </DescriptionsItem>
          <DescriptionsItem label="HTTP 地址">
            {{ displayValue(selectedDevice.base_url) }}
          </DescriptionsItem>
          <DescriptionsItem label="设备凭据">
            {{ selectedDevice.credential_ready ? '已就绪' : '待获取' }}
          </DescriptionsItem>
          <DescriptionsItem label="硬件版本">
            {{ displayValue(selectedDevice.hardware_version) }}
          </DescriptionsItem>
          <DescriptionsItem label="软件版本">
            {{ displayValue(selectedDevice.software_version) }}
          </DescriptionsItem>
          <DescriptionsItem label="Wi-Fi">
            {{ displayValue(selectedDevice.wifi) }}
          </DescriptionsItem>
          <DescriptionsItem label="原始状态">
            {{ displayValue(selectedDevice.reported_status) }}
          </DescriptionsItem>
          <DescriptionsItem label="最近上报">
            {{ Times.formatUnix(selectedDevice.last_seen_at) }}
          </DescriptionsItem>
          <DescriptionsItem label="更新时间">
            {{ Times.formatUnix(selectedDevice.updated_at) }}
          </DescriptionsItem>
        </Descriptions>

        <h2 class="drawer-section-title">卡槽</h2>
        <Table
          :columns="slotColumns"
          :data-source="slots"
          :pagination="false"
          row-key="slot_key"
          :scroll="{ x: 1270 }"
          size="small"
        >
          <template #bodyCell="{ column, record }">
            <span
              v-if="
                [
                  'current_sim_iccid',
                  'phone_number',
                  'carrier',
                  'rsrp',
                  'reported_status',
                ].includes(String(column.key))
              "
            >
              {{ slotDisplay(record, column.key) }}
            </span>
            <Tooltip v-else-if="column.key === 'balance'" title="点击修改余额">
              <Button
                v-if="canManageDevices && slotHasCard(record)"
                class="cell-edit-button"
                type="link"
                @click="openSlotBalance(record)"
              >
                {{
                  record.balance
                    ? `${record.balance_currency || ''} ${record.balance}`
                    : '未知'
                }}
              </Button>
              <span v-else>
                {{
                  record.balance
                    ? `${record.balance_currency || ''} ${record.balance}`
                    : '未知'
                }}
              </span>
            </Tooltip>
            <Tooltip
              v-else-if="column.key === 'expires_at'"
              title="点击修改有效期"
            >
              <Button
                v-if="canManageDevices && slotHasCard(record)"
                class="cell-edit-button"
                type="link"
                @click="openSlotExpiry(record)"
              >
                {{ Times.formatUnix(record.expires_at) }}
              </Button>
              <span v-else>{{ Times.formatUnix(record.expires_at) }}</span>
            </Tooltip>
            <Space
              v-else-if="column.key === 'actions' && slotHasCard(record)"
              size="small"
            >
              <Tooltip title="短信记录">
                <Button
                  aria-label="短信记录"
                  size="small"
                  type="link"
                  @click="openCardMessages(record)"
                >
                  <template #icon><Eye /></template>
                </Button>
              </Tooltip>
              <Tooltip v-if="canManageDevices" title="发短信">
                <Button
                  aria-label="发短信"
                  size="small"
                  type="link"
                  @click="openSlotSms(record)"
                >
                  <template #icon><MessageSquareCode /></template>
                </Button>
              </Tooltip>
              <Tooltip v-if="canManageDevices" title="查余额">
                <Button
                  aria-label="查余额"
                  :loading="balanceRefreshingIccid === record.current_sim_iccid"
                  size="small"
                  type="link"
                  @click="refreshSlotBalance(record)"
                >
                  <template #icon><RotateCw /></template>
                </Button>
              </Tooltip>
              <Tooltip v-if="canManageDevices" title="设备配置">
                <Button
                  aria-label="设备配置"
                  size="small"
                  type="link"
                  @click="openSlotUpdate(record)"
                >
                  <template #icon><Settings /></template>
                </Button>
              </Tooltip>
              <Tooltip
                v-if="record.phone_number.trim() && canViewPhoneAccounts"
                title="关联账号"
              >
                <Button
                  aria-label="关联账号"
                  size="small"
                  type="link"
                  @click="openSlotAccounts(record)"
                >
                  <template #icon><Link2 /></template>
                </Button>
              </Tooltip>
            </Space>
            <span v-else-if="column.key === 'actions'" class="muted">
              空卡槽
            </span>
          </template>
        </Table>

        <h2 class="drawer-section-title">操作记录</h2>
        <Table
          :columns="operationColumns"
          :data-source="operations"
          :loading="operationsLoading"
          :pagination="{
            current: operationsPage,
            pageSize: operationsPageSize,
            total: operationsTotal,
            showSizeChanger: true,
            showTotal: formatPaginationTotal,
          }"
          row-key="id"
          :scroll="{ x: 750 }"
          size="small"
          @change="handleOperationsTable"
        >
          <template #bodyCell="{ column, record }">
            <span v-if="column.key === 'command'">{{
              commandLabels[record.command] || record.command
            }}</span>
            <Tag
              v-else-if="column.key === 'status'"
              :color="operationStatusColor(record.status)"
            >
              {{ record.status }}
            </Tag>
            <span v-else-if="column.key === 'created_at'">{{
              Times.formatUnix(record.created_at)
            }}</span>
            <span v-else-if="column.key === 'error_message'">{{
              displayValue(record.error_message)
            }}</span>
            <Tooltip v-else-if="column.key === 'actions'" title="详情">
              <Button
                aria-label="详情"
                size="small"
                type="link"
                @click="openOperation(record)"
              >
                <template #icon><Eye /></template>
              </Button>
            </Tooltip>
          </template>
        </Table>
      </template>
    </PopupDrawer>

    <PopupModal
      v-model:open="otaOpen"
      :confirm-loading="otaSubmitting"
      title="批量版本升级"
      width="min(920px, calc(100vw - 24px))"
      @ok="submitOtaBatch"
    >
      <Form layout="vertical">
        <div class="form-grid">
          <FormItem label="固件路径" required>
            <Input
              v-model:value="otaForm.firmware_path"
              placeholder="例如 3200/S2260711.bin"
              @blur="
                otaForm.target_version =
                  otaForm.target_version ||
                  inferOtaTargetVersion(otaForm.firmware_path)
              "
            />
          </FormItem>
          <FormItem label="目标版本">
            <Input
              v-model:value="otaForm.target_version"
              placeholder="默认从固件文件名推断"
            />
          </FormItem>
          <FormItem label="仅在线设备">
            <Switch v-model:checked="otaForm.online_only" />
          </FormItem>
        </div>
      </Form>
      <p class="muted">
        后端会按当前设备版本判断是否需要升级；同版本或更高版本会跳过，需要升级的设备会调用
        POST /api/cmd 下发 {"OTA": 固件路径}。
      </p>
    </PopupModal>

    <PopupDrawer
      v-model:open="cardMessagesOpen"
      :loading="cardMessagesLoading"
      size="min(900px, 100vw)"
      title="卡片短信记录"
    >
      <template v-if="selectedSlot">
        <Descriptions :column="{ xs: 1, sm: 2 }" bordered size="small">
          <DescriptionsItem label="设备">
            {{ selectedSlot.device_code }}
          </DescriptionsItem>
          <DescriptionsItem label="卡槽">
            {{ selectedSlot.slot_code }}
          </DescriptionsItem>
          <DescriptionsItem label="手机号">
            {{ displayValue(selectedSlot.phone_number) }}
          </DescriptionsItem>
          <DescriptionsItem label="ICCID">
            {{ selectedSlot.current_sim_iccid }}
          </DescriptionsItem>
        </Descriptions>
        <Table
          class="card-message-table"
          :columns="cardMessageColumns"
          :data-source="cardMessages"
          :loading="cardMessagesLoading"
          :pagination="{ pageSize: 10, showTotal: formatPaginationTotal }"
          row-key="dedupe_key"
          :scroll="{ x: 770 }"
          size="small"
        >
          <template #bodyCell="{ column, record }">
            <Tag
              v-if="column.key === 'direction'"
              :color="record.direction === 'inbound' ? 'blue' : 'green'"
            >
              {{ record.direction === 'inbound' ? '接收' : '发送' }}
            </Tag>
            <span v-else-if="column.key === 'received_at'">{{
              Times.formatUnix(record.received_at)
            }}</span>
          </template>
        </Table>
      </template>
    </PopupDrawer>

    <PopupDrawer
      v-model:open="cardAccountsOpen"
      size="min(920px, 100vw)"
      title="关联账号"
    >
      <template v-if="selectedSlot">
        <Descriptions :column="{ xs: 1, sm: 2 }" bordered size="small">
          <DescriptionsItem label="设备">
            {{ selectedSlot.device_code }}
          </DescriptionsItem>
          <DescriptionsItem label="卡槽">
            {{ selectedSlot.slot_code }}
          </DescriptionsItem>
          <DescriptionsItem label="手机号">
            {{ displayValue(selectedSlot.phone_number) }}
          </DescriptionsItem>
          <DescriptionsItem label="ICCID">
            {{ selectedSlot.current_sim_iccid }}
          </DescriptionsItem>
        </Descriptions>
        <div class="card-account-content">
          <SimCardAccounts :phone-number="selectedSlot.phone_number" />
        </div>
      </template>
    </PopupDrawer>

    <PopupModal
      v-model:open="smsOpen"
      :confirm-loading="smsSubmitting"
      title="发送短信"
      @ok="submitSlotSms"
    >
      <Form layout="vertical">
        <FormItem label="电话卡">
          <Input
            :value="
              selectedSlot?.phone_number || selectedSlot?.current_sim_iccid
            "
            disabled
          />
        </FormItem>
        <FormItem label="目标号码" required>
          <Input v-model:value="smsForm.to" placeholder="例如 +8613800138000" />
        </FormItem>
        <FormItem label="短信内容" required>
          <TextArea
            v-model:value="smsForm.content"
            ::maxlength="1000"
            :rows="5"
            show-count
          />
        </FormItem>
      </Form>
    </PopupModal>

    <PopupModal
      v-model:open="balanceOpen"
      :confirm-loading="balanceSubmitting"
      title="修改余额"
      @ok="submitSlotBalance"
    >
      <Form layout="vertical">
        <FormItem label="电话卡">
          <Input
            :value="
              selectedSlot?.phone_number || selectedSlot?.current_sim_iccid
            "
            disabled
          />
        </FormItem>
        <FormItem label="余额" required>
          <Input
            v-model:value="balanceForm.balance"
            inputmode="decimal"
            placeholder="例如 100.50 或 -5.00"
          />
        </FormItem>
        <FormItem label="币种" required>
          <Select
            v-model:value="balanceForm.balanceCurrency"
            :options="[
              { label: '人民币 (CNY)', value: 'CNY' },
              { label: '港币 (HKD)', value: 'HKD' },
            ]"
          />
        </FormItem>
      </Form>
    </PopupModal>

    <PopupModal
      v-model:open="expiryOpen"
      :confirm-loading="expirySubmitting"
      title="修改卡片有效期"
      @ok="submitSlotExpiry"
    >
      <Form layout="vertical">
        <FormItem label="电话卡">
          <Input
            :value="
              selectedSlot?.phone_number || selectedSlot?.current_sim_iccid
            "
            disabled
          />
        </FormItem>
        <FormItem label="有效期" required>
          <DatePicker
            v-model:value="expiryForm.expiresAt"
            class="full-width"
            format="YYYY-MM-DD HH:mm"
            placeholder="选择卡片有效期"
            show-time
            value-format="X"
          />
        </FormItem>
      </Form>
    </PopupModal>

    <PopupModal
      v-model:open="cardUpdateOpen"
      :confirm-loading="cardUpdateSubmitting"
      title="更新设备卡片信息"
      @ok="submitSlotUpdate"
    >
      <Form layout="vertical">
        <FormItem label="本机号码" required>
          <Input
            v-model:value="cardUpdateForm.number"
            placeholder="包含国家码，例如 +852..."
          />
        </FormItem>
        <FormItem label="运营商选择" required>
          <AutoComplete
            v-model:value="cardUpdateForm.lock_carrier"
            :options="lockCarrierOptions(selectedSlot)"
            placeholder="自动或运营商数字编码"
          />
        </FormItem>
        <FormItem label="号码备注">
          <Input
            v-model:value="cardUpdateForm.note"
            ::maxlength="8"
            show-count
          />
        </FormItem>
        <FormItem label="来电操作" required>
          <Select
            v-model:value="cardUpdateForm.call"
            :options="[
              { label: '接听', value: '接听' },
              { label: '挂断', value: '挂断' },
              { label: '无操作', value: '无操作' },
            ]"
          />
        </FormItem>
      </Form>
    </PopupModal>

    <PopupDrawer
      v-model:open="operationDrawerOpen"
      :loading="operationDrawerLoading"
      size="min(680px, 100vw)"
      title="设备操作详情"
    >
      <template v-if="selectedOperation">
        <Descriptions :column="1" bordered size="small">
          <DescriptionsItem label="设备">
            {{ selectedOperation.device_code }}
          </DescriptionsItem>
          <DescriptionsItem label="命令">
            {{
              commandLabels[selectedOperation.command] ||
              selectedOperation.command
            }}
          </DescriptionsItem>
          <DescriptionsItem label="状态">
            {{ selectedOperation.status }}
          </DescriptionsItem>
          <DescriptionsItem label="下发时间">
            {{ Times.formatUnix(selectedOperation.created_at) }}
          </DescriptionsItem>
          <DescriptionsItem label="完成时间">
            {{ Times.formatUnix(selectedOperation.finished_at) }}
          </DescriptionsItem>
          <DescriptionsItem label="错误">
            {{ displayValue(selectedOperation.error_message) }}
          </DescriptionsItem>
        </Descriptions>
        <section class="operation-detail-block">
          <div class="operation-detail-heading">
            <h2>MQTT Topic</h2>
            <Tooltip title="复制 Topic">
              <Button
                aria-label="复制 MQTT Topic"
                shape="circle"
                size="small"
                type="text"
                @click="
                  copyOperationValue('MQTT Topic', selectedOperation.mqtt_topic)
                "
              >
                <template #icon><Copy /></template>
              </Button>
            </Tooltip>
          </div>
          <TypographyParagraph class="operation-payload">
            {{ selectedOperation.mqtt_topic }}
          </TypographyParagraph>
        </section>
        <section class="operation-detail-block">
          <div class="operation-detail-heading">
            <h2>MQTT Payload</h2>
            <Tooltip title="复制 Payload">
              <Button
                aria-label="复制 MQTT Payload"
                shape="circle"
                size="small"
                type="text"
                @click="copyOperationPayload(selectedOperation.mqtt_payload)"
              >
                <template #icon><Copy /></template>
              </Button>
            </Tooltip>
          </div>
          <TypographyParagraph class="operation-payload">
            {{ formatJsonValue(selectedOperation.mqtt_payload) }}
          </TypographyParagraph>
        </section>
      </template>
    </PopupDrawer>

    <PopupModal
      v-model:open="configEditorOpen"
      :confirm-loading="configSubmitting"
      :title="configEditorTitle"
      width="min(860px, 96vw)"
      @ok="submitConfig"
    >
      <Form layout="vertical">
        <FormItem label="配置类型">
          <Select
            v-model:value="configForm.kind"
            :options="[
              { label: '系统配置', value: 'system_config' },
              { label: 'MQTT 配置', value: 'mqtt_config' },
              { label: '转发配置', value: 'forward_config' },
            ]"
            @change="(kind) => handleConfigKindChange(kind as DeviceConfigKind)"
          />
        </FormItem>

        <template v-if="configForm.kind === 'system_config'">
          <p class="muted config-hint">
            下发到设备的系统配置字段。设备编号默认使用当前设备；Token 和 Wi-Fi
            密码不会从数据库回显，需要重新填写后再发布。
          </p>
          <div class="form-grid config-form-grid">
            <FormItem label="设备编号（DeviceID）" required>
              <Input v-model:value="systemConfigForm.DeviceID" disabled />
            </FormItem>
            <FormItem label="系统 Token（Token）" required>
              <InputPassword
                v-model:value="systemConfigForm.Token"
                autocomplete="new-password"
                placeholder="设备 HTTP API Bearer Token"
              />
            </FormItem>
            <FormItem label="Wi-Fi 名称（wifi）" required>
              <Input
                v-model:value="systemConfigForm.wifi"
                placeholder="设备连接的 Wi-Fi SSID"
              />
            </FormItem>
            <FormItem label="Wi-Fi 密码（password）" required>
              <InputPassword
                v-model:value="systemConfigForm.password"
                autocomplete="new-password"
                placeholder="设备 Wi-Fi 密码"
              />
            </FormItem>
          </div>
        </template>

        <template v-else-if="configForm.kind === 'mqtt_config'">
          <p class="muted config-hint">
            默认尝试带入消息设置里的 MQTT 主机、端口、用户名和 Topic
            前缀；密码和消息密钥不会回显，需要按设备实际配置填写。
          </p>
          <div class="form-grid config-form-grid">
            <FormItem label="MQTT 主机（mqtt_server）" required>
              <Input
                v-model:value="mqttConfigForm.mqtt_server"
                placeholder="例如 192.168.31.117 或 mqtt.example.com"
              />
            </FormItem>
            <FormItem label="MQTT 端口（mqtt_port）" required>
              <InputNumber
                v-model:value="mqttConfigForm.mqtt_port"
                class="full-width"
                :max="65535"
                :min="1"
                placeholder="1883"
              />
            </FormItem>
            <FormItem label="MQTT 用户名（mqtt_user）">
              <Input
                v-model:value="mqttConfigForm.mqtt_user"
                autocomplete="off"
                placeholder="没有用户名可留空"
              />
            </FormItem>
            <FormItem label="MQTT 密码（mqtt_password）">
              <InputPassword
                v-model:value="mqttConfigForm.mqtt_password"
                autocomplete="new-password"
                placeholder="没有密码可留空"
              />
            </FormItem>
            <FormItem label="MQTT 消息密钥（mqtt_key）">
              <InputPassword
                v-model:value="mqttConfigForm.mqtt_key"
                autocomplete="new-password"
                ::maxlength="16"
                placeholder="设备启用加密时填 16 位数字字母"
              />
            </FormItem>
            <FormItem label="短信转发（mqttsms）" required>
              <Select
                v-model:value="mqttConfigForm.mqttsms"
                :options="mqttSmsOptions"
              />
            </FormItem>
            <FormItem label="Topic 前缀（topic_prefix）" required>
              <Input
                v-model:value="mqttConfigForm.topic_prefix"
                placeholder="例如 qj，自动去掉首尾 /"
              />
            </FormItem>
          </div>
        </template>

        <FormItem v-else label="转发配置 JSON" required>
          <JsonEditor
            v-model="configForm.json"
            max-height="560px"
            min-height="360px"
            value-mode="text"
          />
        </FormItem>
      </Form>
    </PopupModal>
  </Page>
</template>

<style scoped>
.management-page {
  min-height: 0;
}

.management-page :deep(.management-content) {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.management-grid {
  flex: 1;
  min-height: 0;
}

.page-heading,
.filter-bar {
  flex: 0 0 auto;
}

.page-heading {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.page-heading h1 {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
  letter-spacing: 0;
}

.page-heading p {
  margin: 4px 0 0;
  color: hsl(var(--muted-foreground));
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 16px;
}

.config-form-grid {
  margin-top: 8px;
}

.config-hint {
  margin: 0 0 12px;
}

.filter-bar {
  display: grid;
  grid-template-columns:
    minmax(150px, 1fr) minmax(140px, 1fr) 130px minmax(150px, 1fr)
    auto;
  gap: 8px;
  align-items: center;
  padding: 10px 12px;
  margin-bottom: 12px;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

.input-icon {
  width: 16px;
  color: hsl(var(--muted-foreground));
}

.drawer-actions {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.drawer-section-title {
  margin: 24px 0 12px;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0;
}

.card-account-content {
  margin-top: 16px;
}

.card-message-table {
  margin-top: 16px;
}

.cell-edit-button {
  height: auto;
  padding: 0;
}

.full-width {
  width: 100%;
}

.muted {
  color: hsl(var(--muted-foreground));
}

.operation-detail-block {
  margin-top: 20px;
}

.operation-detail-heading {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}

.operation-detail-heading h2 {
  margin: 0 0 8px;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0;
}

.operation-payload {
  min-height: 44px;
  padding: 12px;
  margin: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 13px;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  background: hsl(var(--muted));
  border-radius: 4px;
}

@media (max-width: 760px) {
  .page-heading,
  .drawer-actions {
    flex-direction: column;
    align-items: flex-start;
  }

  .filter-bar {
    grid-template-columns: 1fr;
  }
}
</style>
