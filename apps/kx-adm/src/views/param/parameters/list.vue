<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { KxParam } from '#/api/param/param';
import type { JsonValue } from '#/api/request';

import { computed, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import {
  Button,
  Checkbox,
  Form,
  FormItem,
  Input,
  message,
  Popconfirm,
  Space,
  Tag,
} from 'antdv-next';
import JsonBigint from 'json-bigint';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { ParamApi } from '#/api';
import JsonEditor from '#/components/json-editor';
import { vxeSortParams } from '#/vxe-sort';

import { useColumns, useFormSchema } from './data';
import PopupModal from './modules/popup-modal.vue';

const paramSortFields = ['param_code', 'enabled'];

const jsonParser = JsonBigint({ storeAsString: true, strict: true });
const editing = ref<KxParam | null>(null);
const modalOpen = ref(false);
const saving = ref(false);
const refreshing = ref('');
const jsonValid = ref(true);
const jsonError = ref('');
const form = reactive({
  enabled: true,
  param_code: '',
  param_value_text: '{}',
  remark: '',
});

const modalTitle = computed(() =>
  editing.value ? `编辑参数：${editing.value.param_code}` : '新建系统参数',
);

const [Grid, gridApi] = useVbenVxeGrid<KxParam>({
  formOptions: { schema: useFormSchema(), submitOnChange: true },
  gridOptions: {
    columns: useColumns(onEnabledChange),
    height: 'auto',
    pagerConfig: { pageSize: 20, pageSizes: [10, 20, 50, 100] },
    proxyConfig: {
      ajax: {
        query: async (params, formValues) => {
          const { page } = params;
          const result = await ParamApi.list({
            code_prefix:
              String(formValues.code_prefix ?? '').trim() || undefined,
            enabled: formValues.enabled as boolean | undefined,
            ...vxeSortParams(params, paramSortFields),
            page: page.currentPage,
            size: page.pageSize,
          });
          return { items: result.items, total: result.total };
        },
      },
    },
    sortConfig: { remote: true },
    rowConfig: { keyField: 'param_code' },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<KxParam>,
});

function formatJson(value: unknown) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  return JsonBigint.stringify(value, null, 2) ?? '';
}

function previewJson(value: unknown) {
  const text = formatJson(value);
  return text.length > 260 ? `${text.slice(0, 260)}…` : text;
}

function parseJsonValue(): JsonValue {
  return jsonParser.parse(form.param_value_text) as JsonValue;
}

function resetForm() {
  editing.value = null;
  form.enabled = true;
  form.param_code = '';
  form.param_value_text = '{}';
  form.remark = '';
  jsonValid.value = true;
  jsonError.value = '';
}

function openCreate() {
  resetForm();
  modalOpen.value = true;
}

async function openEdit(row: KxParam) {
  if (row.confidential) {
    message.warning('敏感参数需要通过所属业务配置页面维护');
    return;
  }
  resetForm();
  const detail = await ParamApi.detail(row.param_code);
  editing.value = detail;
  form.enabled = detail.enabled;
  form.param_code = detail.param_code;
  form.param_value_text = formatJson(detail.param_value) || '{}';
  form.remark = detail.remark ?? '';
  modalOpen.value = true;
}

async function submit() {
  if (!form.param_code.trim()) {
    message.warning('参数编码不能为空');
    return;
  }
  if (!jsonValid.value) {
    message.error(jsonError.value || 'JSON 字段格式不正确');
    return;
  }
  saving.value = true;
  try {
    const body = {
      enabled: form.enabled,
      param_value: parseJsonValue(),
      remark: form.remark,
    };
    await (editing.value
      ? ParamApi.set(editing.value.param_code, body)
      : ParamApi.save({ param_code: form.param_code.trim(), ...body }));
    message.success('保存成功');
    modalOpen.value = false;
    await gridApi.query();
  } catch (error) {
    if (error instanceof SyntaxError) {
      message.error('JSON 字段格式不正确');
      return;
    }
    throw error;
  } finally {
    saving.value = false;
  }
}

async function refreshCache(row: KxParam) {
  refreshing.value = row.param_code;
  try {
    await ParamApi.refresh(row.param_code);
    message.success('缓存已刷新');
  } finally {
    refreshing.value = '';
  }
}

async function onEnabledChange(enabled: boolean, row: KxParam) {
  await ParamApi.set(row.param_code, {
    enabled,
    param_value: row.param_value,
    remark: row.remark,
  });
  return true;
}

async function remove(row: KxParam) {
  await ParamApi.remove(row.param_code);
  message.success('删除成功');
  await gridApi.query();
}
</script>

<template>
  <Page
    auto-content-height
    class="management-page"
    content-class="management-content"
    title="系统参数"
  >
    <Grid class="management-grid" table-title="系统参数">
      <template #toolbar-tools>
        <Button type="primary" @click="openCreate">
          <template #icon><Plus /></template>新建参数
        </Button>
      </template>
      <template #code="{ row }">
        <Button
          :disabled="row.confidential"
          :aria-label="`编辑参数 ${row.param_code}`"
          class="px-0"
          type="link"
          @click="openEdit(row)"
        >
          {{ row.param_code }}
        </Button>
      </template>
      <template #value="{ row }">
        <Tag v-if="row.confidential" color="warning">敏感参数不展示</Tag>
        <pre v-else class="json-preview">{{
          previewJson(row.param_value)
        }}</pre>
      </template>
      <template #confidential="{ row }">
        <Tag :color="row.confidential ? 'warning' : 'default'">
          {{ row.confidential ? '是' : '否' }}
        </Tag>
      </template>
      <template #operation="{ row }">
        <Space wrap size="small">
          <Button
            size="small"
            type="link"
            :disabled="row.confidential"
            :aria-label="`编辑参数 ${row.param_code}`"
            @click="openEdit(row)"
          >
            编辑
          </Button>
          <Button
            size="small"
            type="link"
            :disabled="row.confidential"
            :loading="refreshing === row.param_code"
            :aria-label="`刷新参数 ${row.param_code} 缓存`"
            @click="refreshCache(row)"
          >
            刷新缓存
          </Button>
          <Popconfirm
            title="确认删除该参数？"
            ok-text="删除"
            ok-type="danger"
            @confirm="remove(row)"
          >
            <Button
              size="small"
              danger
              type="link"
              :disabled="row.confidential"
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      </template>
    </Grid>

    <PopupModal
      v-model:open="modalOpen"
      :confirm-loading="saving"
      :title="modalTitle"
      width="min(860px, calc(100vw - 24px))"
      @ok="submit"
    >
      <Form layout="vertical">
        <div class="form-grid">
          <FormItem label="参数编码" required>
            <Input
              v-model:value="form.param_code"
              :disabled="Boolean(editing)"
              placeholder="例如 sys_setting"
            />
          </FormItem>
          <FormItem label="状态">
            <Checkbox v-model:checked="form.enabled">启用</Checkbox>
          </FormItem>
          <FormItem label="备注" class="wide-field">
            <Input v-model:value="form.remark" allow-clear />
          </FormItem>
        </div>
        <FormItem
          label="参数值 JSON"
          required
          :validate-status="jsonValid ? undefined : 'error'"
          :help="jsonValid ? undefined : jsonError"
        >
          <JsonEditor
            v-model="form.param_value_text"
            max-height="560px"
            min-height="320px"
            value-mode="text"
            @parse-error="jsonError = $event"
            @valid-change="
              (valid, error) => {
                jsonValid = valid;
                jsonError = error ?? '';
              }
            "
          />
        </FormItem>
      </Form>
    </PopupModal>
  </Page>
</template>

<style scoped>
.json-preview {
  max-height: 96px;
  margin: 0;
  overflow: hidden;
  font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 12px;
  line-height: 1.45;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.form-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 120px;
  gap: 12px;
}

.wide-field {
  grid-column: 1 / -1;
}

@media (max-width: 760px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
