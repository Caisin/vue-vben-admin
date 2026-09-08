<script setup lang="ts">
import type { AccountField, AccountType } from '#/api/account-manager';

import { computed, onMounted, reactive, ref } from 'vue';

import { useAccess } from '@vben/access';
import { Page } from '@vben/common-ui';

import {
  Alert,
  Button,
  Checkbox,
  Form,
  FormItem,
  Input,
  message,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  TextArea,
} from 'antdv-next';

import { AccountManagerApi } from '#/api/account-manager';

import { accountError, fieldKinds } from './data';

type FieldDraft = AccountField & { optionsText: string };
const { hasAccessByCodes } = useAccess();
const canWrite = computed(() =>
  hasAccessByCodes(['account-manager:type-write']),
);
const rows = ref<AccountType[]>([]);
const loading = ref(false);
const saving = ref(false);
const open = ref(false);
const errorMessage = ref('');
const pageError = ref('');
const editing = ref<AccountType>();
const form = reactive({
  code: '',
  name: '',
  enabled: true,
  fields: [] as FieldDraft[],
});
const locked = computed(
  () => new Set(editing.value?.fields.map((field) => field.key)),
);
const columns = [
  { dataIndex: 'name', title: '账户类型' },
  { dataIndex: 'code', title: '编码' },
  { key: 'fields', title: '字段' },
  { key: 'enabled', title: '状态' },
  { key: 'actions', title: '操作' },
];
async function load() {
  loading.value = true;
  pageError.value = '';
  try {
    rows.value = await AccountManagerApi.types();
  } catch (error) {
    pageError.value = accountError(error);
  } finally {
    loading.value = false;
  }
}
function edit(row?: AccountType) {
  editing.value = row;
  errorMessage.value = '';
  Object.assign(form, {
    code: row?.code ?? '',
    name: row?.name ?? '',
    enabled: row?.enabled ?? true,
    fields:
      row?.fields.map((field) => ({
        ...field,
        options: [...field.options],
        optionsText: field.options.join('\n'),
      })) ?? [],
  });
  open.value = true;
}
function addField() {
  form.fields.push({
    key: `field_${Date.now().toString(36)}_${form.fields.length}`,
    label: '',
    kind: 'text',
    enabled: true,
    required: false,
    sensitive: false,
    options: [],
    optionsText: '',
  });
}
function changeKind(field: FieldDraft, kind: unknown) {
  const option = fieldKinds.find((option) => option.value === kind);
  if (!option) return;
  field.kind = option.value;
  field.sensitive = option.value === 'password';
}
function move(index: number, delta: number) {
  const field = form.fields[index];
  if (!field) return;
  form.fields.splice(index, 1);
  form.fields.splice(index + delta, 0, field);
}
async function save() {
  if (!canWrite.value) return;
  saving.value = true;
  errorMessage.value = '';
  const data = {
    code: form.code,
    name: form.name,
    enabled: form.enabled,
    expected_version: editing.value?.version,
    fields: form.fields.map(
      ({ key, label, kind, enabled, required, sensitive, optionsText }) => ({
        key,
        label,
        kind,
        enabled,
        required,
        sensitive,
        options:
          kind === 'select'
            ? optionsText
                .split(/\r?\n/)
                .map((value) => value.trim())
                .filter(Boolean)
            : [],
      }),
    ),
  };
  try {
    await (editing.value
      ? AccountManagerApi.updateType(editing.value.id, data)
      : AccountManagerApi.createType(data));
    open.value = false;
    message.success('账户类型已保存');
    await load();
  } catch (error) {
    errorMessage.value = accountError(error);
  } finally {
    saving.value = false;
  }
}
onMounted(load);
</script>
<template>
  <Page title="账户类型">
    <Space class="mb-4">
      <Button v-if="canWrite" type="primary" @click="edit()">
        新增账户类型
      </Button>
      <Button :loading="loading" @click="load">刷新</Button>
    </Space>
    <Alert
      v-if="pageError"
      :message="pageError"
      type="error"
      class="mb-3"
      show-icon
    />
    <Table
      :columns="columns"
      :data-source="rows"
      :loading="loading"
      row-key="id"
      :pagination="{ pageSize: 20 }"
    >
      <template #bodyCell="{ column, record }">
        <span v-if="column.key === 'fields'">{{
          record.fields
            .filter((field: AccountField) => field.enabled)
            .map((field: AccountField) => field.label)
            .join('、')
        }}</span>
        <Tag
          v-else-if="column.key === 'enabled'"
          :color="record.enabled ? 'green' : 'default'"
        >
          {{ record.enabled ? '启用' : '停用' }}
        </Tag>
        <Button
          v-else-if="column.key === 'actions' && canWrite"
          type="link"
          @click="edit(record)"
        >
          维护字段
        </Button>
      </template>
    </Table>
    <Modal
      v-model:open="open"
      :title="editing ? '编辑账户类型' : '新增账户类型'"
      :width="900"
      :confirm-loading="saving"
      @ok="save"
    >
      <Form layout="vertical">
        <FormItem label="类型名称" required>
          <Input v-model:value="form.name" aria-label="类型名称" />
        </FormItem>
        <FormItem
          label="类型编码"
          required
          help="小写字母开头，可包含数字和下划线；保存后不可修改。"
        >
          <Input
            v-model:value="form.code"
            :disabled="!!editing"
            aria-label="类型编码"
            placeholder="例如 third_party_payment"
          />
        </FormItem>
        <Checkbox v-model:checked="form.enabled" class="mb-4">
          允许新建该类型账户
        </Checkbox>
        <p class="mb-3">
          已有字段的类型和敏感设置保持不变；停用字段会保留历史值。密码字段加密保存。
        </p>
        <div
          v-for="(field, index) in form.fields"
          :key="field.key"
          class="mb-3 rounded border p-3"
        >
          <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
            <FormItem label="字段名称" required>
              <Input
                v-model:value="field.label"
                :aria-label="`字段名称 ${index + 1}`"
              />
            </FormItem>
            <FormItem label="字段类型">
              <Select
                :value="field.kind"
                :disabled="locked.has(field.key)"
                :options="fieldKinds"
                @update:value="changeKind(field, $event)"
              />
            </FormItem>
          </div>
          <TextArea
            v-if="field.kind === 'select'"
            v-model:value="field.optionsText"
            placeholder="每行一个选项"
            class="mb-3"
          />
          <Space wrap>
            <Checkbox v-model:checked="field.enabled">启用</Checkbox>
            <Checkbox v-model:checked="field.required">必填</Checkbox>
            <Checkbox
              v-model:checked="field.sensitive"
              :disabled="
                locked.has(field.key) ||
                !['text', 'textarea'].includes(field.kind)
              "
            >
              敏感字段
            </Checkbox>
            <Button
              size="small"
              :disabled="index === 0"
              @click="move(index, -1)"
            >
              上移
            </Button>
            <Button
              size="small"
              :disabled="index === form.fields.length - 1"
              @click="move(index, 1)"
            >
              下移
            </Button>
            <Button
              v-if="!locked.has(field.key)"
              danger
              size="small"
              @click="form.fields.splice(index, 1)"
            >
              移除字段
            </Button>
          </Space>
        </div>
        <Button :disabled="form.fields.length >= 64" @click="addField">
          添加字段
        </Button>
        <Alert
          v-if="errorMessage"
          class="mt-3"
          :message="errorMessage"
          type="error"
          show-icon
        />
      </Form>
    </Modal>
  </Page>
</template>
