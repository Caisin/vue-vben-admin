<script setup lang="ts">
import type { Instance, Job, SyncConfig } from '#/api/data-sync';
import type {
  DatabaseSync,
  DatabaseTable,
  DatabaseWrite,
} from '#/api/data-sync-database';
import type { TaskRun } from '#/api/task/run';

import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

import { createIconifyIcon, Plus } from '@vben/icons';

import {
  Alert,
  Button,
  Checkbox,
  Input,
  InputNumber,
  message,
  Modal,
  Select,
  Table,
  TabPane,
  Tabs,
  Tag,
  Tooltip,
} from 'antdv-next';

import { DataSyncApi } from '#/api/data-sync';
import { DatabaseSyncApi } from '#/api/data-sync-database';
import { StorageConfigApi } from '#/api/storage/config';
import { DataSourceApi } from '#/api/system/data-source';
import { useTaskPolling } from '#/task-polling';

import { setStrategy, states, strategyOptions } from './data';
import {
  databaseErrors,
  databaseErrorText,
  databaseTableError,
  sourceTableLabels,
  splitDatabaseTableSource,
  tableFrequencyLabel,
  validateDatabaseTable,
} from './database-data';
import { formatSyncDuration } from './duration';
import MetadataSelect from './metadata-select.vue';
import SourceFields from './source-fields.vue';
import StrategyFields from './strategy-fields.vue';
import { startDatabase, stopDatabase } from './sync-control';
import TableFrequency from './table-frequency.vue';
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
const CheckCheck = createIconifyIcon('lucide:check-check');
const Search = createIconifyIcon('lucide:search');
const FilterX = createIconifyIcon('lucide:filter-x');
const Play = createIconifyIcon('lucide:play');
const Square = createIconifyIcon('lucide:square');
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
const activeSourceCodes = ref<null | string[]>(null);
const separatedTables = ref<DatabaseTable[]>([]);
const linkingJob = ref(false);
const editingIndex = ref(-1);
const editingRecord = ref<import('#/api/data-sync-database').TableRecord>();
const taskPending = ref<number>();
const lastRun = ref<TaskRun>();
const taskError = ref('');
const tableKeyword = ref('');
const onlyErrors = ref(false);
const strategyTab = ref('confirmed');
const strategyMode = ref('all');
const strategyFrequency = ref('all');
const tableRecords = ref<import('#/api/data-sync-database').TableRecord[]>([]);
const totals = reactive({
  excluded: 0,
  errors: 0,
  confirmed: 0,
  pending: 0,
  total: 0,
  frequencies: [] as (null | number)[],
});
const frequencyOptions = computed(() =>
  totals.frequencies.map((seconds) => ({
    label: tableFrequencyLabel(seconds || undefined),
    value: String(seconds ?? 0),
  })),
);
let tableGeneration = 0;
async function loadTables() {
  if (!selected.value || !open.value || dirty.value || editing.value) return;
  const generation = ++tableGeneration;
  const errorCodes = Object.entries(databaseErrors)
    .filter(
      ([, text]) =>
        tableKeyword.value.trim() &&
        text.toLowerCase().includes(tableKeyword.value.trim().toLowerCase()),
    )
    .map(([code]) => code)
    .join(',');
  const result = await DatabaseSyncApi.tables(selected.value.id, {
    page: tablePage.value,
    size: 20,
    keyword: tableKeyword.value,
    error_codes: errorCodes || undefined,
    target_table: locatedTable.value,
    confirmed: strategyTab.value === 'confirmed',
    mode: strategyMode.value === 'all' ? undefined : strategyMode.value,
    frequency:
      strategyFrequency.value === 'all'
        ? undefined
        : Number(strategyFrequency.value),
    errors: onlyErrors.value,
  });
  if (
    generation !== tableGeneration ||
    dirty.value ||
    editing.value ||
    !open.value
  )
    return;
  tableRecords.value = result.page.items;
  form.value.tables = result.page.items.map((row) => copy(row.definition));
  selected.value.plan = result.page.items.map((row) => row.plan);
  Object.assign(totals, {
    excluded: result.excluded,
    errors: result.errors,
    confirmed: result.confirmed,
    pending: result.pending,
    total: result.page.total,
    frequencies: result.frequencies,
  });
}
const locatedTable = ref<string>();
const tablePage = ref(1);
const strategiesHeading = ref<HTMLElement>();
const plansByTable = computed(
  () =>
    new Map(tableRecords.value.map(({ plan }) => [plan.target_table, plan])),
);
const visibleTables = computed(() => form.value.tables);
const errorTableCount = computed(() => totals.errors);
watch(
  [
    tableKeyword,
    onlyErrors,
    locatedTable,
    strategyTab,
    strategyMode,
    strategyFrequency,
  ],
  () => {
    tablePage.value = 1;
    selectedTables.value = [];
    void loadTables();
  },
);
watch(tablePage, () => void loadTables());
watch(dirty, () => {
  tableGeneration++;
});
function changeTablePage(page: number) {
  if (dirty.value) {
    message.warning('请先保存配置');
    return;
  }
  tablePage.value = page;
}
const failedTables = computed(() =>
  tableRecords.value
    .map((row) => row.plan)
    .filter((row) => row.state === 'failed'),
);
const schedule = reactive({
  cron_expr: '0 * * * * *',
  timezone_offset_seconds: 28_800,
  enabled: false,
});
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
  confirmed: totals.confirmed,
  pending: totals.pending,
  excluded: totals.excluded,
}));
const tableColumns = [
  { title: '源表', key: 'source', width: 230 },
  { title: '目标表', dataIndex: 'target_table', width: 180 },
  { title: '同步策略', key: 'strategy', width: 210 },
  { title: '同步频率', key: 'frequency', width: 170 },
  { title: '确认', key: 'confirmed', width: 70 },
  { title: '状态 / 原因', key: 'state', width: 240 },
  { title: '操作', key: 'actions', width: 160 },
];
function blank(): DatabaseWrite {
  return {
    receipt_database: '_kx_sync_meta',
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
      selected.value = {
        ...current,
        plan: tableRecords.value.map((row) => row.plan),
      };
      const pendingId = taskPending.value;
      const taskId = pendingId ?? current.last_task_id;
      if (taskId) {
        const task = await DatabaseSyncApi.task(id, taskId);
        if (
          !open.value ||
          selected.value?.id !== id ||
          taskPending.value !== pendingId
        )
          return;
        lastRun.value = task;
        if (
          pendingId &&
          !['queued', 'retrying', 'running'].includes(task.status)
        ) {
          taskError.value = task.error_message ?? '';
          taskPending.value = undefined;
        }
      }
      if (
        !dirty.value &&
        !current.active_task_id &&
        (!taskPending.value || current.last_task_id === taskPending.value)
      ) {
        form.value = { ...copy(current.config), tables: form.value.tables };
        form.value.version = current.version;
        taskPending.value = undefined;
      }
      await loadTables();
    }
  } finally {
    loading = false;
  }
}
async function show(record?: DatabaseSync) {
  lastRun.value = undefined;
  selected.value = record ? await DatabaseSyncApi.detail(record.id) : undefined;
  form.value = selected.value ? copy(selected.value.config) : blank();
  form.value.version = selected.value?.version;
  strategyTab.value = 'confirmed';
  dirty.value = false;
  selectedTables.value = [];
  resetTableFilters();
  tablePage.value = 1;
  open.value = true;
  taskPending.value = undefined;
  taskError.value = '';
  await nextTick();
  await loadTables();
  if (!totals.confirmed) strategyTab.value = 'pending';
  if (selected.value?.last_task_id) {
    const { id, last_task_id: taskId } = selected.value;
    const task = await DatabaseSyncApi.task(id, taskId);
    if (
      open.value &&
      selected.value?.id === id &&
      selected.value.last_task_id === taskId
    )
      lastRun.value = task;
  }
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
            cron_expr: '0 * * * * *',
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
    form.value.receipt_database = form.value.receipt_database?.trim() || null;
    if (selected.value) {
      for (const table of form.value.tables) {
        const stored = tableRecords.value.find(
          (row) => row.definition.target_table === table.target_table,
        );
        if (
          stored &&
          JSON.stringify(stored.definition) !== JSON.stringify(table)
        )
          await DatabaseSyncApi.saveTable(selected.value.id, stored, table);
      }
      selected.value = await DatabaseSyncApi.detail(selected.value.id);
    }
    if (selected.value) {
      const task = await DatabaseSyncApi.saveSettings(selected.value.id, {
        ...copy(form.value),
        version: selected.value.version,
      });
      taskPending.value = Number(task.id);
      taskError.value = '';
      dirty.value = false;
      message.success(`已提交配置更新 #${task.id}`);
      await load();
      return;
    }
    const current = await DatabaseSyncApi.save({
      ...copy(form.value),
      tables: [],
    });
    selected.value = {
      ...current,
      plan: tableRecords.value.map((row) => row.plan),
    };
    form.value = copy(current.config);
    form.value.version = current.version;
    dirty.value = false;
    message.success('全库配置已保存');
    await load();
  } finally {
    busy.value = false;
  }
}
async function dispatch(operation: string, targetTable?: string) {
  if (!selected.value || dirty.value) {
    message.warning('请先保存配置');
    return;
  }
  busy.value = true;
  try {
    const task =
      operation === 'sync' && !targetTable
        ? await startDatabase(selected.value)
        : await DatabaseSyncApi.dispatch(
            selected.value.id,
            operation,
            operation === 'activate' ? selected.value.plan_hash : undefined,
            targetTable,
          );
    taskPending.value = Number(task.id);
    taskError.value = '';
    message.success(`已提交任务 #${task.id}`);
    await load();
  } finally {
    busy.value = false;
  }
}
function controlRun(record: DatabaseSync, stop: boolean) {
  Modal.confirm({
    title: stop ? '停止全库同步？' : '启动全库同步？',
    okText: stop ? '停止' : '启动',
    cancelText: '取消',
    zIndex: 2200,
    content: `${record.name}：${stop ? '停止后续调度及本轮所有表，已提交数据保留' : '恢复全库调度并立即同步，单独暂停的表保持暂停'}。`,
    onOk: async () => {
      busy.value = true;
      try {
        if (stop) {
          await stopDatabase(record.id);
          message.success('全库调度已停止，当前运行已请求停止');
        } else {
          const task = await startDatabase(record);
          if (selected.value?.id === record.id) {
            taskPending.value = Number(task.id);
            taskError.value = '';
          }
          message.success(`全库同步已提交 #${task.id}`);
        }
        await load();
      } finally {
        busy.value = false;
      }
    },
  });
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
async function confirmAll() {
  if (dirty.value) {
    message.warning('请先保存配置');
    return;
  }
  await dispatch('confirm');
}
async function editTable(table: DatabaseTable) {
  if (dirty.value) {
    message.warning('请先保存配置');
    return;
  }
  editingRecord.value = tableRecords.value.find(
    (row) => row.definition.target_table === table.target_table,
  );
  linkingJob.value = false;
  editingIndex.value = form.value.tables.indexOf(table);
  editing.value = copy(table);
  separatedTables.value = [];
  activeSourceCodes.value = null;
  const current = editing.value;
  try {
    let jobId = planRow(table)?.job_id ?? table.existing_job_id;
    if (!jobId && selected.value) {
      const jobs = await DataSyncApi.jobs({
        size: 100,
        target_database: form.value.target_database,
        target_table: table.target_table,
      });
      jobId = jobs.items.find(
        (job) =>
          job.database_id === selected.value?.id && job.state !== 'superseded',
      )?.id;
    }
    if (editing.value !== current) return;
    if (!jobId) {
      activeSourceCodes.value = [];
      return;
    }
    const detail = await DataSyncApi.detail(jobId);
    if (editing.value === current)
      activeSourceCodes.value =
        detail.active?.config.sources.map((source) => source.instance_code) ??
        [];
  } catch {
    if (editing.value === current) message.error('读取已启用源绑定失败');
  }
}
async function existingJobs(keyword: string) {
  const result = await DataSyncApi.jobs({
    size: 100,
    keyword,
    target_database: form.value.target_database,
    target_table: editing.value?.target_table,
  });
  return {
    items: result.items
      .filter(
        (job) =>
          job.state !== 'superseded' &&
          (!job.database_id || job.database_id === selected.value?.id),
      )
      .map((job) => ({
        value: String(job.id),
        label: `${job.name} (#${job.id})`,
      })),
    has_more: result.total > 100,
  };
}
async function linkJob(value: string) {
  const table = editing.value;
  if (!table) return;
  if (!value) {
    table.existing_job_id = null;
    return;
  }
  linkingJob.value = true;
  try {
    const detail = await DataSyncApi.detail(Number(value));
    if (editing.value !== table) return;
    const config = detail.draft?.config ?? detail.active?.config;
    if (
      !config ||
      detail.job.target_database !== form.value.target_database ||
      detail.job.target_table !== table.target_table
    ) {
      message.warning('已有任务目标不匹配');
      return;
    }
    const identity = (source: SyncConfig['sources'][number]) =>
      JSON.stringify([source.instance_code, source.schema, source.table]);
    if (
      !config.sources.every((source) =>
        table.config.sources.some(
          (next) => identity(next) === identity(source),
        ),
      )
    ) {
      message.warning('已有任务源实例或源表范围不一致');
      return;
    }
    table.existing_job_id = detail.job.id;
    const extra = table.config.sources.filter(
      (source) =>
        !config.sources.some(
          (old) => old.instance_code === source.instance_code,
        ),
    );
    table.config = copy(config);
    table.config.sources.push(...extra);
    activeSourceCodes.value =
      detail.active?.config.sources.map((source) => source.instance_code) ?? [];
    table.confirmed = true;
  } catch {
    if (editing.value === table) message.error('读取已有任务失败');
  } finally {
    if (editing.value === table) linkingJob.value = false;
  }
}
function separateSource(instance: string) {
  if (!editing.value || !activeSourceCodes.value) return;
  const target = `${editing.value.target_table}_${instance}`
    .replaceAll('-', '_')
    .slice(0, 128);
  const result = splitDatabaseTableSource(
    editing.value,
    instance,
    activeSourceCodes.value,
    target,
  );
  editing.value = result.main;
  separatedTables.value.push(result.separate);
}
async function saveTable() {
  if (!editing.value || linkingJob.value) return;
  let invalid: string | undefined;
  if (editing.value.excluded_reason === null) {
    invalid = validateDatabaseTable(form.value, editing.value);
  } else if (!editing.value.excluded_reason.trim()) {
    invalid = '请填写排除原因';
  }
  if (invalid) {
    message.warning(invalid);
    return;
  }
  const targets = new Set(
    form.value.tables
      .filter((_, index) => index !== editingIndex.value)
      .map((table) => table.target_table),
  );
  for (const table of [editing.value, ...separatedTables.value]) {
    if (
      !/^[A-Z_a-z][\w]{0,127}$/.test(table.target_table) ||
      targets.has(table.target_table)
    ) {
      message.warning('目标表名不合法或重复');
      return;
    }
    targets.add(table.target_table);
  }
  editing.value.confirmed = true;
  editing.value.suggestion_error = null;
  if (
    locatedTable.value === form.value.tables[editingIndex.value]?.target_table
  ) {
    locatedTable.value = editing.value.target_table;
    tableKeyword.value = editing.value.target_table;
  }
  if (!selected.value) return;
  const stored = editingRecord.value;
  if (!stored) return;
  await DatabaseSyncApi.saveTable(
    selected.value.id,
    stored,
    copy(editing.value),
    copy(separatedTables.value),
  );
  editing.value = undefined;
  selected.value = await DatabaseSyncApi.detail(selected.value.id);
  strategyTab.value = 'confirmed';
  dirty.value = false;
  await loadTables();
}
function planRow(table: DatabaseTable) {
  return plansByTable.value.get(table.target_table);
}
function searchTables(value: string) {
  if (dirty.value) {
    message.warning('请先保存配置');
    return;
  }
  locatedTable.value = undefined;
  tableKeyword.value = value;
}
function resetTableFilters() {
  strategyMode.value = 'all';
  strategyFrequency.value = 'all';
  tableKeyword.value = '';
  onlyErrors.value = false;
  locatedTable.value = undefined;
}
async function locateTable(target: string) {
  if (dirty.value) {
    message.warning('请先保存配置');
    return;
  }
  const id = selected.value?.id;
  let table = form.value.tables.find((t) => t.target_table === target);
  if (!table && id) {
    const result = await DatabaseSyncApi.tables(id, {
      target_table: target,
      page: 1,
      size: 1,
    });
    table = result.page.items[0]?.definition;
  }
  if (dirty.value || selected.value?.id !== id || !open.value) return;
  strategyTab.value =
    table?.confirmed && table.excluded_reason === null
      ? 'confirmed'
      : 'pending';
  strategyMode.value = 'all';
  strategyFrequency.value = 'all';
  onlyErrors.value = false;
  tableKeyword.value = target;
  locatedTable.value = target;
  tablePage.value = 1;
  await nextTick();
  strategiesHeading.value?.scrollIntoView({ block: 'start' });
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
    !selected.value.schedule_paused && selected.value.state !== 'paused',
    selected.value.version,
  );
  await load();
}
onMounted(async () => {
  await load();
  const id = Number(route.query.database_id);
  if (id > 0) await show(await DatabaseSyncApi.detail(id));
  polling.start();
});
const polling = useTaskPolling({
  delay: 5000,
  load: async () => {
    const query = { page: pagination.current, size: pagination.pageSize };
    const id = open.value ? selected.value?.id : undefined;
    const pendingId = taskPending.value;
    const taskId = pendingId ?? selected.value?.last_task_id;
    const [page, current, task] = await Promise.all([
      DatabaseSyncApi.list(query),
      id ? DatabaseSyncApi.detail(id) : undefined,
      id && taskId ? DatabaseSyncApi.task(id, taskId) : undefined,
    ]);
    return { query, id, pendingId, page, current, task };
  },
  accept: ({ query, id, pendingId, page, current, task }) => {
    if (
      query.page === pagination.current &&
      query.size === pagination.pageSize
    ) {
      rows.value = page.items;
      pagination.total = page.total;
    }
    if (
      !current ||
      !open.value ||
      selected.value?.id !== id ||
      taskPending.value !== pendingId
    )
      return;
    selected.value = current;
    if (task) lastRun.value = task;
    if (
      task &&
      pendingId &&
      !['queued', 'retrying', 'running'].includes(task.status)
    ) {
      taskError.value = task.error_message ?? '';
      taskPending.value = undefined;
    }
    if (
      !dirty.value &&
      !current.active_task_id &&
      (!taskPending.value || current.last_task_id === taskPending.value)
    ) {
      form.value = { ...copy(current.config), tables: form.value.tables };
      form.value.version = current.version;
      taskPending.value = undefined;
    }
    void loadTables();
  },
});
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
        { title: '操作', key: 'actions', width: 110 },
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
          {{ record.schedule_paused ? ' / 调度已停止' : '' }}
        </Tag>
        <div v-else-if="column.key === 'actions' && execute" class="flex gap-1">
          <Tooltip title="启动全库同步">
            <Button
              type="text"
              aria-label="启动全库同步"
              :disabled="
                !['ready', 'paused'].includes(record.state) ||
                !!record.active_task_id ||
                busy
              "
              @click="controlRun(record, false)"
            >
              <Play class="size-4" />
            </Button>
          </Tooltip>
          <Tooltip title="停止全库同步">
            <Button
              type="text"
              danger
              aria-label="停止全库同步"
              :disabled="
                (record.schedule_paused && !record.active_task_id) || busy
              "
              @click="controlRun(record, true)"
            >
              <Square class="size-4" />
            </Button>
          </Tooltip>
        </div>
      </template>
    </Table>
    <Modal
      :open="open"
      :title="selected ? selected.name : '新增全库同步配置'"
      width="min(96vw, 1800px)"
      :footer="null"
      :style="{ top: '24px' }"
      :styles="{
        body: { maxHeight: 'calc(100dvh - 140px)', overflowY: 'auto' },
      }"
      :z-index="2100"
      @cancel="open = false"
    >
      <Alert
        v-if="taskError || selected?.last_error || failedTables.length"
        type="error"
        show-icon
        :message="
          databaseErrorText(
            taskError ||
              selected?.last_error ||
              'data_sync_database_tables_failed',
          )
        "
        class="mb-4"
      >
        <template v-if="failedTables.length" #description>
          <div
            v-for="row in failedTables.slice(0, 20)"
            :key="row.target_table"
            class="failed-table"
          >
            <Button
              type="link"
              class="failed-table-link"
              :aria-label="`定位错误表 ${row.target_table}`"
              @click="locateTable(row.target_table)"
            >
              {{ row.target_table }}
</Button>：{{ databaseErrorText(row.error || '检查或执行失败') }}
          </div>
        </template>
      </Alert>
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
          :disabled="!selected || !canEdit || dirty || !counts.confirmed"
          @click="dispatch('inspect')"
        >
          {{
            counts.pending || counts.excluded ? '检查已确认表' : '检查所有表'
          }}
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
          :disabled="
            !selected ||
            !['ready', 'paused'].includes(selected.state) ||
            !!selected.active_task_id ||
            dirty ||
            busy
          "
          @click="dispatch('sync')"
        >
          {{
            counts.pending || counts.excluded ? '同步已确认表' : '立即同步全库'
          }}
        </Button>
        <Button
          v-if="
            execute &&
            (selected?.state === 'blocked' ||
              selected?.active_task_id ||
              (selected?.failed_tables ?? 0) > 0)
          "
          :disabled="busy"
          @click="dispatch('reconcile')"
        >
          回执对账
        </Button>
        <Button
          v-if="execute && selected"
          danger
          :disabled="busy"
          @click="controlRun(selected, true)"
        >
          停止全库同步
        </Button>
        <Button
          v-if="
            configure &&
            selected &&
            ['ready', 'paused'].includes(selected.state)
          "
          @click="pause"
        >
          {{
            selected.schedule_paused || selected.state === 'paused'
              ? '恢复调度'
              : '暂停调度'
          }}
        </Button>
      </div>
      <div v-if="selected" class="status-line">
        {{ selected.schedule_paused ? '调度已停止 · ' : '' }}
        {{ states[selected.state] ?? selected.state }} · 成功
        {{ selected.completed_tables }} / {{ selected.total_tables }} · 失败
        {{ selected.failed_tables
        }}<span v-if="taskPending"> · 已提交 #{{ taskPending }}</span>
        <span
          v-if="
            lastRun?.executor_code === 'data_sync.database.sync' &&
            lastRun.status === 'succeeded' &&
            Number(lastRun.id) === selected.last_task_id
          "
        >
          · 同步耗时：{{ formatSyncDuration(lastRun) }}</span>
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
          <label class="field">回执数据库<Input
              v-model:value="form.receipt_database"
              placeholder="_kx_sync_meta"
              :disabled="!canEdit"
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
      <h3 ref="strategiesHeading">逐表同步策略</h3>
      <Tabs v-model:active-key="strategyTab">
        <TabPane
          key="confirmed"
          :disabled="dirty"
          :tab="`已确认（${counts.confirmed}）`"
        />
        <TabPane
          key="pending"
          :disabled="dirty"
          :tab="`待配置 / 已跳过（${counts.pending + counts.excluded}）`"
        />
      </Tabs>
      <Tabs v-model:active-key="strategyMode" size="small">
        <TabPane key="all" tab="全部类型" :disabled="dirty" />
        <TabPane
          v-for="item in strategyOptions"
          :disabled="dirty"
          :key="item.value"
          :tab="item.label"
        />
      </Tabs>
      <Tabs v-model:active-key="strategyFrequency" size="small">
        <TabPane key="all" tab="全部频率" :disabled="dirty" />
        <TabPane
          v-for="item in frequencyOptions"
          :disabled="dirty"
          :key="item.value"
          :tab="item.label"
        />
      </Tabs>
      <div class="toolbar table-filters">
        <Input
          :value="tableKeyword"
          :disabled="dirty"
          allow-clear
          aria-label="搜索逐表同步策略"
          placeholder="源表、目标表、备注或错误原因"
          class="table-search"
          @update:value="searchTables"
        >
          <template #prefix><Search class="size-4" /></template>
        </Input>
        <Checkbox v-model:checked="onlyErrors" :disabled="dirty">
          仅看错误表（{{ errorTableCount }}）
        </Checkbox>
        <Tooltip title="清除表筛选" :z-index="2500">
          <Button
            aria-label="清除表筛选"
            :disabled="dirty || (!tableKeyword && !onlyErrors && !locatedTable)"
            @click="resetTableFilters"
          >
            <FilterX class="size-4" />
          </Button>
        </Tooltip>
        <span role="status">显示 {{ visibleTables.length }} / {{ totals.total }} 张表</span>
      </div>
      <div class="toolbar">
        <span>参与 {{ counts.confirmed }} · 排除 {{ counts.excluded }} · 待确认跳过
          {{ counts.pending }}</span><template v-if="configure">
          <Button :disabled="!canEdit || !counts.pending" @click="confirmAll">
            <CheckCheck class="size-4" />全部确认
          </Button>
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
        :data-source="visibleTables"
        class="strategy-table"
        row-key="target_table"
        :columns="tableColumns"
        :scroll="{ x: 1270 }"
        :pagination="{
          current: tablePage,
          pageSize: 20,
          showSizeChanger: false,
          total: totals.total,
        }"
        :locale="{
          emptyText:
            totals.confirmed + totals.pending + totals.excluded
              ? '没有匹配的表'
              : '暂无源表',
        }"
        @change="(p) => changeTablePage(p.current ?? 1)"
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
          <span v-else-if="column.key === 'frequency'">{{
            tableFrequencyLabel(record.sync_interval_seconds)
          }}</span>
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
              : databaseTableError(record, planRow(record)) ||
                (record.confirmed
                  ? (states[planRow(record)?.state ?? ''] ?? '待检查')
                  : '未确认，暂不执行')
          }}</span>
          <div v-else-if="column.key === 'actions'" class="toolbar">
            <Button
              v-if="execute"
              size="small"
              :disabled="
                selected?.state !== 'ready' ||
                locked ||
                dirty ||
                !record.confirmed ||
                !planRow(record)?.revision_id ||
                !planRow(record)?.plan_hash ||
                record.excluded_reason !== null
              "
              @click="dispatch('sync', record.target_table)"
            >
              同步一次
            </Button>
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
    </Modal>
    <Modal
      :open="!!editing"
      :title="editing?.target_table"
      :width="1000"
      :z-index="2400"
      ok-text="确认本表配置"
      :ok-button-props="{ disabled: linkingJob }"
      @ok="saveTable"
      @cancel="editing = undefined"
    >
      <fieldset
        v-if="editing"
        :disabled="linkingJob"
        :inert="linkingJob"
        class="table-editor configuration"
      >
        <label class="field mb-4">关联已有同步任务<MetadataSelect
            :value="
              editing.existing_job_id ? String(editing.existing_job_id) : ''
            "
            label="已有同步任务"
            allow-clear
            :disabled="linkingJob"
            :context-key="
              JSON.stringify([
                form.target_ds_code,
                form.target_database,
                editing.target_table,
              ])
            "
            :load="existingJobs"
            placeholder="不关联，检查时创建任务"
            @change="linkJob"
        /></label>
        <Alert
          v-if="databaseTableError(editing, planRow(editing))"
          type="error"
          show-icon
          class="mb-4"
          :message="databaseTableError(editing, planRow(editing))"
        />
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
          <h3>同步频率</h3>
          <TableFrequency v-model:value="editing.sync_interval_seconds" />
          <div
            v-for="(source, index) in editing.config.sources"
            :key="source.instance_code"
          >
            <h3>{{ source.instance_code }}</h3>
            <Button
              v-if="editing.config.sources.length > 1"
              size="small"
              :disabled="
                !activeSourceCodes ||
                activeSourceCodes.includes(source.instance_code)
              "
              @click="separateSource(source.instance_code)"
            >
              拆为独立目标表
            </Button>
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
          <div v-if="separatedTables.length" class="fields">
            <label
              v-for="table in separatedTables"
              :key="table.config.sources[0]?.instance_code"
              class="field"
              >{{ table.config.sources[0]?.instance_code }} 独立目标表<Input
                v-model:value="table.target_table"
            /></label>
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
      </fieldset>
    </Modal>
  </div>
</template>
<style scoped>
.table-search {
  flex: 1 1 260px;
  min-width: 0;
  max-width: 420px;
}

.failed-table {
  overflow-wrap: anywhere;
}

.failed-table-link {
  max-width: 100%;
  height: auto;
  padding: 0;
  text-align: left;
  white-space: normal;
}

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
