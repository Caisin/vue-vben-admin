<script lang="ts" setup>
import type { QuickFilter } from './data';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type {
  Device,
  DeviceSlot,
  DeviceSlotView,
  PhoneRegion,
  SimCardFilterOptions,
  SimCardView,
  SimLocationHistory,
  SmsMessage,
} from '#/api/msg';

import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';

import { useAccess } from '@vben/access';
import { Page } from '@vben/common-ui';
import {
  Copy,
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
  Form,
  FormItem,
  Input,
  message,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  TabPane,
  Tabs,
  Tag,
  TextArea,
  Tooltip,
} from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  DeviceApi,
  DeviceLocateError,
  PhoneGroupApi,
  SimCardApi,
} from '#/api/msg';
import { BusinessImport } from '#/components/import-export';
import { StatusTag } from '#/components/management';
import SimCardAccounts from '#/components/management/sim-card-accounts.vue';
import SimCardSelect from '#/components/management/sim-card-select.vue';
import {
  createIdempotencyKey,
  displayValue,
  formatPaginationTotal,
} from '#/management';
import { Times } from '#/times';
import { vxeSortParams } from '#/vxe-sort';

import { slotColumns } from '../devices/data';
import {
  historyColumns,
  messageColumns,
  useCardColumns,
  useFormSchema,
} from './data';
import PopupDrawer from './modules/popup-drawer.vue';
import PopupModal from './modules/popup-modal.vue';

const repairLoading = ref(false);
const addGroupOpen = ref(false);
const addGroupLoading = ref(false);
const addGroupSubmitting = ref(false);
const addGroupId = ref<number>();
const phoneGroupOptions = ref<{ label: string; value: number }[]>([]);
const balanceBatchLoading = ref(false);
const discoveryOpen = ref(false);
const discoverySubmitting = ref(false);
const discoveryTargetIccids = ref<string[]>([]);
const discoveryMode = ref<'batch' | 'single'>('batch');
const discoveryForm = reactive({
  onlyUnknown: true,
  overwriteKnown: true,
  receiverPhoneNumber: undefined as string | undefined,
});
const balanceRefreshingIccid = ref('');
const locatingDeviceCode = ref('');
const balanceOpen = ref(false);
const balanceSubmitting = ref(false);
const balanceForm = reactive({ balance: '', balanceCurrency: 'CNY' });
const expiryOpen = ref(false);
const expirySubmitting = ref(false);
const expiryForm = reactive({ expiresAt: undefined as string | undefined });
const profileOpen = ref(false);
const profileSubmitting = ref(false);
const profileForm = reactive({
  appleDeveloperRegistered: false,
  lifecycleState: 'active',
  managementNote: '',
  realName: '',
});
const filterOptions = ref<SimCardFilterOptions>({
  carriers: [],
  devices: [],
  phone_regions: [],
  lifecycle_states: [],
  real_names: [],
  software_versions: [],
  slot_codes: [],
});
const route = useRoute();
const { hasAccessByCodes } = useAccess();
const canManageSimCards = computed(() =>
  hasAccessByCodes(['sim_cards:manage']),
);
const canImportRealName = computed(() =>
  hasAccessByCodes(['sim_cards:import-real-name']),
);
const canDiscoverPhoneNumber = computed(() =>
  hasAccessByCodes(['sim_cards:discover-phone-number']),
);
const canLocateDevice = computed(() => hasAccessByCodes(['devices:locate']));
const canManagePhoneGroups = computed(() =>
  hasAccessByCodes(['phone_groups:manage']),
);
const canViewPhoneAccounts = computed(() =>
  hasAccessByCodes(['phone_accounts:view']),
);

const drawerOpen = ref(false);
const drawerLoading = ref(false);
const accountsDrawerOpen = ref(false);
const deviceDrawerOpen = ref(false);
const deviceDrawerLoading = ref(false);
const selectedDevice = ref<Device | null>(null);
const deviceSlots = ref<DeviceSlotView[]>([]);
const selectedCard = ref<null | SimCardView>(null);
const location = ref<DeviceSlot | null>(null);
const histories = ref<SimLocationHistory[]>([]);
const messages = ref<SmsMessage[]>([]);

const smsOpen = ref(false);
const smsSubmitting = ref(false);
const smsForm = reactive({ content: '', to: '' });
const updateOpen = ref(false);
const updateSubmitting = ref(false);
const updateForm = reactive({
  call: '接听',
  lock_carrier: '自动',
  note: '',
  number: '',
});
const simCardSortFields = [
  'carrier',
  'expires_at',
  'iccid',
  'last_seen_at',
  'phone_number',
];

const [Grid, gridApi] = useVbenVxeGrid<SimCardView>({
  formOptions: {
    schema: useFormSchema(filterOptions.value),
    submitOnChange: true,
  },
  gridOptions: {
    columns: useCardColumns(),
    height: 'auto',
    pagerConfig: { pageSize: 20, pageSizes: [10, 20, 50, 100] },
    proxyConfig: {
      ajax: {
        query: async (params, formValues) => {
          const { page } = params;
          const result = await SimCardApi.list({
            ...currentQueryParams(formValues),
            page: page.currentPage,
            size: page.pageSize,
            ...vxeSortParams(params, simCardSortFields),
          });
          return { items: result.items, total: result.total };
        },
      },
    },
    rowConfig: { keyField: 'iccid' },
    sortConfig: { remote: true },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<SimCardView>,
});

async function loadFilterOptions() {
  const options = await SimCardApi.filterOptions();
  filterOptions.value = {
    carriers: options.carriers ?? [],
    devices: options.devices ?? [],
    lifecycle_states: options.lifecycle_states ?? [],
    phone_regions: options.phone_regions ?? [],
    real_names: options.real_names ?? [],
    software_versions: options.software_versions ?? [],
    slot_codes: options.slot_codes ?? [],
  };
  await gridApi.formApi.updateSchema(useFormSchema(filterOptions.value));
}

async function loadInitialData() {
  await loadFilterOptions();
  await hydrateFiltersFromRoute();
  await gridApi.query();
}

async function refreshAfterRealNameImport() {
  await Promise.all([loadFilterOptions(), gridApi.query()]);
}

function firstQueryValue(value: unknown) {
  return Array.isArray(value) ? value[0] : value;
}

function queryString(key: string) {
  const value = firstQueryValue(route.query[key]);
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function hydrateFiltersFromRoute() {
  const days = Number(queryString('expires_within_days'));
  return gridApi.formApi.setValues({
    balance_lt: queryString('balance_lt') ?? '10',
    carrier: queryString('carrier'),
    device_code: queryString('device_code'),
    expires_within_days: Number.isFinite(days) && days >= 0 ? days : 30,
    lifecycle_state: queryString('lifecycle_state'),
    online_state: queryString('online_state'),
    phone_number: queryString('phone_number'),
    phone_region: queryString('phone_region'),
    quick_filter: inferQuickFilterFromRoute(),
    real_name: queryString('real_name'),
    slot_code: queryString('slot_code'),
  });
}

function inferQuickFilterFromRoute(): QuickFilter {
  if (queryString('device_has_empty_slot') === 'true') {
    return 'device_has_empty_slot';
  }
  if (queryString('phone_number_state') === 'unknown') return 'missing_phone';
  if (queryString('phone_number_state') === 'known') return 'has_phone';
  if (queryString('arrears_state') === 'arrears') return 'arrears';
  if (queryString('account_alert') === 'active') return 'balance_warning';
  if (queryString('balance_lt')) return 'low_balance';
  switch (queryString('expiry_state')) {
    case 'expired': {
      return 'expired';
    }
    case 'expiring': {
      return 'expiring';
    }
    case 'unknown': {
      return 'missing_expiry';
    }
  }
  if (queryString('apple_developer_registered') === 'true') {
    return 'apple_developer';
  }
  if (queryString('apple_developer_registered') === 'false') {
    return 'not_apple_developer';
  }
  return 'all';
}

function currentQueryParams(formValues: Record<string, unknown>) {
  return {
    ...quickFilterParams(formValues),
    keyword: String(formValues.keyword ?? '').trim() || undefined,
    lifecycle_state: String(formValues.lifecycle_state ?? '') || undefined,
    online_state: String(formValues.online_state ?? '') || undefined,
    phone_region: String(formValues.phone_region ?? '') || undefined,
    slot_code: String(formValues.slot_code ?? '') || undefined,
  };
}

function accountAlertLabel(card: SimCardView) {
  if (card.account_alert === 'arrears') return '欠费';
  if (card.account_alert === 'top_up_required') return '充值预警';
  return '';
}

function hasAccountAlert(card: SimCardView) {
  return Boolean(accountAlertLabel(card));
}

function quickFilterParams(formValues: Record<string, unknown>) {
  switch (formValues.quick_filter as QuickFilter) {
    case 'apple_developer': {
      return { apple_developer_registered: true };
    }
    case 'arrears': {
      return { arrears_state: 'arrears' };
    }
    case 'balance_warning': {
      return { account_alert: 'active' };
    }
    case 'device_has_empty_slot': {
      return { device_has_empty_slot: true };
    }
    case 'expired': {
      return { expiry_state: 'expired' };
    }
    case 'expiring': {
      return {
        expires_within_days: Number(formValues.expires_within_days ?? 30),
        expiry_state: 'expiring',
      };
    }
    case 'has_phone': {
      return { phone_number_state: 'known' };
    }
    case 'low_balance': {
      return { balance_lt: String(formValues.balance_lt ?? '').trim() || '10' };
    }
    case 'missing_expiry': {
      return { expiry_state: 'unknown' };
    }
    case 'missing_phone': {
      return { phone_number_state: 'unknown' };
    }
    case 'not_apple_developer': {
      return { apple_developer_registered: false };
    }
    default: {
      return {};
    }
  }
}

async function loadPhoneGroupOptions() {
  if (phoneGroupOptions.value.length > 0) return;
  addGroupLoading.value = true;
  try {
    const options = await PhoneGroupApi.options();
    phoneGroupOptions.value = options.map((option) => ({
      label: `${option.label}（${option.grp_code}）`,
      value: option.value,
    }));
  } finally {
    addGroupLoading.value = false;
  }
}

async function openAddCurrentQueryToGroup() {
  addGroupId.value = undefined;
  addGroupOpen.value = true;
  await loadPhoneGroupOptions();
}

async function submitAddCurrentQueryToGroup() {
  if (!addGroupId.value) {
    message.warning('请选择号码分组');
    return;
  }
  addGroupSubmitting.value = true;
  try {
    const result = await PhoneGroupApi.addSimsByQuery(addGroupId.value, {
      query: currentQueryParams(await gridApi.formApi.getValues()),
    });
    message.success(
      `匹配 ${result.matched} 个号码，新增 ${result.inserted} 个，已存在 ${result.existing} 个`,
    );
    addGroupOpen.value = false;
  } finally {
    addGroupSubmitting.value = false;
  }
}

function repairAllPhoneNumbers() {
  Modal.confirm({
    content:
      '系统将在后台按当前规则重算号码格式，适合导入或设备上报后统一纠偏。',
    okText: '开始修复',
    title: '确认批量修复号码格式',
    async onOk() {
      repairLoading.value = true;
      try {
        await SimCardApi.repairPhoneNumbers();
        message.success('批量修复号码格式后台任务已提交');
      } finally {
        repairLoading.value = false;
      }
    },
  });
}

function selectedTableCards() {
  const grid = gridApi.grid as unknown as
    | undefined
    | { getCheckboxRecords?: () => SimCardView[] };
  return typeof grid?.getCheckboxRecords === 'function'
    ? grid.getCheckboxRecords()
    : [];
}

function openDiscoverBatch() {
  selectedCard.value = null;
  discoveryMode.value = 'batch';
  discoveryTargetIccids.value = selectedTableCards().map((card) => card.iccid);
  discoveryForm.onlyUnknown = true;
  discoveryForm.overwriteKnown = false;
  discoveryForm.receiverPhoneNumber = undefined;
  discoveryOpen.value = true;
}

function openDiscoverSingle(card: SimCardView) {
  selectedCard.value = card;
  discoveryMode.value = 'single';
  discoveryTargetIccids.value = [card.iccid];
  discoveryForm.onlyUnknown = false;
  discoveryForm.overwriteKnown = true;
  discoveryForm.receiverPhoneNumber = undefined;
  discoveryOpen.value = true;
}

async function submitDiscovery() {
  const receiverPhoneNumber = discoveryForm.receiverPhoneNumber?.trim();
  if (!receiverPhoneNumber) {
    message.warning('请选择接收短信号码');
    return;
  }
  discoverySubmitting.value = true;
  try {
    if (discoveryMode.value === 'single') {
      const iccid = discoveryTargetIccids.value[0];
      if (!iccid) return;
      const result = await SimCardApi.discoverPhoneNumber(iccid, {
        overwrite_known: discoveryForm.overwriteKnown,
        receiver_phone_number: receiverPhoneNumber,
        requested_by: 'admin',
      });
      message.success(`号码查询任务 ${result.job_key} 已受理`);
    } else {
      await SimCardApi.discoverPhoneNumbers({
        only_unknown: discoveryForm.onlyUnknown,
        receiver_phone_number: receiverPhoneNumber,
        requested_by: 'admin',
        target_iccids: discoveryTargetIccids.value,
      });
      message.success('批量号码查询后台任务已提交，请稍后刷新列表');
    }
    discoveryOpen.value = false;
  } finally {
    discoverySubmitting.value = false;
  }
}

function refreshAllBalances() {
  Modal.confirm({
    content:
      '系统将为当前可见且在槽的中国电信卡创建持久化余额查询任务。香港和海外卡根据运营商短信更新余额与预警。',
    okText: '开始查询',
    title: '确认批量查询余额',
    async onOk() {
      balanceBatchLoading.value = true;
      try {
        const task = await SimCardApi.refreshBalances();
        message.success(`批量查询余额任务 #${task.id} 已提交`);
      } finally {
        balanceBatchLoading.value = false;
      }
    },
  });
}

async function refreshCardBalance(card: SimCardView) {
  balanceRefreshingIccid.value = card.iccid;
  try {
    const result = await SimCardApi.refreshBalance(card.iccid);
    message.success(`余额查询任务 ${result.job_key} 已受理`);
  } finally {
    balanceRefreshingIccid.value = '';
  }
}

function openBalance(card: SimCardView) {
  selectedCard.value = card;
  balanceForm.balance = card.balance;
  balanceForm.balanceCurrency =
    card.balance_currency ||
    (card.phone_region === 'hong_kong' ? 'HKD' : 'CNY');
  balanceOpen.value = true;
}

async function submitBalance() {
  const card = selectedCard.value;
  if (!card || !balanceForm.balance.trim()) {
    message.warning('请填写余额');
    return;
  }
  balanceSubmitting.value = true;
  try {
    const updated = await SimCardApi.updateBalance(card.iccid, {
      balance: balanceForm.balance.trim(),
      balance_currency: balanceForm.balanceCurrency,
    });
    Object.assign(card, updated);
    message.success('余额已更新');
    balanceOpen.value = false;
  } finally {
    balanceSubmitting.value = false;
  }
}

function openExpiry(card: SimCardView) {
  selectedCard.value = card;
  expiryForm.expiresAt =
    card.expires_at > 0 ? String(card.expires_at) : undefined;
  expiryOpen.value = true;
}

async function submitExpiry() {
  const card = selectedCard.value;
  const expiresAt = Number(expiryForm.expiresAt);
  if (!card || !Number.isSafeInteger(expiresAt) || expiresAt <= 0) {
    message.warning('请选择有效期');
    return;
  }
  expirySubmitting.value = true;
  try {
    const updated = await SimCardApi.updateExpiry(card.iccid, {
      expires_at: expiresAt,
    });
    Object.assign(card, updated);
    message.success('卡片有效期已更新');
    expiryOpen.value = false;
  } finally {
    expirySubmitting.value = false;
  }
}

function openProfile(card: SimCardView) {
  selectedCard.value = card;
  profileForm.appleDeveloperRegistered = card.apple_developer_registered;
  profileForm.lifecycleState = card.lifecycle_state || 'active';
  profileForm.managementNote = card.management_note;
  profileForm.realName = card.real_name;
  profileOpen.value = true;
}

async function submitProfile() {
  const card = selectedCard.value;
  if (!card) return;
  profileSubmitting.value = true;
  try {
    const updated = await SimCardApi.updateProfile(card.iccid, {
      apple_developer_registered: profileForm.appleDeveloperRegistered,
      lifecycle_state: profileForm.lifecycleState,
      management_note: profileForm.managementNote.trim(),
      real_name: profileForm.realName.trim(),
    });
    Object.assign(card, updated);
    message.success('号码资料已更新');
    profileOpen.value = false;
  } finally {
    profileSubmitting.value = false;
  }
}

async function openDeviceManagement(card: SimCardView) {
  const deviceCode = card.device_code?.trim();
  if (!deviceCode) return;
  deviceDrawerOpen.value = true;
  deviceDrawerLoading.value = true;
  try {
    const [device, slots] = await Promise.all([
      DeviceApi.detail(deviceCode),
      DeviceApi.slots(deviceCode),
    ]);
    selectedDevice.value = device;
    deviceSlots.value = slots;
  } finally {
    deviceDrawerLoading.value = false;
  }
}

function slotCellValue(record: DeviceSlotView, dataIndex: unknown) {
  const value = (record as unknown as Record<string, unknown>)[
    String(dataIndex)
  ];
  return value || '未知';
}

async function locateCardDevice(card: SimCardView) {
  if (!card.device_code) {
    message.warning('电话卡当前未插入设备');
    return;
  }
  if (card.online_state !== 'online') {
    message.warning('电话卡所在设备不在线，无法直连定位');
    return;
  }
  locatingDeviceCode.value = card.device_code;
  try {
    const result = await DeviceApi.locateByHttp(card.device_code);
    message.success(result.message || '卡片所在设备已开始定位提示');
  } catch (error) {
    if (error instanceof DeviceLocateError) message.error(error.message);
  } finally {
    locatingDeviceCode.value = '';
  }
}

function phoneRegionLabel(region: PhoneRegion) {
  return (
    filterOptions.value.phone_regions.find((option) => option.value === region)
      ?.label ??
    {
      hong_kong: '香港',
      mainland_china: '中国大陆',
      other: '其他',
      unknown: '未知',
    }[region]
  );
}

function textSelectOptions(values: string[]) {
  return values.map((value) => ({ label: value, value }));
}

function lifecycleOptions() {
  return filterOptions.value.lifecycle_states.length > 0
    ? filterOptions.value.lifecycle_states
    : [
        { label: '正常', value: 'active' },
        { label: '未知', value: 'unknown' },
        { label: '停用', value: 'disabled' },
        { label: '退役', value: 'retired' },
      ];
}

function cardDisplay(card: SimCardView, key: unknown) {
  switch (String(key)) {
    case 'carrier': {
      return displayValue(card.carrier);
    }
    case 'management_note': {
      return displayValue(card.management_note);
    }
    case 'phone_number': {
      return displayValue(card.phone_number);
    }
    case 'real_name': {
      return displayValue(card.real_name);
    }
    default: {
      return '未知';
    }
  }
}

async function copyPhoneNumber(card: SimCardView) {
  if (!card.phone_number.trim()) return;
  try {
    await navigator.clipboard.writeText(card.phone_number);
    message.success('号码已复制');
  } catch {
    message.error('复制号码失败，请检查浏览器剪贴板权限');
  }
}

function openAccounts(card: SimCardView) {
  if (!card.phone_number.trim()) return;
  selectedCard.value = card;
  accountsDrawerOpen.value = true;
}

async function openCard(card: SimCardView) {
  selectedCard.value = card;
  drawerOpen.value = true;
  drawerLoading.value = true;
  try {
    const [currentLocation, locationHistory, cardMessages] = await Promise.all([
      SimCardApi.location(card.iccid),
      SimCardApi.locationHistory(card.iccid),
      SimCardApi.messages(card.iccid),
    ]);
    location.value = currentLocation;
    histories.value = locationHistory;
    messages.value = cardMessages;
  } finally {
    drawerLoading.value = false;
  }
}

function openSms(card: SimCardView) {
  selectedCard.value = card;
  smsForm.to = '';
  smsForm.content = '';
  smsOpen.value = true;
}

async function submitSms() {
  if (!selectedCard.value || !smsForm.to.trim() || !smsForm.content.trim()) {
    message.warning('请填写目标号码和短信内容');
    return;
  }
  smsSubmitting.value = true;
  try {
    const result = await SimCardApi.sendSms(selectedCard.value.iccid, {
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

function lockCarrierOptions() {
  return [{ label: '自动', value: '自动' }];
}

function openUpdate(card: SimCardView) {
  selectedCard.value = card;
  updateForm.lock_carrier = '自动';
  updateForm.number = card.phone_number;
  updateForm.note = card.note.slice(0, 8);
  updateForm.call = '接听';
  updateOpen.value = true;
}

async function submitUpdate() {
  if (!selectedCard.value || !updateForm.number.trim()) {
    message.warning('请填写本机号码');
    return;
  }
  updateSubmitting.value = true;
  try {
    await SimCardApi.updateDevice(selectedCard.value.iccid, {
      call: updateForm.call,
      lock_carrier: updateForm.lock_carrier.trim(),
      note: updateForm.note.trim(),
      number: updateForm.number.trim(),
    });
    message.success('设备卡片配置已受理');
    updateOpen.value = false;
  } finally {
    updateSubmitting.value = false;
  }
}

onMounted(loadInitialData);
</script>

<template>
  <Page
    auto-content-height
    class="management-page"
    content-class="management-content"
  >
    <header class="page-heading">
      <div>
        <h1>电话卡管理</h1>
        <p>查询卡片状态、当前位置、余额、有效期和短信记录</p>
      </div>
      <Space wrap>
        <BusinessImport
          v-if="canImportRealName"
          button-size="middle"
          button-text="导入实名"
          definition-code="msg.sim.real_name"
          @completed="refreshAfterRealNameImport"
        />
        <Button v-if="canDiscoverPhoneNumber" @click="openDiscoverBatch">
          <template #icon><MessageSquareCode /></template>批量查询号码
        </Button>
        <Button
          v-if="canManagePhoneGroups"
          :loading="addGroupLoading"
          @click="openAddCurrentQueryToGroup"
        >
          <template #icon><Link2 /></template>加入分组
        </Button>
        <Button
          v-if="canManageSimCards"
          :loading="balanceBatchLoading"
          @click="refreshAllBalances"
        >
          <template #icon><RotateCw /></template>批量查询余额
        </Button>
        <Button
          v-if="canManageSimCards"
          :loading="repairLoading"
          @click="repairAllPhoneNumbers"
        >
          <template #icon><RotateCw /></template>批量修复号码格式
        </Button>
      </Space>
    </header>

    <Grid class="management-grid" table-title="电话卡">
      <template #iccid="{ row }">
        <Tooltip title="查看电话卡详情">
          <Button
            aria-label="查看电话卡详情"
            class="cell-edit-button"
            type="link"
            @click="openCard(row)"
          >
            {{ row.iccid }}
          </Button>
        </Tooltip>
      </template>
      <template #phoneNumber="{ row }">
        <div class="inline-cell">
          <Tooltip title="更新设备卡片信息并通知设备同步修改">
            <Button
              v-if="canManageSimCards"
              class="cell-edit-button inline-cell-value"
              type="link"
              @click="openUpdate(row)"
            >
              {{ cardDisplay(row, 'phone_number') }}
            </Button>
            <span v-else>{{ cardDisplay(row, 'phone_number') }}</span>
          </Tooltip>
          <Tooltip title="复制号码">
            <Button
              aria-label="复制号码"
              class="table-icon-button"
              :disabled="!row.phone_number.trim()"
              size="small"
              type="text"
              @click="copyPhoneNumber(row)"
            >
              <template #icon><Copy /></template>
            </Button>
          </Tooltip>
          <Tag v-if="hasAccountAlert(row)" color="error">
            {{ accountAlertLabel(row) }}
          </Tag>
          <Tooltip v-if="canManageSimCards" title="使用该号码发送短信">
            <Button
              aria-label="使用该号码发送短信"
              class="table-icon-button"
              size="small"
              type="text"
              @click="openSms(row)"
            >
              <template #icon><MessageSquareCode /></template>
            </Button>
          </Tooltip>
          <Tooltip
            v-if="canDiscoverPhoneNumber"
            title="通过短信查询/纠正该卡号码"
          >
            <Button
              aria-label="查询或纠正号码"
              class="table-icon-button"
              :disabled="!row.device_code"
              size="small"
              type="text"
              @click="openDiscoverSingle(row)"
            >
              <template #icon><RotateCw /></template>
            </Button>
          </Tooltip>
        </div>
      </template>
      <template #accounts="{ row }">
        <Tooltip v-if="canViewPhoneAccounts" title="查看和编辑关联账号">
          <Button
            :disabled="!row.phone_number.trim()"
            size="small"
            type="link"
            @click="openAccounts(row)"
          >
            <template #icon><Link2 /></template>
            {{ row.account_count > 0 ? `${row.account_count} 个` : '账号' }}
          </Button>
        </Tooltip>
      </template>
      <template #deviceLocation="{ row }">
        <div class="device-location-cell">
          <Button
            v-if="row.device_code"
            class="cell-edit-button"
            type="link"
            @click="openDeviceManagement(row)"
          >
            {{ row.device_name || row.device_code }}
          </Button>
          <span v-else class="muted">未插入</span>
          <Tag v-if="row.slot_code" color="blue">卡槽 {{ row.slot_code }}</Tag>
          <Tooltip
            v-if="row.device_code && canLocateDevice"
            title="定位卡片所在设备"
          >
            <Button
              aria-label="定位卡片所在设备"
              class="table-icon-button"
              :disabled="row.online_state !== 'online'"
              :loading="locatingDeviceCode === row.device_code"
              size="small"
              type="text"
              @click.stop="locateCardDevice(row)"
            >
              <template #icon><Pin /></template>
            </Button>
          </Tooltip>
        </div>
      </template>
      <template #onlineState="{ row }">
        <StatusTag :status="row.online_state" />
      </template>
      <template #appleDeveloper="{ row }">
        <Tooltip v-if="canManageSimCards" title="编辑数据库号码资料">
          <Button
            class="cell-edit-button"
            type="link"
            @click="openProfile(row)"
          >
            <Tag :color="row.apple_developer_registered ? 'blue' : 'default'">
              {{ row.apple_developer_registered ? '已注册' : '未注册' }}
            </Tag>
          </Button>
        </Tooltip>
        <Tag
          v-else
          :color="row.apple_developer_registered ? 'blue' : 'default'"
        >
          {{ row.apple_developer_registered ? '已注册' : '未注册' }}
        </Tag>
      </template>
      <template #profileField="{ column, row }">
        <Tooltip v-if="canManageSimCards" title="编辑实名和备注">
          <Button
            :aria-label="column.field === 'real_name' ? '编辑实名' : '编辑备注'"
            class="cell-edit-button"
            type="link"
            @click="openProfile(row)"
          >
            {{ cardDisplay(row, column.field) }}
          </Button>
        </Tooltip>
        <span v-else>{{ cardDisplay(row, column.field) }}</span>
      </template>
      <template #cardValue="{ column, row }">
        {{ cardDisplay(row, column.field) }}
      </template>
      <template #balance="{ row }">
        <div class="inline-cell">
          <Tooltip v-if="canManageSimCards" title="点击修改余额">
            <Button
              aria-label="修改余额"
              class="cell-edit-button"
              :danger="hasAccountAlert(row)"
              type="link"
              @click="openBalance(row)"
            >
              {{
                row.balance
                  ? `${row.balance_currency || ''} ${row.balance}`
                  : '未知'
              }}
            </Button>
          </Tooltip>
          <span v-else :class="{ 'text-red-500': hasAccountAlert(row) }">
            {{
              row.balance
                ? `${row.balance_currency || ''} ${row.balance}`
                : '未知'
            }}
          </span>
          <Tooltip v-if="canManageSimCards" title="查余额">
            <Button
              aria-label="查余额"
              class="table-icon-button"
              :loading="balanceRefreshingIccid === row.iccid"
              size="small"
              type="text"
              @click="refreshCardBalance(row)"
            >
              <template #icon><RotateCw /></template>
            </Button>
          </Tooltip>
        </div>
      </template>
      <template #expiresAt="{ row }">
        <Tooltip v-if="canManageSimCards" title="点击修改有效期">
          <Button
            aria-label="修改有效期"
            class="cell-edit-button"
            type="link"
            @click="openExpiry(row)"
          >
            {{ Times.formatUnix(row.expires_at) }}
          </Button>
        </Tooltip>
        <span v-else>{{ Times.formatUnix(row.expires_at) }}</span>
      </template>
      <template #lifecycleState="{ row }">
        <Tooltip v-if="canManageSimCards" title="编辑数据库号码资料">
          <Button
            class="cell-edit-button"
            type="link"
            @click="openProfile(row)"
          >
            <StatusTag :status="row.lifecycle_state" />
          </Button>
        </Tooltip>
        <StatusTag v-else :status="row.lifecycle_state" />
      </template>
      <template #lastSeenAt="{ row }">
        {{ Times.formatUnix(row.last_seen_at) }}
      </template>
    </Grid>

    <PopupModal
      v-model:open="addGroupOpen"
      :confirm-loading="addGroupSubmitting"
      title="按当前查询加入号码分组"
      @ok="submitAddCurrentQueryToGroup"
    >
      <Form layout="vertical">
        <FormItem label="查询条件">
          <Input
            value="将当前筛选条件命中的全部号码追加到目标分组，不会重复添加已存在号码"
            disabled
          />
        </FormItem>
        <FormItem label="目标分组" required>
          <Select
            v-model:value="addGroupId"
            allow-clear
            class="w-full"
            :loading="addGroupLoading"
            :options="phoneGroupOptions"
            placeholder="选择号码分组"
            show-search
            option-filter-prop="label"
          />
        </FormItem>
      </Form>
    </PopupModal>

    <PopupDrawer
      v-model:open="accountsDrawerOpen"
      size="min(920px, 100vw)"
      title="号码关联账号"
    >
      <template v-if="accountsDrawerOpen && selectedCard">
        <Descriptions :column="{ xs: 1, sm: 2 }" bordered size="small">
          <DescriptionsItem label="号码">
            {{ selectedCard.phone_number }}
          </DescriptionsItem>
          <DescriptionsItem label="ICCID">
            {{ selectedCard.iccid }}
          </DescriptionsItem>
        </Descriptions>
        <div class="account-drawer-content">
          <SimCardAccounts :phone-number="selectedCard.phone_number" />
        </div>
      </template>
    </PopupDrawer>

    <PopupDrawer
      v-model:open="deviceDrawerOpen"
      :loading="deviceDrawerLoading"
      size="min(980px, 100vw)"
      title="设备详情"
    >
      <template v-if="selectedDevice">
        <Descriptions :column="{ xs: 1, sm: 2 }" bordered size="small">
          <DescriptionsItem label="设备编号">
            {{ selectedDevice.device_code }}
          </DescriptionsItem>
          <DescriptionsItem label="在线状态">
            <StatusTag :status="selectedDevice.online_state" />
          </DescriptionsItem>
          <DescriptionsItem label="局域网 IP">
            {{ displayValue(selectedDevice.sta_ip) }}
          </DescriptionsItem>
          <DescriptionsItem label="MAC">
            {{ displayValue(selectedDevice.mac) }}
          </DescriptionsItem>
          <DescriptionsItem label="软件版本">
            {{ displayValue(selectedDevice.software_version) }}
          </DescriptionsItem>
          <DescriptionsItem label="Wi-Fi">
            {{ displayValue(selectedDevice.wifi) }}
          </DescriptionsItem>
          <DescriptionsItem label="最近上报">
            {{ Times.formatUnix(selectedDevice.last_seen_at) }}
          </DescriptionsItem>
          <DescriptionsItem label="更新时间">
            {{ Times.formatUnix(selectedDevice.updated_at) }}
          </DescriptionsItem>
        </Descriptions>
        <Table
          :columns="slotColumns"
          :data-source="deviceSlots"
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
              {{ slotCellValue(record, column.dataIndex) }}
            </span>
            <span v-else-if="column.key === 'balance'">
              {{
                record.balance
                  ? `${record.balance_currency || ''} ${record.balance}`
                  : '未知'
              }}
            </span>
            <span v-else-if="column.key === 'expires_at'">
              {{ Times.formatUnix(record.expires_at) }}
            </span>
            <span v-else-if="column.key === 'actions'">-</span>
          </template>
        </Table>
      </template>
    </PopupDrawer>

    <PopupDrawer
      v-model:open="drawerOpen"
      :loading="drawerLoading"
      size="min(920px, 100vw)"
      title="电话卡详情"
    >
      <template v-if="selectedCard">
        <div class="drawer-actions">
          <div>
            <strong>{{
              selectedCard.phone_number || selectedCard.iccid
            }}</strong>
            <div class="muted">{{ selectedCard.iccid }}</div>
          </div>
          <Space>
            <Button
              v-if="canLocateDevice"
              :disabled="
                !selectedCard.device_code ||
                selectedCard.online_state !== 'online'
              "
              :loading="locatingDeviceCode === selectedCard.device_code"
              @click="locateCardDevice(selectedCard)"
            >
              <template #icon><Pin /></template>
              定位所在设备
            </Button>
            <Button
              v-if="canManageSimCards"
              :loading="balanceRefreshingIccid === selectedCard.iccid"
              @click="refreshCardBalance(selectedCard)"
            >
              <template #icon><RotateCw /></template>
              查余额
            </Button>
            <Button v-if="canManageSimCards" @click="openUpdate(selectedCard)">
              <template #icon><Settings /></template>
              设备配置
            </Button>
            <Button
              v-if="canManageSimCards"
              type="primary"
              @click="openSms(selectedCard)"
            >
              <template #icon><MessageSquareCode /></template>发短信
            </Button>
            <Button
              v-if="canDiscoverPhoneNumber"
              :disabled="!selectedCard.device_code"
              @click="openDiscoverSingle(selectedCard)"
            >
              <template #icon><RotateCw /></template>查号码
            </Button>
          </Space>
        </div>
        <Tabs>
          <TabPane key="current" tab="当前位置">
            <Descriptions :column="{ xs: 1, sm: 2 }" bordered size="small">
              <DescriptionsItem label="设备">
                <Button
                  v-if="location?.device_code"
                  type="link"
                  @click="openDeviceManagement(selectedCard)"
                >
                  {{ location.device_code }}
                </Button>
                <span v-else>未插入设备</span>
              </DescriptionsItem>
              <DescriptionsItem label="设备状态">
                <StatusTag :status="selectedCard.online_state" />
              </DescriptionsItem>
              <DescriptionsItem label="卡槽">
                {{ location?.slot_code || '未知' }}
              </DescriptionsItem>
              <DescriptionsItem label="卡槽号码">
                {{ displayValue(location?.phone_number) }}
              </DescriptionsItem>
              <DescriptionsItem label="IMSI">
                {{ displayValue(selectedCard.imsi) }}
              </DescriptionsItem>
              <DescriptionsItem label="运营商">
                {{ displayValue(selectedCard.carrier) }}
              </DescriptionsItem>
              <DescriptionsItem label="号码地区">
                {{ phoneRegionLabel(selectedCard.phone_region) }}
              </DescriptionsItem>
              <DescriptionsItem label="苹果开发者账号">
                {{
                  selectedCard.apple_developer_registered ? '已注册' : '未注册'
                }}
              </DescriptionsItem>
              <DescriptionsItem label="漫游状态">
                {{
                  selectedCard.is_roaming === true
                    ? '漫游'
                    : selectedCard.is_roaming === false
                      ? '非漫游'
                      : '未知'
                }}
              </DescriptionsItem>
              <DescriptionsItem label="余额">
                <Button
                  v-if="canManageSimCards"
                  type="link"
                  @click="openBalance(selectedCard)"
                >
                  {{
                    selectedCard.balance
                      ? `${selectedCard.balance_currency} ${selectedCard.balance}`
                      : '未知'
                  }}
                </Button>
                <span v-else>
                  {{
                    selectedCard.balance
                      ? `${selectedCard.balance_currency} ${selectedCard.balance}`
                      : '未知'
                  }}
                </span>
              </DescriptionsItem>
              <DescriptionsItem label="卡片有效期">
                <Button
                  v-if="canManageSimCards"
                  type="link"
                  @click="openExpiry(selectedCard)"
                >
                  {{ Times.formatUnix(selectedCard.expires_at) }}
                </Button>
                <span v-else>{{
                  Times.formatUnix(selectedCard.expires_at)
                }}</span>
              </DescriptionsItem>
              <DescriptionsItem label="实名">
                {{ displayValue(selectedCard.real_name) }}
              </DescriptionsItem>
              <DescriptionsItem label="管理备注">
                {{ displayValue(selectedCard.management_note) }}
              </DescriptionsItem>
              <DescriptionsItem label="设备备注">
                {{ displayValue(selectedCard.note) }}
              </DescriptionsItem>
              <DescriptionsItem label="账户信息来源">
                {{ displayValue(selectedCard.account_source) }}
              </DescriptionsItem>
            </Descriptions>
          </TabPane>
          <TabPane key="history" tab="位置历史">
            <Table
              :columns="historyColumns"
              :data-source="histories"
              :pagination="false"
              row-key="id"
              :scroll="{ x: 830 }"
              size="small"
            >
              <template #bodyCell="{ column, record }">
                <span
                  v-if="
                    ['first_seen_at', 'last_seen_at', 'removed_at'].includes(
                      String(column.key),
                    )
                  "
                >
                  {{
                    column.key === 'removed_at' && record.removed_at === 0
                      ? '当前位置'
                      : Times.formatUnixField(record, column.key, '未知')
                  }}
                </span>
              </template>
            </Table>
          </TabPane>
          <TabPane key="messages" tab="短信记录">
            <Table
              :columns="messageColumns"
              :data-source="messages"
              :pagination="{
                pageSize: 10,
                showTotal: formatPaginationTotal,
              }"
              row-key="dedupe_key"
              :scroll="{ x: 950 }"
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
          </TabPane>
          <TabPane key="accounts" v-if="canViewPhoneAccounts" tab="关联账号">
            <SimCardAccounts :phone-number="selectedCard.phone_number" />
          </TabPane>
        </Tabs>
      </template>
    </PopupDrawer>

    <PopupModal
      v-model:open="smsOpen"
      :confirm-loading="smsSubmitting"
      title="发送短信"
      @ok="submitSms"
    >
      <Form layout="vertical">
        <FormItem label="电话卡">
          <Input
            :value="selectedCard?.phone_number || selectedCard?.iccid"
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
      v-model:open="discoveryOpen"
      :confirm-loading="discoverySubmitting"
      :title="discoveryMode === 'single' ? '查询/纠正号码' : '批量查询号码'"
      @ok="submitDiscovery"
    >
      <Form layout="vertical">
        <FormItem v-if="discoveryMode === 'single'" label="目标电话卡">
          <Input
            :value="selectedCard?.phone_number || selectedCard?.iccid"
            disabled
          />
        </FormItem>
        <FormItem v-else label="目标范围">
          <Input
            :value="
              discoveryTargetIccids.length > 0
                ? `已选择 ${discoveryTargetIccids.length} 张电话卡`
                : '全部未知号码的在槽电话卡'
            "
            disabled
          />
        </FormItem>
        <FormItem label="接收短信号码" required>
          <SimCardSelect
            v-model="discoveryForm.receiverPhoneNumber"
            placeholder="选择一个可接收 MQTT 短信的已知号码"
            require-phone-number
            value-field="phone_number"
          />
          <div class="muted form-tip">
            目标卡会向该号码发送 iccid
            短信；系统收到后用对方号码回填目标卡号码。
          </div>
        </FormItem>
        <FormItem v-if="discoveryMode === 'batch'" label="只补充未知号码">
          <Switch
            v-model:checked="discoveryForm.onlyUnknown"
            checked-children="只补未知"
            un-checked-children="允许纠正"
          />
        </FormItem>
        <FormItem v-else label="覆盖已有号码">
          <Switch
            v-model:checked="discoveryForm.overwriteKnown"
            checked-children="纠正"
            un-checked-children="仅未知"
          />
        </FormItem>
      </Form>
    </PopupModal>

    <PopupModal
      v-model:open="profileOpen"
      :confirm-loading="profileSubmitting"
      title="编辑数据库号码资料"
      @ok="submitProfile"
    >
      <Form layout="vertical">
        <FormItem label="ICCID">
          <Input :value="selectedCard?.iccid" disabled />
        </FormItem>
        <FormItem label="实名">
          <AutoComplete
            v-model:value="profileForm.realName"
            ::maxlength="100"
            :options="textSelectOptions(filterOptions.real_names)"
            placeholder="号码实名"
          />
        </FormItem>
        <FormItem label="生命周期">
          <Select
            v-model:value="profileForm.lifecycleState"
            :options="lifecycleOptions()"
          />
        </FormItem>
        <FormItem label="苹果开发者账号">
          <Switch
            v-model:checked="profileForm.appleDeveloperRegistered"
            checked-children="已注册"
            un-checked-children="未注册"
          />
        </FormItem>
        <FormItem label="备注">
          <TextArea
            v-model:value="profileForm.managementNote"
            ::maxlength="500"
            placeholder="号码用途或其他管理备注"
            :rows="4"
            show-count
          />
        </FormItem>
      </Form>
    </PopupModal>

    <PopupModal
      v-model:open="balanceOpen"
      :confirm-loading="balanceSubmitting"
      title="修改余额"
      @ok="submitBalance"
    >
      <Form layout="vertical">
        <FormItem label="电话卡">
          <Input
            :value="selectedCard?.phone_number || selectedCard?.iccid"
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
      @ok="submitExpiry"
    >
      <Form layout="vertical">
        <FormItem label="电话卡">
          <Input
            :value="selectedCard?.phone_number || selectedCard?.iccid"
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
      v-model:open="updateOpen"
      :confirm-loading="updateSubmitting"
      title="更新设备卡片信息"
      @ok="submitUpdate"
    >
      <Form layout="vertical">
        <FormItem label="本机号码" required>
          <Input
            v-model:value="updateForm.number"
            placeholder="包含国家码，例如 +852..."
          />
        </FormItem>
        <FormItem label="运营商选择" required>
          <AutoComplete
            v-model:value="updateForm.lock_carrier"
            :options="lockCarrierOptions()"
            placeholder="自动或运营商数字编码"
          />
        </FormItem>
        <FormItem label="号码备注">
          <Input v-model:value="updateForm.note" ::maxlength="8" show-count />
        </FormItem>
        <FormItem label="来电操作" required>
          <Select
            v-model:value="updateForm.call"
            :options="[
              { label: '接听', value: '接听' },
              { label: '挂断', value: '挂断' },
              { label: '无操作', value: '无操作' },
            ]"
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
.quick-filter-panel,
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

.form-tip {
  margin-top: 6px;
  font-size: 12px;
}

.quick-filter-panel {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  align-items: center;
  padding: 0 12px;
  margin-bottom: 8px;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

.quick-filter-tabs {
  flex: 1 1 auto;
  min-width: 0;
}

.quick-filter-tabs :deep(.ant-tabs-nav) {
  margin-bottom: 0;
}

.quick-filter-tabs :deep(.ant-tabs-content-holder) {
  display: none;
}

.quick-extra {
  flex: 0 0 auto;
  padding: 8px 0;
}

.quick-extra-label {
  color: hsl(var(--muted-foreground));
}

.quick-extra-input {
  width: 110px;
}

.filter-bar {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
  padding: 12px;
  margin-bottom: 12px;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

.filter-actions {
  justify-content: flex-end;
}

.cell-edit-button {
  height: auto;
  padding: 0;
}

.inline-cell {
  display: flex;
  gap: 8px;
  align-items: center;
  min-width: 0;
}

.inline-cell-value {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.device-location-cell {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 6px;
  align-items: center;
  min-width: 0;
}

.device-location-cell .cell-edit-button {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.full-width {
  width: 100%;
}

.account-drawer-content {
  margin-top: 16px;
}

.location-cell {
  min-width: 0;
}

.location-cell-main {
  display: flex;
  align-items: center;
  min-width: 0;
}

.location-device-button {
  min-width: 0;
  max-width: 170px;
  height: auto;
  padding: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.drawer-actions {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.muted {
  margin-top: 3px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

@media (max-width: 1400px) {
  .filter-bar {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (max-width: 900px) {
  .filter-bar {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 640px) {
  .page-heading {
    flex-direction: column;
    align-items: flex-start;
  }

  .filter-bar {
    grid-template-columns: 1fr;
  }

  .quick-filter-panel {
    padding: 0 8px;
  }

  .quick-extra {
    padding-bottom: 10px;
  }

  .drawer-actions {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
