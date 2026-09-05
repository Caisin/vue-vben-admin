<script setup lang="ts">
import type { Binding, Instance, SourceColumn } from '#/api/data-sync';

import { computed, onBeforeUnmount, ref, watch } from 'vue';

import { createIconifyIcon, Plus } from '@vben/icons';

import {
  AutoComplete,
  Button,
  Input,
  InputNumber,
  Select,
  Tooltip,
} from 'antdv-next';

import { DataSyncApi } from '#/api/data-sync';

import MetadataSelect from './metadata-select.vue';

const props = defineProps<{
  active: boolean;
  instances: Instance[];
  mode: string;
}>();
const source = defineModel<Binding>('source', { required: true });
const Trash = createIconifyIcon('lucide:trash-2');
const Refresh = createIconifyIcon('lucide:refresh-cw');
const columns = ref<SourceColumn[]>([]);
const loading = ref(false);
const failed = ref(false);
let version = 0;
let chooseDefaults = false;
const instanceOptions = computed(() =>
  props.instances
    .filter((i) => i.enabled || i.code === source.value.instance_code)
    .map((i) => ({
      value: i.code,
      label: `${i.name} (${i.code})`,
      disabled: !i.enabled,
    })),
);
const schemaKey = computed(() =>
  props.active ? source.value.instance_code : '',
);
const tableKey = computed(() =>
  schemaKey.value && source.value.schema
    ? `${schemaKey.value}/${source.value.schema}`
    : '',
);
const columnKey = computed(() =>
  tableKey.value && source.value.table
    ? `${tableKey.value}/${source.value.table}`
    : '',
);
const fieldOptions = computed(() =>
  columns.value.map((c) => ({
    value: c.name,
    label: `${c.name} (${c.data_type})`,
    disabled: !validIdentifier(c.name),
  })),
);
const pkOptions = computed(() =>
  columns.value.map((c) => ({
    value: c.name,
    label: `${c.name} (${c.data_type})`,
    disabled: !isKey(c),
  })),
);
const timeOptions = computed(() =>
  columns.value.map((c) => ({
    value: c.name,
    label: `${c.name} (${c.data_type})`,
    disabled: !isTime(c),
  })),
);
const types = [
  'string',
  'int64',
  'uint64',
  'decimal',
  'float64',
  'boolean',
  'date',
  'timestamp',
  'variant',
  'binary',
].map((kind) => ({ value: kind, label: kind }));
function validIdentifier(name: string) {
  return /^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(name);
}
function isKey(c: SourceColumn) {
  return (
    validIdentifier(c.name) &&
    c.primary_key &&
    !c.nullable &&
    ['bigint', 'int', 'integer', 'mediumint', 'smallint', 'tinyint'].includes(
      c.data_type,
    )
  );
}
function isTime(c: SourceColumn) {
  return (
    validIdentifier(c.name) &&
    !c.nullable &&
    [
      'datetime',
      'timestamp',
      'timestamp without time zone',
      'timestamp with time zone',
    ].includes(c.data_type)
  );
}
function clearFields() {
  source.value.id_column = null;
  source.value.updated_column = null;
  source.value.soft_delete_column = null;
  source.value.fields = [];
  columns.value = [];
}
function instanceChanged() {
  source.value.schema = '';
  source.value.table = '';
  clearFields();
}
function schemaChanged() {
  source.value.table = '';
  clearFields();
}
function tableChanged() {
  clearFields();
  chooseDefaults = true;
}
async function loadColumns() {
  const current = ++version;
  if (!columnKey.value) {
    columns.value = [];
    loading.value = false;
    failed.value = false;
    return;
  }
  loading.value = true;
  failed.value = false;
  const { instance_code, schema, table } = source.value;
  try {
    const result = await DataSyncApi.sourceColumns(
      instance_code,
      schema,
      table,
    );
    if (current !== version) return;
    columns.value = result;
    if (chooseDefaults) {
      const keys = result.filter((column) => isKey(column));
      const key = keys[0];
      if (
        keys.length === 1 &&
        key &&
        ['id_and_time', 'id_append'].includes(props.mode)
      )
        source.value.id_column = key.name;
      const time = result.find(
        (c) =>
          isTime(c) &&
          ['changed_at', 'modified_at', 'update_time', 'updated_at'].includes(
            c.name,
          ),
      );
      source.value.updated_column =
        props.mode === 'id_and_time' ? (time?.name ?? null) : null;
      chooseDefaults = false;
    }
  } catch {
    if (current === version) {
      failed.value = true;
      columns.value = [];
    }
  } finally {
    if (current === version) loading.value = false;
  }
}
watch(
  columnKey,
  () => {
    void loadColumns();
  },
  { immediate: true },
);
onBeforeUnmount(() => {
  ++version;
});
</script>
<template>
  <div class="source-fields">
    <div class="form-grid">
      <label>实例编码<Select
          v-model:value="source.instance_code"
          aria-label="实例编码"
          :options="instanceOptions"
          show-search
          option-filter-prop="label"
          @change="instanceChanged"
      /></label>
      <label>Schema / 源库<MetadataSelect
          v-model:value="source.schema"
          label="Schema / 源库"
          :context-key="schemaKey"
          :disabled="!schemaKey"
          :load="
            (keyword) =>
              DataSyncApi.sourceSchemas(source.instance_code, keyword)
          "
          @change="schemaChanged"
      /></label>
      <label>源表<MetadataSelect
          v-model:value="source.table"
          label="源表"
          :context-key="tableKey"
          :disabled="!tableKey"
          :load="
            (keyword) =>
              DataSyncApi.sourceTables(
                source.instance_code,
                source.schema,
                keyword,
              )
          "
          @change="tableChanged"
      /></label>
      <label v-if="mode === 'id_and_time' || mode === 'id_append'">自增主键字段<Select
          v-model:value="source.id_column"
          aria-label="自增主键字段"
          :options="pkOptions"
          :loading="loading"
          :disabled="!columnKey || loading || failed"
          show-search
          option-filter-prop="label"
      /></label>
      <label v-if="mode === 'id_and_time' || mode === 'time_window'">{{ mode === 'time_window' ? '分桶时间字段' : '更新时间字段'
        }}<AutoComplete
          :value="source.updated_column ?? ''"
          :aria-label="mode === 'time_window' ? '分桶时间字段' : '更新时间字段'"
          :options="timeOptions"
          :disabled="!columnKey"
          :placeholder="mode === 'time_window' ? 'created_at' : 'updated_at'"
          :filter-option="
            (input, option) =>
              String(option?.value ?? '')
                .toLowerCase()
                .includes(input.toLowerCase())
          "
          allow-clear
          @update:value="
            (value) => (source.updated_column = value ? String(value) : null)
          "
      /></label>
      <label>源时区<Input v-model:value="source.source_timezone" /></label>
      <label>软删除字段<Select
          v-model:value="source.soft_delete_column"
          aria-label="软删除字段"
          :options="fieldOptions"
          :loading="loading"
          :disabled="!columnKey || loading || failed"
          show-search
          option-filter-prop="label"
          allow-clear
          @change="
            (value) =>
              (source.soft_delete_column = value ? String(value) : null)
          "
      /></label>
    </div>
    <div class="section-heading">
      <h4>字段映射</h4>
      <div class="flex gap-2">
        <span v-if="failed" class="text-sm text-red-500">源字段加载失败</span>
        <Tooltip title="刷新源字段">
          <Button
            size="small"
            aria-label="刷新源字段"
            :disabled="!columnKey || loading"
            @click="loadColumns"
          >
            <Refresh class="size-4" />
          </Button>
        </Tooltip>
        <Button
          size="small"
          :disabled="!columns.length || loading || failed"
          @click="
            source.fields.push({
              source: '',
              target: '',
              target_type: null,
              nullable: null,
              transform: { kind: 'identity' },
            })
          "
        >
          <Plus class="size-4" />添加字段
        </Button>
      </div>
    </div>
    <div v-if="source.fields.length" class="mapping-scroll">
      <table class="mapping-table">
        <thead>
          <tr>
            <th>源字段</th>
            <th>目标字段</th>
            <th>目标类型</th>
            <th>精度 / 小数位</th>
            <th>允许空值</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(field, index) in source.fields" :key="index">
            <td>
              <Select
                v-model:value="field.source"
                aria-label="映射源字段"
                :options="fieldOptions"
                :loading="loading"
                :disabled="loading || failed"
                show-search
                option-filter-prop="label"
                class="w-full"
                @change="
                  (name) => {
                    if (!field.target) field.target = String(name);
                  }
                "
              />
            </td>
            <td>
              <Input v-model:value="field.target" aria-label="目标字段" />
            </td>
            <td>
              <Select
                :value="field.target_type?.kind"
                :options="types"
                allow-clear
                placeholder="自动"
                class="w-full"
                @change="
                  (kind) =>
                    (field.target_type = kind
                      ? {
                          kind: String(kind),
                          ...(kind === 'decimal'
                            ? { precision: 20, scale: 6 }
                            : {}),
                        }
                      : null)
                "
              />
            </td>
            <td>
              <div
                v-if="field.target_type?.kind === 'decimal'"
                class="flex gap-1"
              >
                <InputNumber
                  v-model:value="field.target_type.precision"
                  :min="1"
                  :max="76"
                  aria-label="精度"
                /><InputNumber
                  v-model:value="field.target_type.scale"
                  :min="0"
                  :max="76"
                  aria-label="小数位"
                />
              </div>
            </td>
            <td>
              <Select
                :value="
                  field.nullable === null || field.nullable === undefined
                    ? 'auto'
                    : String(field.nullable)
                "
                :options="[
                  { value: 'auto', label: '自动' },
                  { value: 'true', label: '允许' },
                  { value: 'false', label: '不允许' },
                ]"
                @change="
                  (value) =>
                    (field.nullable =
                      value === 'auto' ? null : value === 'true')
                "
              />
            </td>
            <td>
              <Tooltip title="移除字段">
                <Button
                  type="text"
                  danger
                  @click="source.fields.splice(index, 1)"
                >
                  <Trash class="size-4" />
                </Button>
              </Tooltip>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-else class="empty-mapping">全部字段按源结构映射</div>
  </div>
</template>
<style scoped>
.form-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
}

.section-heading {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  margin: 16px 0 10px;
}

h4 {
  font-size: 14px;
}

.mapping-scroll {
  overflow-x: auto;
}

.mapping-table {
  width: 100%;
  min-width: 780px;
  table-layout: fixed;
  border-collapse: collapse;
}

.mapping-table th {
  font-size: 12px;
  font-weight: 500;
  text-align: left;
}

.mapping-table td,
.mapping-table th {
  padding: 5px;
}

.mapping-table th:last-child {
  width: 42px;
}

.empty-mapping {
  padding: 12px 0;
  color: #737373;
}

@media (max-width: 700px) {
  .form-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .section-heading {
    flex-wrap: wrap;
  }
}
</style>
