<script lang="ts" setup>
import type { Dayjs } from 'dayjs';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type {
  DeveloperAccountDetail,
  DeveloperAccountListItem,
  DeveloperAccountWrite,
  DeveloperCertifier,
  DeveloperCertifierWrite,
  DeveloperDevice,
  DeveloperPlatform,
  DeveloperSubject,
  DeveloperSubjectWrite,
} from '#/api/developer-account';
import type { SystemUser } from '#/api/system/user';

import { computed, reactive, ref } from 'vue';

import { useAccess } from '@vben/access';
import { Page } from '@vben/common-ui';
import { IconifyIcon, Plus, RotateCw } from '@vben/icons';

import {
  Button,
  DatePicker,
  Descriptions,
  DescriptionsItem,
  Drawer,
  Form,
  FormItem,
  Input,
  message,
  Modal,
  Select,
  Space,
  TabPane,
  Tabs,
  Tag,
} from 'antdv-next';
import dayjs from 'dayjs';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { DeveloperAccountApi } from '#/api/developer-account';
import { SystemUserApi } from '#/api/system/user';
import { CredentialSelect } from '#/components/credential';
import { DicLabel, DicSelect } from '#/components/dictionary';
import { BusinessImport } from '#/components/import-export';
import { ReferenceSelect } from '#/components/management';
import { Times } from '#/times';

import { platformOptions, useColumns, useGridFormSchema } from './data';

type FormState = DeveloperAccountWrite & {
  apps_text: string;
  device_model: string;
  device_name: string;
  device_no: string;
  device_serial_number: string;
  device_user: string;
};

const modalOpen = ref(false);
const { hasAccessByCodes } = useAccess();
const canUpdateAccount = computed(() =>
  hasAccessByCodes(['developer-account:update']),
);
const canImportApple = computed(() =>
  hasAccessByCodes(['developer-account:import-apple']),
);
const canManageAccess = computed(() =>
  hasAccessByCodes(['developer_account_access:manage']),
);
const saving = ref(false);
const reindexingSearch = ref(false);
const subjects = ref<DeveloperSubject[]>([]);
const certifiers = ref<DeveloperCertifier[]>([]);
const editing = ref<DeveloperAccountDetail>();
const detail = ref<DeveloperAccountDetail>();
const detailSubject = ref<DeveloperSubject>();
const detailCertifier = ref<DeveloperCertifier>();
const activeEditTab = ref('account');
const form = reactive<FormState>(emptyForm());
const registeredAt = ref<Dayjs>();
const renewalDueAt = ref<Dayjs>();
const smallBusinessAppliedAt = ref<Dayjs>();
const subjectModalOpen = ref(false);
const subjectSaving = ref(false);
const editingSubjectId = ref<number>();
const subjectForm = reactive<DeveloperSubjectWrite>(emptySubjectForm());
const subjectQuickName = ref('');
const subjectQuickSaving = ref(false);
const certifierModalOpen = ref(false);
const certifierSaving = ref(false);
const editingCertifierId = ref<number>();
const certifierForm = reactive<DeveloperCertifierWrite>(emptyCertifierForm());
const certifierQuickName = ref('');
const certifierQuickSaving = ref(false);
const deviceModalOpen = ref(false);
const deviceSaving = ref(false);
const editingDeviceId = ref<number>();
const deviceForm = reactive({
  developer_account_id: 0,
  device_no: '',
  model: '',
  name: '',
  remark: '',
  screenshot_file_id: undefined as number | undefined,
  serial_number: '',
  user: '',
});
const accessDrawerOpen = ref(false);
const accessLoading = ref(false);
const accessSaving = ref(false);
const accessAccount = ref<DeveloperAccountListItem>();
const accessUids = ref<number[]>([]);
const accessUserOptions = ref<{ label: string; value: number }[]>([]);
const selectedFormSubject = computed(() =>
  subjects.value.find((item) => item.id === form.subject_id),
);
const selectedFormCertifier = computed(() =>
  certifiers.value.find((item) => item.id === form.certifier_id),
);

void loadSubjects();
void loadCertifiers();

const [Grid, gridApi] = useVbenVxeGrid<DeveloperAccountListItem>({
  formOptions: { schema: useGridFormSchema(), submitOnChange: true },
  gridOptions: {
    columns: useColumns(),
    height: 'auto',
    pagerConfig: { pageSize: 20, pageSizes: [10, 20, 50, 100] },
    proxyConfig: {
      ajax: {
        query: async ({ page }, values) =>
          DeveloperAccountApi.list({
            keyword: String(values.keyword ?? '').trim() || undefined,
            page: page.currentPage,
            platform: (values.platform || undefined) as
              | DeveloperPlatform
              | undefined,
            size: page.pageSize,
            status: String(values.status ?? '').trim() || undefined,
          }),
      },
    },
    rowConfig: { keyField: 'id' },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<DeveloperAccountListItem>,
});

async function reindexSearch() {
  reindexingSearch.value = true;
  try {
    const result = await DeveloperAccountApi.reindexSearch();
    message.success(`账户搜索索引已重建，共 ${result.indexed} 条`);
    await gridApi.query();
  } finally {
    reindexingSearch.value = false;
  }
}

function emptyForm(): FormState {
  return {
    account: '',
    apps: [],
    apps_text: '',
    certifier_id: undefined,
    credential_code: '',
    device_model: '',
    device_name: '',
    device_no: '',
    device_serial_number: '',
    device_user: '',
    devices: [],
    payment_account: '',
    platform: 'apple',
    registered_at: 0,
    renewal_due_at: 0,
    small_business_applied_at: '',
    small_business_status: '',
    remark: '',
    screen_share_account: '',
    screen_share_ip: '',
    status: '',
    subject_id: undefined,
  };
}

function emptySubjectForm(): DeveloperSubjectWrite {
  return {
    business_license_file_id: undefined,
    certifier_address: '',
    certifier_id_no: '',
    certifier_name: '',
    certifier_phone: '',
    company_address: '',
    country_or_region: '',
    duns: '',
    duns_file_id: undefined,
    enterprise_email: '',
    expected_version: undefined,
    remark: '',
    subject_name_cn: '',
    subject_name_en: '',
    tiktok_us_registered: false,
    unified_social_credit_code: '',
    registration_number: '',
    website: '',
  };
}

function subjectWriteData(value: DeveloperSubjectWrite): DeveloperSubjectWrite {
  return {
    business_license_file_id: value.business_license_file_id,
    certifier_address: value.certifier_address,
    certifier_id_no: value.certifier_id_no,
    certifier_name: value.certifier_name,
    certifier_phone: value.certifier_phone,
    company_address: value.company_address,
    country_or_region: value.country_or_region,
    duns: value.duns,
    duns_file_id: value.duns_file_id,
    enterprise_email: value.enterprise_email,
    expected_version: value.expected_version,
    registration_number: value.registration_number,
    remark: value.remark,
    subject_name_cn: value.subject_name_cn,
    subject_name_en: value.subject_name_en,
    tiktok_us_registered: value.tiktok_us_registered,
    unified_social_credit_code: value.unified_social_credit_code,
    website: value.website,
  };
}

function timestampValue(value: number | undefined) {
  return value && value > 0 ? dayjs.unix(value) : undefined;
}

function dateTimeValue(value: string | undefined) {
  if (!value?.trim()) return undefined;
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed : undefined;
}

function emptyCertifierForm(): DeveloperCertifierWrite {
  return {
    address: '',
    document_file_id: undefined,
    enterprise_email: '',
    id_no: '',
    name: '',
    phone: '',
    remark: '',
  };
}

function certifierWriteData(
  value: DeveloperCertifierWrite,
): DeveloperCertifierWrite {
  return {
    address: value.address,
    document_file_id: value.document_file_id,
    enterprise_email: value.enterprise_email,
    expected_updated_at: value.expected_updated_at,
    id_no: value.id_no,
    name: value.name,
    phone: value.phone,
    remark: value.remark,
  };
}

async function openCreate() {
  await loadSubjects();
  await loadCertifiers();
  editing.value = undefined;
  Object.assign(form, emptyForm());
  registeredAt.value = undefined;
  renewalDueAt.value = undefined;
  smallBusinessAppliedAt.value = undefined;
  activeEditTab.value = 'account';
  modalOpen.value = true;
}

async function loadSubjects() {
  subjects.value = await DeveloperAccountApi.subjects();
}

async function loadCertifiers() {
  certifiers.value = await DeveloperAccountApi.certifiers();
}

async function createSubjectQuick(complete: (value?: number) => void) {
  const name = subjectQuickName.value.trim();
  if (!name) {
    message.warning('请输入主体名称');
    return;
  }
  subjectQuickSaving.value = true;
  try {
    const saved = await DeveloperAccountApi.createSubject({
      ...emptySubjectForm(),
      subject_name_cn: name,
    });
    await loadSubjects();
    complete(saved.id);
    subjectQuickName.value = '';
    message.success('主体已创建并选中');
  } finally {
    subjectQuickSaving.value = false;
  }
}

async function createCertifierQuick(complete: (value?: number) => void) {
  const name = certifierQuickName.value.trim();
  if (!name) {
    message.warning('请输入认证人姓名');
    return;
  }
  certifierQuickSaving.value = true;
  try {
    const saved = await DeveloperAccountApi.createCertifier({
      ...emptyCertifierForm(),
      name,
    });
    await loadCertifiers();
    complete(saved.id);
    certifierQuickName.value = '';
    message.success('认证人已创建并选中');
  } finally {
    certifierQuickSaving.value = false;
  }
}

async function openEdit(
  row: { id: number | string },
  tab: 'account' | 'apps' | 'certifier' | 'devices' = 'account',
) {
  await loadSubjects();
  await loadCertifiers();
  const value = await DeveloperAccountApi.detail(row.id);
  value.devices = await DeveloperAccountApi.appleDevices({
    developer_account_id: Number(row.id),
  });
  editing.value = value;
  const device = value.devices[0] ?? ({} as DeveloperDevice);
  Object.assign(form, value, {
    apps_text: value.apps.join('\n'),
    device_model: device.model ?? '',
    device_name: device.name ?? '',
    device_no: device.device_no ?? '',
    device_serial_number: device.serial_number ?? '',
    device_user: device.user ?? '',
    expected_version: value.version,
  });
  registeredAt.value = timestampValue(value.registered_at);
  renewalDueAt.value = timestampValue(value.renewal_due_at);
  smallBusinessAppliedAt.value = dateTimeValue(value.small_business_applied_at);
  activeEditTab.value = tab;
  modalOpen.value = true;
}

async function openDetailEdit() {
  if (!detail.value) return;
  await openEdit(detail.value);
}

async function openSubjectEdit(target?: DeveloperAccountListItem) {
  const subjectId =
    target?.subject_id ??
    (modalOpen.value ? form.subject_id : undefined) ??
    detail.value?.subject_id ??
    editing.value?.subject_id;
  if (!subjectId) {
    message.info('请先为账户关联主体');
    return;
  }
  const subject =
    (!target && detailSubject.value?.id === subjectId
      ? detailSubject.value
      : undefined) ?? (await DeveloperAccountApi.subject(subjectId));
  editingSubjectId.value = subject.id;
  Object.assign(subjectForm, subject, { expected_version: subject.updated_at });
  subjectModalOpen.value = true;
}

function openSubjectCell(row: DeveloperAccountListItem) {
  return row.subject_id ? openSubjectEdit(row) : openEdit(row);
}

function subjectLabel(row: DeveloperAccountListItem) {
  if (!row.subject_id) return '未关联主体';
  const subject = subjects.value.find((item) => item.id === row.subject_id);
  return subject?.subject_name_cn || `主体 #${row.subject_id}`;
}

async function saveSubject() {
  if (!editingSubjectId.value || !subjectForm.subject_name_cn.trim()) {
    message.error('请输入主体名称');
    return;
  }
  subjectSaving.value = true;
  try {
    await DeveloperAccountApi.updateSubject(
      editingSubjectId.value,
      subjectWriteData(subjectForm),
    );
    const saved = await DeveloperAccountApi.subject(editingSubjectId.value);
    if (detail.value?.subject_id === editingSubjectId.value) {
      detailSubject.value = saved;
    }
    subjectModalOpen.value = false;
    message.success('主体信息已保存');
    await gridApi.query();
  } finally {
    subjectSaving.value = false;
  }
}

function openCertifierCell(row: DeveloperAccountListItem) {
  if (row.certifier_id) {
    return openCertifierEdit(row);
  }
  return openEdit(row, 'certifier');
}

function certifierLabel(row: DeveloperAccountListItem) {
  if (!row.certifier_id) return '未关联认证人';
  const certifier = certifiers.value.find(
    (item) => item.id === row.certifier_id,
  );
  return certifier?.name || `认证人 #${row.certifier_id}`;
}

function certifierPhone(row: DeveloperAccountListItem) {
  if (!row.certifier_id) return '-';
  const certifier = certifiers.value.find(
    (item) => item.id === row.certifier_id,
  );
  return maskPhone(certifier?.phone ?? row.certifier_phone);
}

function maskPhone(value: string | undefined) {
  const phone = value?.trim() ?? '';
  if (phone.length <= 7) return phone || '-';
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
}

async function openCertifierEdit(target?: DeveloperAccountListItem) {
  const certifierId =
    target?.certifier_id ??
    (modalOpen.value ? form.certifier_id : undefined) ??
    detail.value?.certifier_id ??
    editing.value?.certifier_id;
  if (!certifierId) {
    message.info('请先为账户关联认证人');
    return;
  }
  const certifier =
    (!target && detailCertifier.value?.id === certifierId
      ? detailCertifier.value
      : undefined) ?? (await DeveloperAccountApi.certifier(certifierId));
  editingCertifierId.value = certifier.id;
  Object.assign(certifierForm, certifier, {
    expected_updated_at: certifier.updated_at,
  });
  certifierModalOpen.value = true;
}

async function saveCertifier() {
  if (!certifierForm.name.trim()) {
    message.error('请输入认证人姓名');
    return;
  }
  certifierSaving.value = true;
  try {
    const saved = editingCertifierId.value
      ? await DeveloperAccountApi.updateCertifier(
          editingCertifierId.value,
          certifierWriteData(certifierForm),
        )
      : await DeveloperAccountApi.createCertifier(
          certifierWriteData(certifierForm),
        );
    detailCertifier.value = saved;
    form.certifier_id = saved.id;
    await loadCertifiers();
    certifierModalOpen.value = false;
    message.success(
      editingCertifierId.value ? '认证人信息已保存' : '认证人已创建',
    );
    await gridApi.query();
  } finally {
    certifierSaving.value = false;
  }
}

function openDeviceEdit(device?: DeveloperDevice) {
  const accountId = detail.value?.id ?? editing.value?.id;
  if (!accountId) return;
  editingDeviceId.value = device?.id;
  Object.assign(deviceForm, {
    developer_account_id: Number(accountId),
    device_no: device?.device_no ?? '',
    model: device?.model ?? '',
    name: device?.name ?? '',
    remark: device?.remark ?? '',
    screenshot_file_id: device?.screenshot_file_id ?? undefined,
    serial_number: device?.serial_number ?? '',
    user: device?.user ?? '',
  });
  deviceModalOpen.value = true;
}

async function saveDevice() {
  if (!deviceForm.developer_account_id || !deviceForm.device_no.trim()) {
    message.error('请输入设备号');
    return;
  }
  deviceSaving.value = true;
  try {
    const saved = editingDeviceId.value
      ? await DeveloperAccountApi.updateAppleDevice(
          editingDeviceId.value,
          deviceForm,
        )
      : await DeveloperAccountApi.createAppleDevice(deviceForm);
    if (detail.value) {
      detail.value.devices = [
        ...detail.value.devices.filter((item) => item.id !== saved.id),
        saved,
      ];
    }
    deviceModalOpen.value = false;
    message.success('设备信息已保存');
  } finally {
    deviceSaving.value = false;
  }
}

async function showDetail(row: DeveloperAccountListItem) {
  detail.value = await DeveloperAccountApi.detail(row.id);
  detailSubject.value = detail.value.subject_id
    ? await DeveloperAccountApi.subject(detail.value.subject_id)
    : undefined;
  detailCertifier.value = detail.value.certifier_id
    ? await DeveloperAccountApi.certifier(detail.value.certifier_id)
    : undefined;
  const devices = await DeveloperAccountApi.appleDevices({
    developer_account_id: Number(row.id),
  });
  detail.value.devices = devices;
}

async function save() {
  if (!editing.value && !form.account.trim()) {
    message.error('请输入开发者账户');
    return;
  }
  if (!form.credential_code.trim()) {
    message.error('请选择开发者账号密码凭证');
    return;
  }
  saving.value = true;
  try {
    const data: DeveloperAccountWrite = {
      account: form.account,
      apps: form.apps_text
        .split(/[\n,，;；]/)
        .map((value) => value.trim())
        .filter(Boolean),
      certifier_id: form.certifier_id,
      credential_code: form.credential_code,
      // 设备和主体由各自的独立编辑接口维护，账户保存只保留当前关联 ID。
      devices: editing.value?.devices ?? [],
      expected_version: form.expected_version,
      payment_account: form.payment_account,
      platform: form.platform,
      registered_at: registeredAt.value?.unix() ?? 0,
      remark: form.remark,
      renewal_due_at: renewalDueAt.value?.unix() ?? 0,
      screen_share_account: form.screen_share_account,
      screen_share_ip: form.screen_share_ip,
      small_business_applied_at:
        smallBusinessAppliedAt.value?.format('YYYY-MM-DD HH:mm:ss') ?? '',
      small_business_status: form.small_business_status,
      status: form.status,
      subject_id: form.subject_id,
    };
    await (editing.value
      ? DeveloperAccountApi.update(editing.value.id, data)
      : DeveloperAccountApi.create(data));
    if (editing.value && detail.value?.id === editing.value.id) {
      detail.value = await DeveloperAccountApi.detail(editing.value.id);
      detailSubject.value = detail.value.subject_id
        ? await DeveloperAccountApi.subject(detail.value.subject_id)
        : undefined;
      detailCertifier.value = detail.value.certifier_id
        ? await DeveloperAccountApi.certifier(detail.value.certifier_id)
        : undefined;
      detail.value.devices = await DeveloperAccountApi.appleDevices({
        developer_account_id: Number(editing.value.id),
      });
    }
    modalOpen.value = false;
    message.success('开发者账户已保存');
    await gridApi.query();
  } finally {
    saving.value = false;
  }
}

async function onImportCompleted() {
  message.success('Apple 开发者账号导入完成');
  await gridApi.query();
}

async function openAccountAccess(row: DeveloperAccountListItem) {
  accessAccount.value = row;
  accessDrawerOpen.value = true;
  accessLoading.value = true;
  try {
    await loadAccessUserOptions();
    const access = await DeveloperAccountApi.accountAccessUsers(row.id);
    accessUids.value = access.uids;
  } finally {
    accessLoading.value = false;
  }
}

async function saveAccountAccess() {
  if (!accessAccount.value) return;
  accessSaving.value = true;
  try {
    await DeveloperAccountApi.replaceAccountAccessUsers(
      accessAccount.value.id,
      accessUids.value,
    );
    accessDrawerOpen.value = false;
    message.success('账户直接授权已更新');
    await gridApi.query();
  } finally {
    accessSaving.value = false;
  }
}

async function loadAccessUserOptions() {
  if (accessUserOptions.value.length > 0) return;
  const items: SystemUser[] = [];
  let page = 1;
  let total = Number.POSITIVE_INFINITY;
  while (items.length < total) {
    const result = await SystemUserApi.options({ page, pageSize: 100 });
    items.push(...result.items);
    total = result.total;
    if (result.items.length === 0) break;
    page += 1;
  }
  accessUserOptions.value = items.map((item) => ({
    label: `${item.name || item.id}（${item.id}）`,
    value: Number(item.id),
  }));
}
</script>

<template>
  <Page
    auto-content-height
    class="management-page"
    content-class="management-content"
  >
    <Grid class="management-grid" table-title="开发者账户">
      <template #toolbar-tools>
        <Space>
          <Button
            v-access:code="'developer-account:search-reindex'"
            :loading="reindexingSearch"
            @click="reindexSearch"
          >
            <RotateCw class="size-4" />重建搜索索引
          </Button>
          <span v-if="canImportApple">
            <BusinessImport
              button-text="导入 Apple"
              definition-code="developer_account.apple"
              @completed="onImportCompleted"
            />
          </span>
          <Button
            v-access:code="'developer-account:create'"
            type="primary"
            @click="openCreate"
          >
            <Plus class="size-4" />新增账户
          </Button>
        </Space>
      </template>
      <template #account="{ row }">
        <button
          class="cell-action text-left"
          type="button"
          @click="showDetail(row)"
        >
          <div class="font-medium">{{ row.account || '未录入账户' }}</div>
          <div class="text-xs text-muted-foreground">
            {{
              row.platform === 'apple' ? 'Apple Developer' : 'Google Developer'
            }}
          </div>
        </button>
      </template>
      <template #subject="{ row }">
        <button
          v-if="canUpdateAccount"
          class="cell-action"
          type="button"
          @click="openSubjectCell(row)"
        >
          {{ subjectLabel(row) }}
        </button>
        <span v-else>{{ subjectLabel(row) }}</span>
      </template>
      <template #certifierName="{ row }">
        <button
          v-if="canUpdateAccount"
          class="cell-action"
          type="button"
          @click="openCertifierCell(row)"
        >
          {{ certifierLabel(row) }}
        </button>
        <span v-else>{{ certifierLabel(row) }}</span>
      </template>
      <template #certifierPhone="{ row }">
        <button
          v-if="canUpdateAccount"
          class="cell-action"
          type="button"
          @click="openCertifierCell(row)"
        >
          {{ certifierPhone(row) }}
        </button>
        <span v-else>{{ certifierPhone(row) }}</span>
      </template>
      <template #registeredAt="{ row }">
        <button
          v-if="canUpdateAccount"
          class="cell-action"
          type="button"
          @click="openEdit(row)"
        >
          {{ Times.formatOptionalUnix(row.registered_at) }}
        </button>
        <span v-else>{{ Times.formatOptionalUnix(row.registered_at) }}</span>
      </template>
      <template #renewalDueAt="{ row }">
        <button
          v-if="canUpdateAccount"
          class="cell-action"
          type="button"
          @click="openEdit(row)"
        >
          {{ Times.formatOptionalUnix(row.renewal_due_at) }}
        </button>
        <span v-else>{{ Times.formatOptionalUnix(row.renewal_due_at) }}</span>
      </template>
      <template #deviceCount="{ row }">
        <button
          v-if="canUpdateAccount"
          class="cell-action"
          type="button"
          @click="openEdit(row, 'devices')"
        >
          {{ row.device_count }}
        </button>
        <span v-else>{{ row.device_count }}</span>
      </template>
      <template #appCount="{ row }">
        <button
          v-if="canUpdateAccount"
          class="cell-action"
          type="button"
          @click="openEdit(row, 'apps')"
        >
          {{ row.app_count }}
        </button>
        <span v-else>{{ row.app_count }}</span>
      </template>
      <template #accessScope="{ row }">
        <button
          v-if="canManageAccess"
          class="cell-action"
          type="button"
          @click="openAccountAccess(row)"
        >
          {{ row.access_group_count }} 个分组 / {{ row.access_user_count }} 人
        </button>
        <span v-else>
          {{ row.access_group_count }} 个分组 / {{ row.access_user_count }} 人
        </span>
      </template>
      <template #status="{ row }">
        <button v-if="canUpdateAccount" type="button" @click="openEdit(row)">
          <Tag :color="row.status.includes('完成') ? 'success' : 'processing'">
            {{ row.status || '未设置' }}
          </Tag>
        </button>
        <Tag
          v-else
          :color="row.status.includes('完成') ? 'success' : 'processing'"
        >
          {{ row.status || '未设置' }}
        </Tag>
      </template>
    </Grid>

    <Modal
      v-model:open="modalOpen"
      :confirm-loading="saving"
      :title="editing ? '编辑开发者账户' : '新增开发者账户'"
      width="920px"
      @ok="save"
    >
      <Form layout="vertical">
        <Tabs
          v-model:active-key="activeEditTab"
          class="developer-account-edit-tabs"
        >
          <TabPane key="account" tab="账户信息">
            <div class="grid grid-cols-2 gap-x-4">
              <FormItem label="平台" required>
                <Select
                  v-model:value="form.platform"
                  :options="platformOptions"
                />
              </FormItem>
              <FormItem label="开发者账户" :required="!editing">
                <Input v-model:value="form.account" />
              </FormItem>
              <FormItem label="密码凭证" required>
                <CredentialSelect
                  v-model="form.credential_code"
                  create-kind="password"
                  :kinds="['password', 'username_password']"
                  placeholder="选择开发者账号密码凭证"
                  profile="generic"
                />
              </FormItem>
              <FormItem label="关联主体">
                <ReferenceSelect
                  v-model="form.subject_id"
                  :options="
                    subjects.map((item) => ({
                      label: item.subject_name_cn,
                      value: item.id,
                    }))
                  "
                  manage-path="/developer-account/subjects"
                  placeholder="选择主体"
                  show-maintenance
                  @refresh="loadSubjects"
                >
                  <template #maintenance="{ complete }">
                    <Form layout="vertical">
                      <FormItem label="中文主体" required>
                        <Input
                          v-model:value="subjectQuickName"
                          placeholder="例如：示例科技有限公司"
                          @press-enter="createSubjectQuick(complete)"
                        />
                      </FormItem>
                    </Form>
                    <Button
                      block
                      :loading="subjectQuickSaving"
                      type="primary"
                      @click="createSubjectQuick(complete)"
                    >
                      新增并选择
                    </Button>
                  </template>
                </ReferenceSelect>
              </FormItem>
              <FormItem label="关联认证人">
                <ReferenceSelect
                  v-model="form.certifier_id"
                  :options="
                    certifiers.map((item) => ({
                      label: `${item.name}${item.phone ? `（${item.phone}）` : ''}`,
                      value: item.id,
                    }))
                  "
                  manage-path="/developer-account/certifiers"
                  placeholder="选择认证人"
                  show-maintenance
                  @refresh="loadCertifiers"
                >
                  <template #maintenance="{ complete }">
                    <Form layout="vertical">
                      <FormItem label="认证人姓名" required>
                        <Input
                          v-model:value="certifierQuickName"
                          placeholder="输入姓名"
                          @press-enter="createCertifierQuick(complete)"
                        />
                      </FormItem>
                    </Form>
                    <Button
                      block
                      :loading="certifierQuickSaving"
                      type="primary"
                      @click="createCertifierQuick(complete)"
                    >
                      新增并选择
                    </Button>
                  </template>
                </ReferenceSelect>
              </FormItem>
              <FormItem label="账户状态">
                <DicSelect
                  v-model="form.status"
                  :auto-select="false"
                  code="developer_account_status"
                  creatable
                  create-placeholder="输入新账户状态"
                />
              </FormItem>
              <FormItem label="注册时间">
                <DatePicker
                  v-model:value="registeredAt"
                  class="w-full"
                  format="YYYY-MM-DD HH:mm:ss"
                  show-time
                />
              </FormItem>
              <FormItem label="续费时间">
                <DatePicker
                  v-model:value="renewalDueAt"
                  class="w-full"
                  format="YYYY-MM-DD HH:mm:ss"
                  show-time
                />
              </FormItem>
              <FormItem label="小企业状态">
                <DicSelect
                  v-model="form.small_business_status"
                  :auto-select="false"
                  code="developer_account_small_business_status"
                  placeholder="选择小企业状态"
                />
              </FormItem>
              <FormItem label="小企业申请时间">
                <DatePicker
                  v-model:value="smallBusinessAppliedAt"
                  class="w-full"
                  format="YYYY-MM-DD HH:mm:ss"
                  show-time
                />
              </FormItem>
              <FormItem label="屏幕共享 IP">
                <Input v-model:value="form.screen_share_ip" />
              </FormItem>
              <FormItem label="屏幕共享账号">
                <Input v-model:value="form.screen_share_account" />
              </FormItem>
              <FormItem label="收款账户">
                <Input v-model:value="form.payment_account" />
              </FormItem>
            </div>
          </TabPane>
          <TabPane key="subject" tab="主体信息">
            <div class="mb-3 flex justify-end">
              <Button
                :disabled="!form.subject_id"
                type="primary"
                @click="() => openSubjectEdit()"
              >
                编辑主体
              </Button>
            </div>
            <div class="grid grid-cols-2 gap-x-4">
              <FormItem label="中文主体">
                <Input :value="selectedFormSubject?.subject_name_cn" disabled />
              </FormItem>
              <FormItem label="英文主体">
                <Input :value="selectedFormSubject?.subject_name_en" disabled />
              </FormItem>
              <FormItem label="国家或区域">
                <Input
                  :value="selectedFormSubject?.country_or_region"
                  disabled
                />
              </FormItem>
              <FormItem label="公司地址">
                <Input :value="selectedFormSubject?.company_address" disabled />
              </FormItem>
              <FormItem label="D-U-N-S">
                <Input :value="selectedFormSubject?.duns" disabled />
              </FormItem>
            </div>
          </TabPane>
          <TabPane key="certifier" tab="认证人">
            <div class="mb-4 flex items-end gap-3">
              <FormItem class="mb-0 flex-1" label="关联认证人">
                <ReferenceSelect
                  v-model="form.certifier_id"
                  :options="
                    certifiers.map((item) => ({
                      label: `${item.name}${item.phone ? `（${maskPhone(item.phone)}）` : ''}`,
                      value: item.id,
                    }))
                  "
                  manage-path="/developer-account/certifiers"
                  placeholder="选择认证人"
                  show-maintenance
                  @refresh="loadCertifiers"
                >
                  <template #maintenance="{ complete }">
                    <Form layout="vertical">
                      <FormItem label="认证人姓名" required>
                        <Input
                          v-model:value="certifierQuickName"
                          placeholder="输入姓名"
                          @press-enter="createCertifierQuick(complete)"
                        />
                      </FormItem>
                    </Form>
                    <Button
                      block
                      :loading="certifierQuickSaving"
                      type="primary"
                      @click="createCertifierQuick(complete)"
                    >
                      新增并选择
                    </Button>
                  </template>
                </ReferenceSelect>
              </FormItem>
              <Space>
                <Button
                  :disabled="!form.certifier_id"
                  type="primary"
                  @click="() => openCertifierEdit()"
                >
                  编辑认证人
                </Button>
              </Space>
            </div>
            <div class="grid grid-cols-2 gap-x-4">
              <FormItem label="认证人">
                <Input :value="selectedFormCertifier?.name" disabled />
              </FormItem>
              <FormItem label="证件号码">
                <Input :value="selectedFormCertifier?.id_no" disabled />
              </FormItem>
              <FormItem label="认证人地址">
                <Input :value="selectedFormCertifier?.address" disabled />
              </FormItem>
              <FormItem label="认证人电话">
                <Input
                  :value="maskPhone(selectedFormCertifier?.phone)"
                  disabled
                />
              </FormItem>
            </div>
          </TabPane>
          <TabPane key="devices" tab="关联设备">
            <div class="mb-3 flex justify-end">
              <Button type="primary" @click="openDeviceEdit()">新增设备</Button>
            </div>
            <div
              v-for="device in detail?.devices ?? form.devices"
              :key="device.id ?? device.device_no"
              class="mb-3 rounded border p-3"
            >
              <div class="grid grid-cols-2 gap-x-4 text-sm">
                <div>设备号：{{ device.device_no || '-' }}</div>
                <div>名称：{{ device.name || '-' }}</div>
                <div>型号：{{ device.model || '-' }}</div>
                <div>序列号：{{ device.serial_number || '-' }}</div>
                <div>使用人：{{ device.user || '-' }}</div>
                <div>截图文件：{{ device.screenshot_file_id ?? '-' }}</div>
              </div>
              <div class="mt-2 text-right">
                <Button type="link" @click="openDeviceEdit(device)">
                  编辑设备
                </Button>
              </div>
            </div>
            <p
              v-if="!(detail?.devices?.length ?? form.devices.length)"
              class="text-muted-foreground"
            >
              暂无关联设备
            </p>
          </TabPane>
          <TabPane key="apps" tab="APP 列表">
            <FormItem label="APP 名称列表">
              <Input.TextArea
                v-model:value="form.apps_text"
                :rows="8"
                placeholder="一行一个 APP 名称"
              />
            </FormItem>
            <FormItem label="备注">
              <Input.TextArea v-model:value="form.remark" :rows="3" />
            </FormItem>
          </TabPane>
        </Tabs>
      </Form>
    </Modal>

    <Modal
      v-model:open="subjectModalOpen"
      :confirm-loading="subjectSaving"
      title="编辑主体信息"
      width="760px"
      @ok="saveSubject"
    >
      <Form layout="vertical">
        <div class="grid grid-cols-2 gap-x-4">
          <FormItem label="中文主体" required>
            <Input v-model:value="subjectForm.subject_name_cn" />
          </FormItem>
          <FormItem label="英文主体">
            <Input v-model:value="subjectForm.subject_name_en" />
          </FormItem>
          <FormItem label="国家或区域">
            <Input v-model:value="subjectForm.country_or_region" />
          </FormItem>
          <FormItem label="公司地址">
            <Input v-model:value="subjectForm.company_address" />
          </FormItem>
          <FormItem label="D-U-N-S">
            <Input v-model:value="subjectForm.duns" />
          </FormItem>
          <FormItem label="统一社会信用代码">
            <Input v-model:value="subjectForm.unified_social_credit_code" />
          </FormItem>
          <FormItem label="注册编号">
            <Input v-model:value="subjectForm.registration_number" />
          </FormItem>
          <FormItem label="认证人">
            <Input v-model:value="subjectForm.certifier_name" />
          </FormItem>
          <FormItem label="认证人证件号码">
            <Input v-model:value="subjectForm.certifier_id_no" />
          </FormItem>
          <FormItem label="认证人地址">
            <Input v-model:value="subjectForm.certifier_address" />
          </FormItem>
          <FormItem label="认证人电话">
            <Input v-model:value="subjectForm.certifier_phone" />
          </FormItem>
          <FormItem label="企业邮箱">
            <Input v-model:value="subjectForm.enterprise_email" />
          </FormItem>
          <FormItem label="网站">
            <Input v-model:value="subjectForm.website" />
          </FormItem>
        </div>
      </Form>
    </Modal>

    <Modal
      v-model:open="certifierModalOpen"
      :confirm-loading="certifierSaving"
      title="编辑认证人"
      width="680px"
      @ok="saveCertifier"
    >
      <Form layout="vertical">
        <div class="grid grid-cols-2 gap-x-4">
          <FormItem label="认证人姓名" required>
            <Input v-model:value="certifierForm.name" />
          </FormItem>
          <FormItem label="证件号码">
            <Input v-model:value="certifierForm.id_no" />
          </FormItem>
          <FormItem label="手机号">
            <Input v-model:value="certifierForm.phone" />
          </FormItem>
          <FormItem label="企业邮箱">
            <Input v-model:value="certifierForm.enterprise_email" />
          </FormItem>
          <FormItem class="col-span-2" label="地址">
            <Input v-model:value="certifierForm.address" />
          </FormItem>
          <FormItem label="认证资料文件 ID">
            <Input v-model:value="certifierForm.document_file_id" />
          </FormItem>
          <FormItem class="col-span-2" label="备注">
            <Input.TextArea v-model:value="certifierForm.remark" :rows="3" />
          </FormItem>
        </div>
      </Form>
    </Modal>

    <Modal
      v-model:open="deviceModalOpen"
      :confirm-loading="deviceSaving"
      title="编辑认证设备"
      width="620px"
      @ok="saveDevice"
    >
      <Form layout="vertical">
        <div class="grid grid-cols-2 gap-x-4">
          <FormItem label="设备号" required>
            <Input v-model:value="deviceForm.device_no" />
          </FormItem>
          <FormItem label="设备名称">
            <Input v-model:value="deviceForm.name" />
          </FormItem>
          <FormItem label="设备型号">
            <Input v-model:value="deviceForm.model" />
          </FormItem>
          <FormItem label="序列号">
            <Input v-model:value="deviceForm.serial_number" />
          </FormItem>
          <FormItem label="使用人">
            <Input v-model:value="deviceForm.user" />
          </FormItem>
          <FormItem label="截图文件 ID">
            <Input v-model:value="deviceForm.screenshot_file_id" />
          </FormItem>
        </div>
        <FormItem label="备注">
          <Input.TextArea v-model:value="deviceForm.remark" :rows="2" />
        </FormItem>
      </Form>
    </Modal>

    <Drawer
      v-model:open="accessDrawerOpen"
      :loading="accessLoading"
      :size="640"
      :title="`账户授权：${accessAccount?.account || '-'}`"
    >
      <Select
        v-model:value="accessUids"
        class="w-full"
        mode="multiple"
        :options="accessUserOptions"
        placeholder="选择可访问该账户的用户"
        show-search
      />
      <div class="mt-3 text-sm text-muted-foreground">
        已直接授权 {{ accessUids.length }} 个用户
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <Button @click="accessDrawerOpen = false">取消</Button>
          <Button
            v-access:code="'developer_account_access:manage'"
            :loading="accessSaving"
            type="primary"
            @click="saveAccountAccess"
          >
            保存
          </Button>
        </div>
      </template>
    </Drawer>

    <Drawer
      :open="Boolean(detail)"
      title="开发者账户详情"
      :size="760"
      @close="
        detail = undefined;
        detailSubject = undefined;
        detailCertifier = undefined;
      "
    >
      <template #extra>
        <Button
          v-access:code="'developer-account:update'"
          type="primary"
          @click="openDetailEdit"
        >
          <IconifyIcon class="size-4" icon="lucide:edit" />编辑
        </Button>
      </template>
      <Tabs v-if="detail" class="developer-account-detail-tabs">
        <TabPane key="account" tab="账户信息">
          <Descriptions bordered :column="2" size="small">
            <DescriptionsItem label="平台">
              {{ detail.platform }}
            </DescriptionsItem>
            <DescriptionsItem label="开发者账号邮箱">
              {{ detail.account }}
            </DescriptionsItem>
            <DescriptionsItem label="密码凭证">
              {{ detail.credential_code || '-' }}
            </DescriptionsItem>
            <DescriptionsItem label="账户状态">
              {{ detail.status || '-' }}
            </DescriptionsItem>
            <DescriptionsItem label="注册时间">
              {{ Times.formatUnix(detail.registered_at) }}
            </DescriptionsItem>
            <DescriptionsItem label="续费时间">
              {{ Times.formatUnix(detail.renewal_due_at) }}
            </DescriptionsItem>
            <DescriptionsItem label="小企业状态">
              <DicLabel
                code="developer_account_small_business_status"
                :value="detail.small_business_status"
              />
            </DescriptionsItem>
            <DescriptionsItem label="小企业申请时间">
              {{ detail.small_business_applied_at || '-' }}
            </DescriptionsItem>
            <DescriptionsItem label="屏幕共享 IP">
              {{ detail.screen_share_ip || '-' }}
            </DescriptionsItem>
            <DescriptionsItem label="屏幕共享账号">
              {{ detail.screen_share_account || '-' }}
            </DescriptionsItem>
            <DescriptionsItem label="收款账户">
              {{ detail.payment_account || '-' }}
            </DescriptionsItem>
            <DescriptionsItem label="创建时间">
              {{ Times.formatUnix(detail.created_at) }}
            </DescriptionsItem>
            <DescriptionsItem label="更新时间">
              {{ Times.formatUnix(detail.updated_at) }}
            </DescriptionsItem>
            <DescriptionsItem label="创建人">
              {{ detail.created_by }}
            </DescriptionsItem>
            <DescriptionsItem label="版本">
              {{ detail.version }}
            </DescriptionsItem>
            <DescriptionsItem label="备注" :span="2">
              {{ detail.remark || '-' }}
            </DescriptionsItem>
          </Descriptions>
        </TabPane>
        <TabPane key="subject" tab="主体信息">
          <Descriptions bordered :column="2" size="small">
            <DescriptionsItem label="主体 ID">
              {{ detailSubject?.id ?? detail.subject_id ?? '-' }}
            </DescriptionsItem>
            <DescriptionsItem label="中文主体">
              {{ detailSubject?.subject_name_cn || '-' }}
            </DescriptionsItem>
            <DescriptionsItem label="英文主体">
              {{ detailSubject?.subject_name_en || '-' }}
            </DescriptionsItem>
            <DescriptionsItem label="国家或区域">
              {{ detailSubject?.country_or_region || '-' }}
            </DescriptionsItem>
            <DescriptionsItem label="公司地址">
              {{ detailSubject?.company_address || '-' }}
            </DescriptionsItem>
            <DescriptionsItem label="统一社会信用代码">
              {{ detailSubject?.unified_social_credit_code || '-' }}
            </DescriptionsItem>
            <DescriptionsItem label="注册编号">
              {{ detailSubject?.registration_number || '-' }}
            </DescriptionsItem>
            <DescriptionsItem label="D-U-N-S">
              {{ detailSubject?.duns || '-' }}
            </DescriptionsItem>
            <DescriptionsItem label="营业执照文件 ID">
              {{ detailSubject?.business_license_file_id ?? '-' }}
            </DescriptionsItem>
            <DescriptionsItem label="邓白氏文件 ID">
              {{ detailSubject?.duns_file_id ?? '-' }}
            </DescriptionsItem>
            <DescriptionsItem label="企业邮箱">
              {{ detailSubject?.enterprise_email || '-' }}
            </DescriptionsItem>
            <DescriptionsItem label="网站">
              {{ detailSubject?.website || '-' }}
            </DescriptionsItem>
            <DescriptionsItem label="主体备注">
              {{ detailSubject?.remark || '-' }}
            </DescriptionsItem>
          </Descriptions>
        </TabPane>
        <TabPane key="certifier" tab="认证人">
          <Descriptions bordered :column="2" size="small">
            <DescriptionsItem label="认证人 ID">
              {{ detailCertifier?.id ?? detail.certifier_id ?? '-' }}
            </DescriptionsItem>
            <DescriptionsItem label="姓名">
              {{ detailCertifier?.name || '-' }}
            </DescriptionsItem>
            <DescriptionsItem label="证件号码">
              {{ detailCertifier?.id_no || '-' }}
            </DescriptionsItem>
            <DescriptionsItem label="手机号">
              {{ maskPhone(detailCertifier?.phone) }}
            </DescriptionsItem>
            <DescriptionsItem label="企业邮箱">
              {{ detailCertifier?.enterprise_email || '-' }}
            </DescriptionsItem>
            <DescriptionsItem label="认证资料文件 ID">
              {{ detailCertifier?.document_file_id ?? '-' }}
            </DescriptionsItem>
            <DescriptionsItem label="地址" :span="2">
              {{ detailCertifier?.address || '-' }}
            </DescriptionsItem>
            <DescriptionsItem label="备注" :span="2">
              {{ detailCertifier?.remark || '-' }}
            </DescriptionsItem>
          </Descriptions>
        </TabPane>
        <TabPane key="devices" :tab="`关联设备（${detail.devices.length}）`">
          <Descriptions
            v-for="(device, index) in detail.devices"
            :key="`${device.device_no}-${index}`"
            bordered
            :column="2"
            size="small"
            class="mb-4"
          >
            <DescriptionsItem label="设备号">
              {{ device.device_no || '-' }}
            </DescriptionsItem>
            <DescriptionsItem label="设备名称">
              {{ device.name || '-' }}
            </DescriptionsItem>
            <DescriptionsItem label="型号">
              {{ device.model || '-' }}
            </DescriptionsItem>
            <DescriptionsItem label="序列号">
              {{ device.serial_number || '-' }}
            </DescriptionsItem>
            <DescriptionsItem label="使用人">
              {{ device.user || '-' }}
            </DescriptionsItem>
            <DescriptionsItem label="截图文件 ID">
              {{ device.screenshot_file_id ?? '-' }}
            </DescriptionsItem>
          </Descriptions>
          <p v-if="detail.devices.length === 0" class="text-muted-foreground">
            暂无关联设备
          </p>
        </TabPane>
        <TabPane key="apps" :tab="`APP 列表（${detail.apps.length}）`">
          <table v-if="detail.apps.length" class="w-full text-sm">
            <thead>
              <tr class="border-b text-left text-muted-foreground">
                <th class="w-16 px-3 py-2">序号</th>
                <th class="px-3 py-2">APP 名称</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(app, index) in detail.apps"
                :key="app"
                class="border-b last:border-0"
              >
                <td class="px-3 py-2">{{ index + 1 }}</td>
                <td class="px-3 py-2">{{ app }}</td>
              </tr>
            </tbody>
          </table>
          <p v-else class="text-muted-foreground">暂无关联应用</p>
        </TabPane>
      </Tabs>
    </Drawer>
  </Page>
</template>

<style scoped>
.cell-action {
  color: hsl(var(--primary));
  cursor: pointer;
}

.cell-action:hover {
  text-decoration: underline;
}
</style>
