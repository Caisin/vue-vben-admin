<script setup lang="ts">
import type { Instance, Job, SyncConfig } from '#/api/data-sync';
import type {
  DatabaseSync,
  DatabaseTable,
  DatabaseWrite,
} from '#/api/data-sync-database';

import { computed, onMounted, onUnmounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';

import { createIconifyIcon, Plus } from '@vben/icons';

import {
  Alert,
  Button,
  Checkbox,
  Drawer,
  Input,
  InputNumber,
  message,
  Modal,
  Select,
  Table,
  Tag,
  Tooltip,
} from 'antdv-next';

import { DataSyncApi } from '#/api/data-sync';
import { DatabaseSyncApi } from '#/api/data-sync-database';
import { StorageConfigApi } from '#/api/storage/config';
import { DataSourceApi } from '#/api/system/data-source';

import {
  jobForm,
  setStrategy,
  states,
  strategyOptions,
  validateForm,
} from './data';
import { sourceTableLabels } from './database-data';
import MetadataSelect from './metadata-select.vue';
import SourceFields from './source-fields.vue';
import StrategyFields from './strategy-fields.vue';
import WarehouseSelect from './warehouse-select.vue';

const props = defineProps<{
  configure: boolean;
  execute: boolean;
  instances: Instance[];
}>();
const emit = defineEmits<{ job: [Job] }>();
const route = useRoute();
const Refresh = createIconifyIcon('lucide:refresh-cw');
const Trash = createIconifyIcon('lucide:trash-2');
const rows = ref<DatabaseSync[]>([]);
const pagination = reactive({ current: 1, pageSize: 20, total: 0 });
const selected = ref<DatabaseSync>();
const open = ref(false);
const busy = ref(false);
const dirty = ref(false);
const form = ref<DatabaseWrite>(blank());
const targets = ref<{ label: string; value: string }[]>([]);
const stores = ref<{ label: string; value: string }[]>([]);
const selectedTables = ref<string[]>([]);
const bulkMode = ref<SyncConfig['mode']>('full_table');
const editing = ref<DatabaseTable>();
const editingIndex = ref(-1);
const taskPending = ref<number>();
const taskError = ref('');
const schedule = reactive({
  cron_expr: '0 0 * * * *',
  timezone_offset_seconds: 28_800,
  enabled: false,
});
let timer: ReturnType<typeof setInterval> | undefined;
let loading = false;
const locked = computed(
  () =>
    busy.value ||
    !!taskPending.value ||
    !!selected.value?.active_task_id ||
    selected.value?.state === 'blocked',
);
const canEdit = computed(() => props.configure && !locked.value);
const targetKey = computed(() =>
  open.value && form.value.target_ds_code
    ? JSON.stringify([
        form.value.target_ds_code,
        form.value.warehouse,
        form.value.allow_insecure,
      ])
    : '',
);
const counts = computed(() => ({
  included: form.value.tables.filter((t) => t.excluded_reason === null).length,
  excluded: form.value.tables.filter((t) => t.excluded_reason !== null).length,
  pending: form.value.tables.filter(
    (t) => !t.confirmed && t.excluded_reason === null,
  ).length,
}));
const tableColumns = [
  { title: '源表', key: 'source', width: 230 },
  { title: '目标表', dataIndex: 'target_table', width: 180 },
  { title: '同步策略', key: 'strategy', width: 210 },
  { title: '确认', key: 'confirmed', width: 70 },
  { title: '状态 / 原因', key: 'state', width: 240 },
  { title: '操作', key: 'actions', width: 160 },
];
function blank(): DatabaseWrite {
  return {
    name: '',
    target_ds_code: '',
    target_database: '',
    warehouse: null,
    allow_insecure: true,
    table_prefix: '',
    schema_prefix: false,
    storage_code: '',
    sources: [{ instance_code: '', schema: '' }],
    tables: [],
  };
}
function copy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}
async function load() {
  if (loading) return;
  loading = true;
  try {
    const page = await DatabaseSyncApi.list({
      page: pagination.current,
      size: pagination.pageSize,
    });
    rows.value = page.items;
    pagination.total = page.total;
    if (open.value && selected.value) {
      const id = selected.value.id;
      const current = await DatabaseSyncApi.detail(id);
      if (!open.value || selected.value?.id !== id) return;
      selected.value = current;
      if (taskPending.value) {
        const taskId = taskPending.value;
        const task = await DatabaseSyncApi.task(id, taskId);
        if (
          !open.value ||
          selected.value?.id !== id ||
          taskPending.value !== taskId
        )
          return;
        if (!['queued', 'retrying', 'running'].includes(task.status)) {
          taskError.value = task.error_message ?? '';
          taskPending.value = undefined;
        }
      }
      if (
        !dirty.value &&
        !current.active_task_id &&
        (!taskPending.value || current.last_task_id === taskPending.value)
      ) {
        form.value = copy(current.config);
        form.value.version = current.version;
        taskPending.value = undefined;
      }
    }
  } finally {
    loading = false;
  }
}
async function show(record?: DatabaseSync) {
  selected.value = record ? await DatabaseSyncApi.detail(record.id) : undefined;
  form.value = selected.value ? copy(selected.value.config) : blank();
  form.value.version = selected.value?.version;
  dirty.value = false;
  selectedTables.value = [];
  open.value = true;
  taskPending.value = undefined;
  taskError.value = '';
  if (record) {
    const s = await DatabaseSyncApi.schedule(record.id);
    Object.assign(
      schedule,
      s
        ? {
            cron_expr: s.cron_expr,
            timezone_offset_seconds: s.timezone_offset_seconds,
            enabled: s.status === 'enabled',
          }
        : {
            cron_expr: '0 0 * * * *',
            timezone_offset_seconds: 28_800,
            enabled: false,
          },
    );
  }
  if (props.configure) {
    const [ds, storage] = await Promise.all([
      DataSourceApi.list({ size: 100, state: true }),
      StorageConfigApi.list({ size: 100, is_public: false }),
    ]);
    targets.value = ds.items
      .filter((s) => s.db_type === 'databend')
      .map((s) => ({ value: s.ds_code, label: s.name }));
    stores.value = storage.items.map((s) => ({
      value: s.code,
      label: s.storage_name,
    }));
  }
}
async function save() {
  if (
    !form.value.name.trim() ||
    !form.value.target_ds_code ||
    !form.value.target_database ||
    !form.value.storage_code ||
    form.value.sources.some((s) => !s.instance_code || !s.schema)
  ) {
    message.warning('请填写名称、源范围、目标数据库和批次存储');
    return;
  }
  busy.value = true;
  try {
    for (const table of form.value.tables)
      table.config.storage_code = form.value.storage_code;
    const current = await DatabaseSyncApi.save(
      { ...copy(form.value), version: selected.value?.version },
      selected.value?.id,
    );
    selected.value = current;
    form.value = copy(current.config);
    form.value.version = current.version;
    dirty.value = false;
    message.success('全库配置已保存');
    await load();
  } finally {
    busy.value = false;
  }
}
async function dispatch(operation: string) {
  if (!selected.value || dirty.value) {
    message.warning('请先保存配置');
    return;
  }
  busy.value = true;
  try {
    const task = await DatabaseSyncApi.dispatch(
      selected.value.id,
      operation,
      operation === 'activate' ? selected.value.plan_hash : undefined,
    );
    taskPending.value = Number(task.id);
    taskError.value = '';
    message.success(`已提交任务 #${task.id}`);
    await load();
  } finally {
    busy.value = false;
  }
}
function strategy(table: DatabaseTable, mode: SyncConfig['mode']) {
  setStrategy(table.config, mode);
  table.confirmed = mode === 'full_table';
  dirty.value = true;
}
function bulk() {
  for (const table of form.value.tables)
    if (selectedTables.value.includes(table.target_table))
      strategy(table, bulkMode.value);
}
function editTable(table: DatabaseTable) {
  editingIndex.value = form.value.tables.indexOf(table);
  editing.value = copy(table);
}
function saveTable() {
  if (!editing.value) return;
  const candidate = {
    ...jobForm(),
    name: form.value.name,
    target_ds_code: form.value.target_ds_code,
    target_database: form.value.target_database,
    target_table: editing.value.target_table,
    config: editing.value.config,
  };
  let invalid: string | undefined;
  if (editing.value.excluded_reason === null) {
    invalid = validateForm(candidate);
  } else if (!editing.value.excluded_reason.trim()) {
    invalid = '请填写排除原因';
  }
  if (invalid) {
    message.warning(invalid);
    return;
  }
  editing.value.confirmed = true;
  editing.value.suggestion_error = null;
  form.value.tables[editingIndex.value] = copy(editing.value);
  dirty.value = true;
  editing.value = undefined;
}
function planRow(table: DatabaseTable) {
  return selected.value?.plan.find(
    (p) => p.target_table === table.target_table,
  );
}
async function viewJob(table: DatabaseTable) {
  const id = planRow(table)?.job_id;
  if (id) {
    const detail = await DataSyncApi.detail(id);
    open.value = false;
    emit('job', detail.job);
  }
}
async function saveSchedule() {
  if (!selected.value) return;
  busy.value = true;
  try {
    await DatabaseSyncApi.saveSchedule(selected.value.id, schedule);
    message.success('定时配置已保存');
  } finally {
    busy.value = false;
  }
}
async function pause() {
  if (!selected.value) return;
  selected.value = await DatabaseSyncApi.pause(
    selected.value.id,
    selected.value.state !== 'paused',
    selected.value.version,
  );
  await load();
}
onMounted(async () => {
  await load();
  const id = Number(route.query.database_id);
  if (id > 0) await show(await DatabaseSyncApi.detail(id));
  timer = setInterval(() => {
    void load().catch(() => {});
  }, 5000);
});
onUnmounted(() => clearInterval(timer));
</script>
<template>
  <div>
    <div class="toolbar">
      <Button v-if="configure" type="primary" @click="show()">
        <Plus class="size-4" />新增全库配置
      </Button>
      <Tooltip title="刷新全库配置">
        <Button aria-label="刷新全库配置" @click="load">
          <Refresh class="size-4" />
        </Button>
      </Tooltip>
    </div>
    <Table
      :data-source="rows"
      row-key="id"
      :pagination="pagination"
      :scroll="{ x: 750 }"
      :columns="[
        { title: '配置名称', key: 'name' },
        { title: '状态', key: 'state' },
        { title: '表数', dataIndex: 'total_tables' },
        { title: '本轮成功', dataIndex: 'completed_tables' },
        { title: '本轮失败', dataIndex: 'failed_tables' },
        { title: '最近错误', dataIndex: 'last_error' },
      ]"
      @change="
        (p) => {
          pagination.current = p.current ?? 1;
          load();
        }
      "
    >
      <template #bodyCell="{ column, record }">
        <a v-if="column.key === 'name'" @click="show(record)">{{
          record.name
        }}</a><Tag v-else-if="column.key === 'state'">
          {{ states[record.state] ?? record.state }}
        </Tag>
      </template>
    </Table>
    <Drawer
      :open="open"
      :title="selected ? selected.name : '新增全库同步配置'"
      :width="1120"
      :z-index="2100"
      @close="open = false"
    >
      <Alert
        v-if="taskError || selected?.last_error"
        type="error"
        show-icon
        :message="taskError || selected?.last_error || ''"
        class="mb-4"
      />
      <div class="toolbar">
        <Button
          v-if="configure"
          type="primary"
          :disabled="!canEdit"
          :loading="busy"
          @click="save"
        >
          保存配置
        </Button>
        <Button
          v-if="configure"
          :disabled="!selected || !canEdit || dirty"
          @click="dispatch('discover')"
        >
          发现源表
        </Button>
        <Button
          v-if="configure"
          :disabled="!selected || !canEdit || dirty || !form.tables.length"
          @click="dispatch('inspect')"
        >
          检查所有表
        </Button>
        <Button
          v-if="configure"
          :disabled="selected?.state !== 'validated' || dirty || busy"
          @click="dispatch('activate')"
        >
          确认建表并启用
        </Button>
        <Button
          v-if="execute"
          :disabled="selected?.state !== 'ready' || dirty || busy"
          @click="dispatch('sync')"
        >
          立即同步全库
        </Button>
        <Button
          v-if="
            execute &&
            (selected?.state === 'blocked' || selected?.active_task_id)
          "
          :disabled="busy"
          @click="dispatch('reconcile')"
        >
          回执对账
        </Button>
        <Button
          v-if="execute && selected?.active_task_id"
          @click="DatabaseSyncApi.cancel(selected.id).then(load)"
        >
          取消运行
        </Button>
        <Button
          v-if="
            configure &&
            selected &&
            ['ready', 'paused'].includes(selected.state)
          "
          @click="pause"
        >
          {{ selected.state === 'paused' ? '恢复调度' : '暂停调度' }}
        </Button>
      </div>
      <div v-if="selected" class="status-line">
        {{ states[selected.state] ?? selected.state }} · 成功
        {{ selected.completed_tables }} / {{ selected.total_tables }} · 失败
        {{ selected.failed_tables
        }}<span v-if="taskPending"> · 已提交 #{{ taskPending }}</span>
      </div>
      <fieldset
        :disabled="!canEdit"
        class="configuration"
        @input="dirty = true"
        @change="dirty = true"
      >
        <h3>源范围与目标</h3>
        <div class="fields">
          <label class="field">配置名称<Input
              v-model:value="form.name"
              :disabled="!canEdit"
              :maxlength="128"
          /></label>
          <label class="field">Databend 数据源<Select
              v-model:value="form.target_ds_code"
              :disabled="!canEdit"
              :options="targets"
              @change="
                form.target_database = '';
                form.warehouse = null;
                dirty = true;
              "
          /></label>
          <label class="field">目标数据库<MetadataSelect
              v-model:value="form.target_database"
              label="全库目标数据库"
              :disabled="!canEdit"
              :context-key="targetKey"
              :load="
                (keyword) =>
                  DataSyncApi.targetDatabases({
                    ds_code: form.target_ds_code,
                    warehouse: form.warehouse,
                    allow_insecure: form.allow_insecure,
                    keyword,
                  })
              "
              @change="dirty = true"
          /></label>
          <label class="field">计算仓库<WarehouseSelect
              v-model:value="form.warehouse"
              :ds-code="form.target_ds_code"
              :allow-insecure="form.allow_insecure"
              :active="open"
              :disabled="!canEdit"
              @update:value="dirty = true"
          /></label>
          <label class="field">目标表前缀<Input
              v-model:value="form.table_prefix"
              :disabled="!canEdit"
          /></label>
          <label class="field">私有批次存储<Select
              v-model:value="form.storage_code"
              :disabled="!canEdit"
              :options="stores"
              @change="dirty = true"
          /></label>
          <Checkbox v-model:checked="form.schema_prefix" :disabled="!canEdit">
            表名包含 Schema
          </Checkbox>
          <Checkbox v-model:checked="form.allow_insecure" :disabled="!canEdit">
            允许不加密的目标连接
          </Checkbox>
        </div>
        <div
          v-for="(scope, index) in form.sources"
          :key="index"
          class="scope-row"
        >
          <label class="field">源实例<Select
              v-model:value="scope.instance_code"
              :disabled="!canEdit"
              :options="
                instances.map((i) => ({
                  value: i.code,
                  label: `${i.name} (${i.code})`,
                  disabled: !i.enabled,
                }))
              "
              @change="
                scope.schema = '';
                dirty = true;
              "
          /></label>
          <label class="field">Schema / 源库<MetadataSelect
              v-model:value="scope.schema"
              label="全库源范围"
              :context-key="open ? scope.instance_code : ''"
              :disabled="!canEdit || !scope.instance_code"
              :load="
                (keyword) =>
                  DataSyncApi.sourceSchemas(scope.instance_code, keyword)
              "
              @change="dirty = true"
          /></label>
          <Tooltip title="移除源范围">
            <Button
              :disabled="!canEdit || form.sources.length <= 1"
              aria-label="移除源范围"
              @click="
                form.sources.splice(index, 1);
                dirty = true;
              "
            >
              <Trash class="size-4" />
            </Button>
          </Tooltip>
        </div>
        <Button
          v-if="configure"
          :disabled="!canEdit"
          @click="
            form.sources.push({ instance_code: '', schema: '' });
            dirty = true;
          "
        >
          <Plus class="size-4" />添加源范围
        </Button>
      </fieldset>
      <h3>逐表同步策略</h3>
      <div class="toolbar">
        <span>包含 {{ counts.included }} · 排除 {{ counts.excluded }} · 待确认
          {{ counts.pending }}</span><template v-if="configure">
          <Select
            v-model:value="bulkMode"
            :options="strategyOptions"
            :disabled="!canEdit"
            class="bulk-select"
          /><Button
            :disabled="!canEdit || !selectedTables.length"
            @click="bulk"
          >
            应用到所选表
          </Button>
        </template>
      </div>
      <Table
        :data-source="form.tables"
        row-key="target_table"
        :columns="tableColumns"
        :scroll="{ x: 1100 }"
        :pagination="{ pageSize: 20, showSizeChanger: false }"
        :row-selection="
          configure
            ? {
                selectedRowKeys: selectedTables,
                onChange: (keys) => (selectedTables = keys.map(String)),
                getCheckboxProps: () => ({ disabled: !canEdit }),
              }
            : undefined
        "
      >
        <template #bodyCell="{ column, record }">
          <div v-if="column.key === 'source'">
            <div v-for="source in sourceTableLabels(record)" :key="source.name">
              <Tooltip :trigger="['hover', 'focus']" :z-index="2500">
                <template #title>
                  <div class="source-table-comments">
                    <div v-for="comment in source.comments" :key="comment">
                      {{ comment }}
                    </div>
                  </div>
                </template>
                <span tabindex="0" class="source-table-name cursor-help">{{
                  source.name
                }}</span>
              </Tooltip>
            </div>
          </div>
          <Select
            v-else-if="column.key === 'strategy'"
            :value="record.config.mode"
            :options="strategyOptions"
            :disabled="!canEdit"
            class="strategy-select"
            @change="(value) => strategy(record, value as SyncConfig['mode'])"
          />
          <Checkbox
            v-else-if="column.key === 'confirmed'"
            v-model:checked="record.confirmed"
            :disabled="!canEdit"
            :aria-label="`确认 ${record.target_table} 策略`"
            @change="dirty = true"
          />
          <span v-else-if="column.key === 'state'">{{
            record.excluded_reason !== null
              ? `排除：${record.excluded_reason}`
              : (planRow(record)?.error ??
                (planRow(record)?.state !== 'succeeded'
                  ? record.suggestion_error
                  : null) ??
                (record.confirmed
                  ? (states[planRow(record)?.state ?? ''] ?? '待检查')
                  : '待确认策略'))
          }}</span>
          <div v-else-if="column.key === 'actions'" class="toolbar">
            <Button
              v-if="configure"
              size="small"
              :disabled="!canEdit"
              @click="editTable(record)"
            >
              配置
</Button><Button
              v-if="planRow(record)?.job_id"
              size="small"
              @click="viewJob(record)"
            >
              进度
            </Button>
          </div>
        </template>
      </Table>
      <template v-if="selected">
        <h3>定时运行</h3>
        <div class="fields">
          <label class="field">Cron<Input
              v-model:value="schedule.cron_expr"
              :disabled="!configure"
          /></label>
          <label class="field">时区偏移（秒）<InputNumber
              v-model:value="schedule.timezone_offset_seconds"
              :disabled="!configure"
              :min="-43200"
              :max="50400"
          /></label>
          <Checkbox v-model:checked="schedule.enabled" :disabled="!configure">
            启用定时同步
          </Checkbox>
        </div>
        <Button
          v-if="configure"
          :disabled="busy || dirty"
          @click="saveSchedule"
        >
          保存定时配置
        </Button>
      </template>
    </Drawer>
    <Modal
      :open="!!editing"
      :title="editing?.target_table"
      :width="1000"
      :z-index="2400"
      ok-text="确认本表配置"
      @ok="saveTable"
      @cancel="editing = undefined"
    >
      <div v-if="editing" class="table-editor">
        <Checkbox
          :checked="editing.excluded_reason !== null"
          @change="
            (event) =>
              editing &&
              (editing.excluded_reason = event.target.checked ? '' : null)
          "
        >
          排除此表
        </Checkbox>
        <label v-if="editing.excluded_reason !== null" class="field">排除原因<Input
            v-model:value="editing.excluded_reason"
            :maxlength="256"
        /></label>
        <template v-else>
          <label class="field">目标表<Input v-model:value="editing.target_table" /></label>
          <StrategyFields v-model:config="editing.config" />
          <div
            v-for="(source, index) in editing.config.sources"
            :key="source.instance_code"
          >
            <h3>{{ source.instance_code }}</h3>
            <SourceFields
              :source="source"
              @update:source="
                (value) => editing && (editing.config.sources[index] = value)
              "
              :instances="instances"
              :mode="editing.config.mode"
              :active="!!editing"
            />
          </div>
          <div class="fields">
            <label class="field">每批最多行数<InputNumber
                v-model:value="editing.config.limits.max_rows"
                :min="1"
                :max="10000"
/></label><label class="field">每批字节上限<InputNumber
                v-model:value="editing.config.limits.max_bytes"
                :min="1024"
                :max="67108864"
/></label><label class="field">并发源数<InputNumber
                v-model:value="editing.config.limits.source_concurrency"
                :min="1"
                :max="8"
/></label><label class="field">ID 区间跨度<InputNumber
                v-model:value="editing.config.limits.id_span"
                :min="1"
                :max="1000000"
/></label><label class="field">时间回看（秒）<InputNumber
                v-model:value="editing.config.limits.overlap_seconds"
                :min="0"
                :max="2678400"
/></label><label class="field">提交等待（秒）<InputNumber
                v-model:value="editing.config.limits.settle_delay_seconds"
                :min="0"
                :max="86400"
            /></label>
          </div>
        </template>
      </div>
    </Modal>
  </div>
</template>
<style scoped>
.source-table-name {
  overflow-wrap: anywhere;
}

.source-table-comments {
  max-height: 240px;
  overflow-y: auto;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-bottom: 12px;
}

.fields {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  align-items: center;
  margin-bottom: 16px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.scope-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
  gap: 12px;
  align-items: end;
  margin-bottom: 12px;
}

.configuration {
  min-width: 0;
  padding: 0;
  border: 0;
}

.status-line {
  margin: 12px 0;
}

h3 {
  margin: 20px 0 12px;
  font-size: 15px;
  font-weight: 600;
}

.bulk-select {
  width: 220px;
}

.strategy-select {
  width: 190px;
}

.table-editor {
  max-height: 70vh;
  overflow-y: auto;
}

.field :deep(.ant-input-number) {
  width: 100%;
}

@media (max-width: 700px) {
  .fields,
  .scope-row {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
