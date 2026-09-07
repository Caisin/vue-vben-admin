<script lang="ts" setup>
import type {
  AppleDevice,
  DeveloperAccountListItem,
} from '#/api/developer-account';

import { computed, onMounted, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { ArrowUpToLine, createIconifyIcon, Plus, X } from '@vben/icons';

import {
  Button,
  Form,
  FormItem,
  Input,
  message,
  Modal,
  Select,
  Space,
  Table,
  Tooltip,
  Upload,
} from 'antdv-next';

import { DeveloperAccountApi } from '#/api/developer-account';
import { FileRefPreview } from '#/components/file-picker';
import { BusinessImport } from '#/components/import-export';
import { Times } from '#/times';

const rows = ref<AppleDevice[]>([]);
const RefreshCw = createIconifyIcon('lucide:refresh-cw');
const accounts = ref<DeveloperAccountListItem[]>([]);
const loading = ref(false);
const keyword = ref('');
const accountId = ref<number>();
const pagination = reactive({
  current: 1,
  pageSize: 10,
  showSizeChanger: true,
});
let generation = 0;
const saving = ref(false);
const screenshotUploading = ref(false);
const open = ref(false);
const editingId = ref<number>();
const previewFileId = ref<number>();
const form = reactive({
  developer_account_id: undefined as number | undefined,
  device_no: '',
  name: '',
  model: '',
  serial_number: '',
  screenshot_file_id: undefined as number | undefined,
  user: '',
  remark: '',
});

const columns = [
  { dataIndex: 'device_no', title: '设备号' },
  { dataIndex: 'developer_account_id', title: '开发者账户' },
  { dataIndex: 'name', title: '名称' },
  { dataIndex: 'model', title: '型号' },
  { dataIndex: 'serial_number', title: '序列号' },
  { dataIndex: 'user', title: '使用者' },
  { dataIndex: 'screenshot_file_id', title: '截图', width: 220 },
  { dataIndex: 'updated_at', title: '更新时间' },
  { key: 'actions', title: '操作' },
];

const accountOptions = computed(() =>
  accounts.value.map((item) => ({
    label: developerAccountLabel(item),
    value: Number(item.id),
  })),
);

function developerAccountLabel(item: DeveloperAccountListItem) {
  const account = item.account.trim();
  const subject = item.subject_name_cn.trim();
  if (account && subject) return `${account} · ${subject}`;
  if (account) return account;
  if (subject) return `未录入账号 · ${subject}`;
  return `账户 #${item.id}`;
}

function accountLabelById(id?: null | number) {
  if (!id) return '未关联';
  const account = accounts.value.find((item) => Number(item.id) === id);
  return account ? developerAccountLabel(account) : '未关联';
}

async function refresh() {
  const version = ++generation;
  loading.value = true;
  try {
    const [deviceRows, accountPage] = await Promise.all([
      DeveloperAccountApi.appleDevices({
        keyword: keyword.value.trim() || undefined,
        developer_account_id: accountId.value,
      }),
      DeveloperAccountApi.list({ page: 1, size: 1000 }),
    ]);
    if (version !== generation) return;
    rows.value = deviceRows;
    accounts.value = accountPage.items;
    pagination.current = Math.min(
      pagination.current,
      Math.max(1, Math.ceil(deviceRows.length / pagination.pageSize)),
    );
  } finally {
    if (version === generation) loading.value = false;
  }
}

function search() {
  pagination.current = 1;
  return refresh();
}

function resetForm() {
  Object.assign(form, {
    developer_account_id: undefined,
    device_no: '',
    name: '',
    model: '',
    serial_number: '',
    screenshot_file_id: undefined,
    user: '',
    remark: '',
  });
}

function openCreate() {
  editingId.value = undefined;
  resetForm();
  open.value = true;
}

function openEdit(row: AppleDevice) {
  editingId.value = row.id;
  Object.assign(form, {
    developer_account_id: row.developer_account_id || undefined,
    device_no: row.device_no,
    name: row.name,
    model: row.model,
    serial_number: row.serial_number,
    screenshot_file_id: row.screenshot_file_id ?? undefined,
    user: row.user,
    remark: row.remark,
  });
  open.value = true;
}

async function save() {
  if (!form.device_no.trim()) {
    message.error('请填写设备号');
    return;
  }
  saving.value = true;
  try {
    await (editingId.value
      ? DeveloperAccountApi.updateAppleDevice(editingId.value, {
          ...form,
          developer_account_id: form.developer_account_id ?? null,
        })
      : DeveloperAccountApi.createAppleDevice({
          ...form,
          developer_account_id: form.developer_account_id ?? null,
        }));
    open.value = false;
    message.success('设备已保存');
    await refresh();
  } finally {
    saving.value = false;
  }
}

async function uploadScreenshot(file: File) {
  screenshotUploading.value = true;
  try {
    const uploaded =
      await DeveloperAccountApi.uploadAppleDeviceScreenshot(file);
    form.screenshot_file_id = Number(uploaded.file.file_id);
    message.success('设备截图已上传');
  } finally {
    screenshotUploading.value = false;
  }
  return false;
}

function remove(row: AppleDevice) {
  Modal.confirm({
    title: '删除设备资产',
    content: row.device_no,
    okButtonProps: { danger: true },
    onOk: async () => {
      await DeveloperAccountApi.removeAppleDevice(row.id);
      message.success('设备已删除');
      await refresh();
    },
  });
}

onMounted(refresh);
</script>

<template>
  <Page auto-content-height class="management-page">
    <div class="device-toolbar">
      <Input.Search
        v-model:value="keyword"
        class="device-search"
        aria-label="搜索设备资产"
        placeholder="设备号、名称、序列号、使用者"
        allow-clear
        @search="search"
      />
      <label for="apple-device-account-filter" class="sr-only">筛选开发者账户</label>
      <Select
        id="apple-device-account-filter"
        v-model:value="accountId"
        class="account-filter"
        aria-label="筛选开发者账户"
        placeholder="全部开发者账户"
        :options="accountOptions"
        allow-clear
        show-search
        option-filter-prop="label"
        @change="search"
      />
      <Space wrap class="device-actions">
        <Tooltip title="刷新">
          <Button aria-label="刷新设备资产" @click="refresh">
            <RefreshCw class="size-4" />
          </Button>
        </Tooltip>
        <span v-access:code="'developer-account:apple-device-import'">
          <BusinessImport
            button-text="导入设备"
            definition-code="developer_account.apple_device"
            @completed="refresh"
          />
        </span>
        <Button
          v-access:code="'developer-account:apple-device-create'"
          type="primary"
          @click="openCreate"
        >
          <Plus class="size-4" />新增设备
        </Button>
      </Space>
    </div>
    <Table
      :columns="columns"
      :data-source="rows"
      :loading="loading"
      :pagination="pagination"
      :scroll="{ x: 1200 }"
      row-key="id"
      @change="
        (page) => {
          pagination.current = page.current ?? 1;
          pagination.pageSize = page.pageSize ?? 10;
        }
      "
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'developer_account_id'">
          {{ accountLabelById(record.developer_account_id) }}
        </template>
        <template v-else-if="column.dataIndex === 'screenshot_file_id'">
          <Button
            v-if="record.screenshot_file_id"
            type="link"
            @click="previewFileId = record.screenshot_file_id"
          >
            查看
          </Button>
          <span v-else>-</span>
        </template>
        <template v-else-if="column.dataIndex === 'updated_at'">
          {{ Times.formatOptionalUnix(record.updated_at) }}
        </template>
        <template v-else-if="column.key === 'actions'">
          <Button
            v-access:code="'developer-account:apple-device-update'"
            type="link"
            @click="openEdit(record)"
          >
            编辑
          </Button>
          <Button
            v-access:code="'developer-account:apple-device-delete'"
            danger
            type="link"
            @click="remove(record)"
          >
            删除
          </Button>
        </template>
      </template>
    </Table>

    <Modal
      :footer="null"
      :open="Boolean(previewFileId)"
      title="设备截图"
      @cancel="previewFileId = undefined"
    >
      <FileRefPreview v-if="previewFileId" :value="previewFileId" />
    </Modal>

    <Modal
      v-model:open="open"
      :confirm-loading="saving"
      title="Apple 设备资产"
      @ok="save"
    >
      <Form layout="vertical">
        <FormItem label="开发者账号">
          <Select
            v-model:value="form.developer_account_id"
            allow-clear
            :options="accountOptions"
            option-filter-prop="label"
            placeholder="可选，留空表示未关联"
            show-search
          />
        </FormItem>
        <FormItem label="设备号" required>
          <Input v-model:value="form.device_no" />
        </FormItem>
        <FormItem label="设备名称">
          <Input v-model:value="form.name" />
        </FormItem>
        <FormItem label="型号">
          <Input v-model:value="form.model" />
        </FormItem>
        <FormItem label="序列号">
          <Input v-model:value="form.serial_number" />
        </FormItem>
        <FormItem label="使用者">
          <Input v-model:value="form.user" />
        </FormItem>
        <FormItem label="设备号截图">
          <div class="grid gap-3">
            <FileRefPreview
              v-if="form.screenshot_file_id"
              :value="form.screenshot_file_id"
            />
            <Space>
              <Upload
                accept="image/*,.heic"
                :before-upload="uploadScreenshot"
                :file-list="[]"
                :max-count="1"
              >
                <Button :loading="screenshotUploading">
                  <template #icon><ArrowUpToLine /></template>
                  {{ form.screenshot_file_id ? '替换截图' : '上传截图' }}
                </Button>
              </Upload>
              <Button
                v-if="form.screenshot_file_id"
                danger
                @click="form.screenshot_file_id = undefined"
              >
                <template #icon><X /></template>
                清空
              </Button>
            </Space>
          </div>
        </FormItem>
        <FormItem label="备注">
          <Input.TextArea v-model:value="form.remark" :rows="2" />
        </FormItem>
      </Form>
    </Modal>
  </Page>
</template>

<style scoped>
.device-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 12px;
}

.device-search {
  width: 360px;
  max-width: 100%;
}

.account-filter {
  width: 260px;
  max-width: 100%;
}

.device-actions {
  margin-left: auto;
}

@media (max-width: 640px) {
  .device-search,
  .account-filter {
    width: 100%;
  }
}
</style>
