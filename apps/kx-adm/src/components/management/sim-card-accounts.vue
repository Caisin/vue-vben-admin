<script lang="ts" setup>
import type {
  PhoneAccount,
  PhoneAccountFilterOptions,
  PhoneAccountStatus,
  PhoneAccountType,
  UpdatePhoneAccountInput,
} from '#/api/msg';

import { reactive, ref, watch } from 'vue';

import { Settings, X } from '@vben/icons';

import {
  Alert,
  AutoComplete,
  Button,
  Checkbox,
  Form,
  FormItem,
  Input,
  InputPassword,
  message,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  TextArea,
  Tooltip,
} from 'antdv-next';

import { PhoneAccountApi } from '#/api/msg';
import { DicLabel, DicSelect } from '#/components/dictionary';
import { StatusTag } from '#/components/management';
import { displayValue } from '#/management';

const props = defineProps<{ phoneNumber: string }>();

const filterOptions = ref<PhoneAccountFilterOptions>({
  platforms: [],
  purposes: [],
  statuses: [],
  types: [],
});
const loading = ref(false);
const submitting = ref(false);
const accounts = ref<PhoneAccount[]>([]);
const modalOpen = ref(false);
const editing = ref<null | PhoneAccount>(null);
const form = reactive({
  accountName: '',
  accountType: 'email' as PhoneAccountType,
  clearPassword: false,
  loginUrl: '',
  note: '',
  password: '',
  platform: '',
  purpose: '',
  status: 'active' as PhoneAccountStatus,
});

const columns = [
  { dataIndex: 'purpose', key: 'purpose', title: '业务用途', width: 160 },
  { dataIndex: 'account_type', key: 'account_type', title: '类型', width: 90 },
  { dataIndex: 'platform', key: 'platform', title: '平台', width: 130 },
  { dataIndex: 'account_name', key: 'account_name', title: '账号', width: 200 },
  { dataIndex: 'login_url', key: 'login_url', title: '登录入口', width: 220 },
  { dataIndex: 'status', key: 'status', title: '状态', width: 90 },
  { dataIndex: 'note', key: 'note', title: '备注', width: 180 },
  { key: 'actions', title: '操作', width: 80, fixed: 'right' as const },
];

function textSelectOptions(values: string[]) {
  return values.map((value) => ({ label: value, value }));
}

function statusOptions() {
  return filterOptions.value.statuses.length > 0
    ? filterOptions.value.statuses
    : [
        { label: '启用', value: 'active' as PhoneAccountStatus },
        { label: '停用', value: 'disabled' as PhoneAccountStatus },
      ];
}

async function loadFilterOptions() {
  filterOptions.value = await PhoneAccountApi.filterOptions();
}

async function loadAccounts() {
  if (!props.phoneNumber.trim()) {
    accounts.value = [];
    return;
  }
  loading.value = true;
  try {
    const result = await PhoneAccountApi.list({
      page: 1,
      size: 200,
      phone_number: props.phoneNumber,
    });
    accounts.value = result.items;
  } finally {
    loading.value = false;
  }
}

function resetForm() {
  Object.assign(form, {
    accountName: '',
    accountType: 'email',
    clearPassword: false,
    loginUrl: '',
    note: '',
    password: '',
    platform: '',
    purpose: '',
    status: 'active',
  });
}

function openCreate() {
  if (!props.phoneNumber.trim()) {
    message.warning('请先补充电话卡号码');
    return;
  }
  editing.value = null;
  resetForm();
  modalOpen.value = true;
}

function openEdit(account: PhoneAccount) {
  editing.value = account;
  Object.assign(form, {
    accountName: account.account_name,
    accountType: account.account_type,
    clearPassword: false,
    loginUrl: account.login_url,
    note: account.note,
    password: '',
    platform: account.platform,
    purpose: account.purpose,
    status: account.status,
  });
  modalOpen.value = true;
}

async function submit() {
  if (
    !props.phoneNumber.trim() ||
    !form.accountType?.trim() ||
    !form.purpose.trim() ||
    !form.platform.trim() ||
    !form.accountName.trim()
  ) {
    message.warning('请填写账号类型、用途、平台和账号');
    return;
  }
  const common = {
    account_name: form.accountName.trim(),
    account_type: form.accountType,
    login_url: form.loginUrl.trim(),
    note: form.note.trim(),
    password: form.password || undefined,
    phone_number: props.phoneNumber,
    platform: form.platform.trim(),
    purpose: form.purpose.trim(),
    status: form.status,
  };
  submitting.value = true;
  try {
    if (editing.value) {
      await PhoneAccountApi.update(editing.value.account_key, {
        ...common,
        clear_password: form.clearPassword,
      } satisfies UpdatePhoneAccountInput);
      message.success('关联账号已更新');
    } else {
      await PhoneAccountApi.create(common);
      message.success('关联账号已创建');
    }
    modalOpen.value = false;
    await loadAccounts();
  } finally {
    submitting.value = false;
  }
}

async function remove(account: PhoneAccount) {
  await PhoneAccountApi.remove(account.account_key);
  message.success('关联账号已删除');
  await loadAccounts();
}

watch(
  () => props.phoneNumber,
  async () => {
    await loadFilterOptions();
    await loadAccounts();
  },
  { immediate: true },
);
</script>

<template>
  <div v-access:code="'phone_accounts:view'">
    <div v-access:code="'phone_accounts:manage'" class="account-toolbar">
      <Button
        :disabled="!phoneNumber.trim()"
        type="primary"
        @click="openCreate"
      >
        新增账号
      </Button>
    </div>
    <Table
      :columns="columns"
      :data-source="accounts"
      :loading="loading"
      :pagination="false"
      row-key="account_key"
      :scroll="{ x: 1230 }"
      size="small"
    >
      <template #bodyCell="{ column, record }">
        <Tag
          v-if="column.key === 'account_type'"
          :color="record.account_type === 'email' ? 'blue' : 'cyan'"
        >
          <DicLabel
            code="msg_phone_account_type"
            :value="record.account_type"
          />
        </Tag>
        <DicLabel
          v-else-if="column.key === 'platform'"
          code="msg_phone_account_platform"
          :value="record.platform"
        />
        <a
          v-else-if="column.key === 'login_url' && record.login_url"
          :href="record.login_url"
          rel="noopener noreferrer"
          target="_blank"
        >
          {{ record.login_url }}
        </a>
        <span v-else-if="column.key === 'login_url'">
          {{ displayValue(record.login_url) }}
        </span>
        <StatusTag
          v-else-if="column.key === 'status'"
          :status="record.status"
        />
        <Space
          v-else-if="column.key === 'actions'"
          v-access:code="'phone_accounts:manage'"
          :size="0"
        >
          <Tooltip title="编辑账号">
            <Button
              aria-label="编辑账号"
              size="small"
              type="text"
              @click="openEdit(record)"
            >
              <template #icon><Settings /></template>
            </Button>
          </Tooltip>
          <Tooltip title="删除账号">
            <Popconfirm
              :title="`确认删除 ${record.platform} 的账号记录？`"
              cancel-text="取消"
              ok-text="删除"
              @confirm="remove(record)"
            >
              <Button aria-label="删除账号" danger size="small" type="text">
                <template #icon><X /></template>
              </Button>
            </Popconfirm>
          </Tooltip>
        </Space>
      </template>
    </Table>

    <Modal
      v-model:open="modalOpen"
      :confirm-loading="submitting"
      :title="editing ? '编辑关联账号' : '新增关联账号'"
      width="min(760px, calc(100vw - 24px))"
      @ok="submit"
    >
      <Alert
        v-if="editing?.password_set"
        class="form-alert"
        message="密码留空会保留原值；勾选清空后将删除已保存密码。"
        show-icon
        type="warning"
      />
      <Form layout="vertical">
        <div class="form-grid">
          <FormItem label="电话号码" required>
            <Input :value="phoneNumber" disabled />
          </FormItem>
          <FormItem label="业务用途" required>
            <AutoComplete
              v-model:value="form.purpose"
              ::maxlength="200"
              :options="textSelectOptions(filterOptions.purposes)"
              placeholder="例如 注册客服邮箱"
            />
          </FormItem>
          <FormItem label="账号类型" required>
            <DicSelect
              v-model="form.accountType"
              code="msg_phone_account_type"
              creatable
              create-placeholder="输入新账号类型"
              placeholder="请选择账号类型"
            />
          </FormItem>
          <FormItem label="平台" required>
            <DicSelect
              v-model="form.platform"
              code="msg_phone_account_platform"
              creatable
              create-placeholder="输入新平台名称"
              placeholder="请选择平台"
            />
          </FormItem>
          <FormItem label="账号" required>
            <Input
              v-model:value="form.accountName"
              ::maxlength="320"
              placeholder="邮箱地址或用户名"
            />
          </FormItem>
          <FormItem label="状态" required>
            <Select v-model:value="form.status" :options="statusOptions()" />
          </FormItem>
        </div>
        <FormItem label="登录地址">
          <Input
            v-model:value="form.loginUrl"
            placeholder="https://accounts.example.com/"
          />
        </FormItem>
        <FormItem label="密码">
          <InputPassword
            v-model:value="form.password"
            autocomplete="new-password"
            placeholder="留空表示不设置或保留原密码"
          />
        </FormItem>
        <Checkbox
          v-if="editing?.password_set"
          v-model:checked="form.clearPassword"
          class="clear-password"
        >
          清空已保存密码
        </Checkbox>
        <FormItem label="备注">
          <TextArea
            v-model:value="form.note"
            ::maxlength="2000"
            :rows="4"
            show-count
          />
        </FormItem>
      </Form>
    </Modal>
  </div>
</template>

<style scoped>
.account-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
  margin-bottom: 12px;
}

.form-alert {
  margin-bottom: 14px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 16px;
}

.clear-password {
  margin: -8px 0 16px;
}

@media (max-width: 640px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
