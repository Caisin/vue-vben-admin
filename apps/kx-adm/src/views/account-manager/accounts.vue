<script setup lang="ts">
import type {
  AccountDetail,
  AccountType,
  FieldValue,
  ManagedAccount,
} from '#/api/account-manager';

import {
  computed,
  onBeforeUnmount,
  onDeactivated,
  onMounted,
  reactive,
  ref,
} from 'vue';

import { useAccess } from '@vben/access';
import { Page } from '@vben/common-ui';

import {
  Alert,
  Button,
  Descriptions,
  DescriptionsItem,
  Form,
  FormItem,
  Input,
  message,
  Modal,
  Select,
  Space,
  Table,
  Tag,
} from 'antdv-next';

import { AccountManagerApi } from '#/api/account-manager';
import { Times } from '#/times';

import { accountError } from './data';
import CredentialReference from './modules/credential-reference.vue';
import DynamicFields from './modules/dynamic-fields.vue';
import Reveal from './modules/reveal.vue';

const { hasAccessByCodes } = useAccess();
const canWrite = computed(() => hasAccessByCodes(['account-manager:write']));
const canReveal = computed(() => hasAccessByCodes(['account-manager:reveal']));
const types = ref<AccountType[]>([]);
const rows = ref<ManagedAccount[]>([]);
const loading = ref(false);
const saving = ref(false);
const open = ref(false);
const errorMessage = ref('');
const pageError = ref('');
const keyword = ref('');
const typeFilter = ref<number>();
const editing = ref<AccountDetail>();
const details = ref<AccountDetail>();
const selectedType = ref<AccountType>();
const secretViewer = ref<{
  show: (id: number, key: string, label: string) => void;
}>();
const name = ref('');
const values = ref<Record<string, FieldValue>>({});
const pagination = reactive({ current: 1, pageSize: 20, total: 0 });
const typeOptions = computed(() =>
  types.value.map((type) => ({ label: type.name, value: type.id })),
);
const columns = [
  { dataIndex: 'name', title: '账户名称' },
  { key: 'type', title: '账户类型' },
  { key: 'updated', title: '更新时间' },
  { key: 'actions', title: '操作', width: 180 },
];
async function load(reset = false) {
  if (reset) pagination.current = 1;
  loading.value = true;
  pageError.value = '';
  try {
    const result = await AccountManagerApi.list({
      page: pagination.current,
      size: pagination.pageSize,
      type_id: typeFilter.value,
      keyword: keyword.value.trim() || undefined,
    });
    rows.value = result.items;
    pagination.total = result.total;
  } catch (error) {
    pageError.value = accountError(error);
  } finally {
    loading.value = false;
  }
}
async function loadTypes() {
  types.value = await AccountManagerApi.types();
}
function initialFieldValues(
  type?: AccountType,
  initial: Record<string, FieldValue> = {},
) {
  const result = { ...initial };
  for (const field of type?.fields ?? []) {
    if (
      field.enabled &&
      field.kind === 'boolean' &&
      result[field.key] === undefined
    )
      result[field.key] = false;
  }
  return result;
}
async function create() {
  try {
    await loadTypes();
  } catch (error) {
    pageError.value = accountError(error);
    return;
  }
  editing.value = undefined;
  name.value = '';
  errorMessage.value = '';
  selectedType.value = types.value.find((type) => type.enabled);
  values.value = initialFieldValues(selectedType.value);
  open.value = true;
}
async function edit(row: ManagedAccount) {
  try {
    editing.value = await AccountManagerApi.detail(row.id);
    selectedType.value = editing.value.account_type;
    name.value = editing.value.name;
    values.value = initialFieldValues(
      selectedType.value,
      Object.fromEntries(
        Object.entries(editing.value.values).filter(([key]) =>
          selectedType.value?.fields.some((f) => f.key === key && f.enabled),
        ),
      ),
    );
    errorMessage.value = '';
    open.value = true;
  } catch (error) {
    pageError.value = accountError(error);
  }
}
function changeType(id: unknown) {
  selectedType.value = types.value.find((type) => type.id === id);
  values.value = initialFieldValues(selectedType.value);
}
async function save() {
  if (!selectedType.value || !canWrite.value) return;
  saving.value = true;
  errorMessage.value = '';
  try {
    const data = {
      name: name.value,
      type_id: selectedType.value.id,
      type_version: selectedType.value.version,
      values: values.value,
      expected_version: editing.value?.version,
    };
    const updated = editing.value
      ? await AccountManagerApi.update(editing.value.id, data)
      : await AccountManagerApi.create(data);
    if (details.value?.id === updated.id) details.value = updated;
    values.value = {};
    open.value = false;
    message.success('账户已保存');
    await load();
  } catch (error) {
    errorMessage.value = accountError(error);
  } finally {
    saving.value = false;
  }
}
async function show(row: ManagedAccount) {
  try {
    details.value = await AccountManagerApi.detail(row.id);
  } catch (error) {
    pageError.value = accountError(error);
  }
}
function remove(row: ManagedAccount) {
  Modal.confirm({
    title: '删除账户',
    content: `确认删除“${row.name}”账户档案？`,
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    async onOk() {
      try {
        await AccountManagerApi.remove(row.id, row.version);
        if (details.value?.id === row.id) details.value = undefined;
        message.success('账户已删除');
        await load();
      } catch (error) {
        pageError.value = accountError(error);
        throw error;
      }
    },
  });
}
function display(value: FieldValue | undefined) {
  if (value === true) return '是';
  if (value === false) return '否';
  return value ?? '未填写';
}
function clearPrivateForms() {
  values.value = {};
  details.value = undefined;
  open.value = false;
}
onBeforeUnmount(clearPrivateForms);
onDeactivated(clearPrivateForms);
onMounted(async () => {
  try {
    await loadTypes();
    await load();
  } catch (error) {
    pageError.value = accountError(error);
  }
});
</script>
<template>
  <Page title="账户管理">
    <Space class="mb-4" wrap>
      <Input
        v-model:value="keyword"
        aria-label="搜索账户"
        placeholder="搜索账户名称或普通字段"
        allow-clear
        @press-enter="load(true)"
      />
      <Select
        v-model:value="typeFilter"
        class="min-w-48"
        :options="typeOptions"
        placeholder="全部账户类型"
        allow-clear
        @change="load(true)"
      />
      <Button @click="load(true)">查询</Button>
      <Button :loading="loading" @click="load()">刷新</Button>
      <Button v-if="canWrite" type="primary" @click="create">新增账户</Button>
    </Space>
    <Alert
      v-if="!canWrite"
      class="mb-3"
      message="当前仅有查看权限。新增、编辑和删除账户需要“管理账户”权限，授权后刷新页面即可生效。"
      type="info"
      show-icon
    />
    <Alert
      v-if="pageError"
      class="mb-3"
      :message="pageError"
      type="error"
      show-icon
    />
    <Table
      :columns="columns"
      :data-source="rows"
      :loading="loading"
      :pagination="pagination"
      row-key="id"
      :scroll="{ x: 700 }"
      @change="
        (page) => {
          pagination.current = page.current ?? 1;
          pagination.pageSize = page.pageSize ?? 20;
          load();
        }
      "
    >
      <template #bodyCell="{ column, record }">
        <span v-if="column.key === 'type'">{{
          types.find((type) => type.id === record.type_id)?.name ?? '未知类型'
        }}</span>
        <span v-else-if="column.key === 'updated'">{{
          Times.formatUnix(record.updated_at)
        }}</span>
        <Space v-else-if="column.key === 'actions'">
          <Button type="link" @click="show(record)">详情</Button>
          <Button v-if="canWrite" type="link" @click="edit(record)">
            编辑
          </Button>
          <Button v-if="canWrite" type="link" danger @click="remove(record)">
            删除
          </Button>
        </Space>
      </template>
    </Table>
    <Modal
      v-model:open="open"
      :title="editing ? '编辑账户' : '新增账户'"
      width="min(960px, calc(100vw - 32px))"
      :confirm-loading="saving"
      @ok="save"
      @cancel="values = {}"
    >
      <Form layout="vertical">
        <FormItem label="账户名称" required>
          <Input
            v-model:value="name"
            aria-label="账户名称"
            placeholder="例如 Stripe 美国公司账户"
          />
        </FormItem>
        <FormItem label="账户类型" required>
          <Select
            :value="selectedType?.id"
            :disabled="!!editing"
            :options="
              types
                .filter((type) => type.enabled || type.id === editing?.type_id)
                .map((type) => ({ label: type.name, value: type.id }))
            "
            @update:value="changeType"
          />
        </FormItem>
        <Alert
          v-if="!selectedType"
          type="info"
          message="请先在账户类型页面创建并启用账户类型。"
          show-icon
        />
        <DynamicFields
          v-else
          v-model="values"
          :fields="selectedType.fields"
          :configured-secrets="editing?.configured_secrets ?? []"
        />
        <Alert
          v-if="errorMessage"
          :message="errorMessage"
          type="error"
          show-icon
        />
      </Form>
    </Modal>
    <Modal
      :open="!!details"
      title="账户详情"
      :width="680"
      :footer="null"
      @cancel="details = undefined"
    >
      <template v-if="details">
        <Descriptions :column="1" bordered>
          <DescriptionsItem label="账户名称">
            {{ details.name }}
          </DescriptionsItem>
          <DescriptionsItem label="账户类型">
            {{ details.account_type.name }}
          </DescriptionsItem>
          <DescriptionsItem
            v-for="field in details.account_type.fields"
            :key="field.key"
            :label="field.label"
          >
            <Tag v-if="!field.enabled">已停用</Tag>
            <template v-if="field.sensitive">
              <span>{{
                details.configured_secrets.includes(field.key)
                  ? '已设置'
                  : '未设置'
              }}</span>
              <Button
                v-if="
                  canReveal && details.configured_secrets.includes(field.key)
                "
                type="link"
                @click="secretViewer?.show(details.id, field.key, field.label)"
              >
                查看{{ field.label }}
              </Button>
            </template>
            <CredentialReference
              v-else-if="field.kind === 'credential'"
              :code="
                typeof details.values[field.key] === 'string'
                  ? String(details.values[field.key])
                  : ''
              "
            />
            <span v-else class="break-all whitespace-pre-wrap">{{
              display(details.values[field.key])
            }}</span>
          </DescriptionsItem>
        </Descriptions>
      </template>
    </Modal>
    <Reveal ref="secretViewer" />
  </Page>
</template>
