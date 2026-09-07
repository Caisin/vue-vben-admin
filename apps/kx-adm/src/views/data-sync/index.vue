<script setup lang="ts">
import type {
  Batch,
  Instance,
  Job,
  JobDetail,
  RunDetail,
  SyncRun,
} from '#/api/data-sync';

import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { useAccess } from '@vben/access';
import { Page } from '@vben/common-ui';
import { createIconifyIcon, Plus } from '@vben/icons';

import {
  Alert,
  Button,
  Checkbox,
  Drawer,
  Dropdown,
  Input,
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
import { useTaskPolling } from '#/task-polling';

import { operations, states } from './data';
import DatabasePanel from './database-panel.vue';
import { formatSyncDuration } from './duration';
import InstanceEditor from './instance-editor.vue';
import JobEditor from './job-editor.vue';
import {
  isSchemaConflict,
  schemaConflictErrors,
  schemaSettingsQuery,
} from './schema-conflict';
import SqlPreview from './sql-preview.vue';
import { startDatabase, startJob, stopDatabase, stopJob } from './sync-control';

const route = useRoute();
const router = useRouter();
const activeTab = ref(route.query.database_id ? 'databases' : 'jobs');
const RefreshCw = createIconifyIcon('lucide:refresh-cw');
const Play = createIconifyIcon('lucide:play');
const Square = createIconifyIcon('lucide:square');
const Database = createIconifyIcon('lucide:database');
const Settings2 = createIconifyIcon('lucide:settings-2');
const { hasAccessByCodes } = useAccess();
const configure = computed(() => hasAccessByCodes(['data-sync:configure']));
const execute = computed(() => hasAccessByCodes(['data-sync:execute']));
const jobs = ref<Job[]>([]);
const instances = ref<Instance[]>([]);
const loading = ref(false);
const keyword = ref('');
const mode = ref('all');
const frequency = ref('all');
const issue = ref('all');
watch([mode, frequency, issue], () => {
  pagination.current = 1;
  load();
});
const pagination = reactive({
  current: 1,
  pageSize: 20,
  total: 0,
  showSizeChanger: true,
});
const detail = ref<JobDetail>();
const editorDetail = ref<JobDetail>();
const editOpen = ref(false);
const instanceOpen = ref(false);
const editingInstance = ref<Instance>();
const runs = ref<SyncRun[]>([]);
const runDetail = ref<RunDetail>();
const batches = ref<Batch[]>([]);
const runPage = reactive({ current: 1, pageSize: 10, total: 0 });
const batchPage = reactive({ current: 1, pageSize: 20, total: 0 });
const actionBusy = ref(false);
const scheduleBusy = ref(false);
const schedule = reactive({
  cron_expr: '0 */5 * * * *',
  timezone_offset_seconds: 28_800,
  enabled: false,
});
const plan = computed(
  () => detail.value?.draft?.schema_plan ?? detail.value?.active?.schema_plan,
);
const scheduleId = ref<number>();
const columns = [
  { title: '任务', key: 'name', dataIndex: 'name', width: 220 },
  { title: '目标', key: 'target', width: 260 },
  { title: '状态', key: 'state', width: 150 },
  { title: '失败原因', key: 'error' },
  { title: '操作', key: 'actions', width: 240 },
];
const runColumns = [
  { title: '运行', dataIndex: 'id', key: 'id' },
  { title: '操作', key: 'operation' },
  { title: '状态', key: 'state' },
  { title: '同步耗时', key: 'duration', width: 130 },
  { title: '读取行数', dataIndex: 'read_rows' },
  { title: '写入行数', dataIndex: 'written_rows' },
  { title: '错误', dataIndex: 'error_code' },
];
const sourceColumns = [
  { title: '源实例', key: 'instance' },
  { title: '阶段', dataIndex: 'phase' },
  { title: '状态', key: 'state' },
  { title: '读取', dataIndex: 'read_rows' },
  { title: '写入', dataIndex: 'written_rows' },
  { title: '批次', dataIndex: 'batches' },
  { title: '目标最大 ID', dataIndex: 'target_max_id' },
];
const batchColumns = [
  { title: '实例', key: 'instance' },
  { title: '序号', dataIndex: 'seq' },
  { title: '状态', key: 'state' },
  { title: '读取', dataIndex: 'read_rows' },
  { title: '写入', dataIndex: 'written_rows' },
  { title: '字节', dataIndex: 'bytes' },
  { title: '错误', dataIndex: 'error_code' },
];
function color(state: string) {
  return (
    (
      {
        blocked: 'error',
        schema_conflict: 'error',
        failed: 'error',
        unknown: 'warning',
        running: 'processing',
        ready: 'success',
        succeeded: 'success',
        committed: 'success',
      } as Record<string, string>
    )[state] ?? 'default'
  );
}
function instanceName(id: number) {
  return (
    plan.value?.bindings.find((binding) => binding.binding_id === id)
      ?.instance_code ?? String(id)
  );
}
async function load(spinner = true) {
  if (spinner) loading.value = true;
  try {
    const page = await DataSyncApi.jobs({
      keyword: keyword.value,
      mode: mode.value,
      frequency: frequency.value,
      schema_conflicts: issue.value === 'schema_conflict' || undefined,
      page: pagination.current,
      size: pagination.pageSize,
    });
    jobs.value = page.items;
    pagination.total = page.total;
    instances.value = await DataSyncApi.instances();
  } finally {
    loading.value = false;
  }
}
async function loadRuns(id: number) {
  const page = await DataSyncApi.runs(id, {
    page: runPage.current,
    size: runPage.pageSize,
  });
  if (detail.value?.job.id === id) {
    runs.value = page.items;
    runPage.total = page.total;
  }
}
async function show(job: Job) {
  detail.value = await DataSyncApi.detail(job.id);
  runPage.current = 1;
  const saved = await DataSyncApi.schedule(job.id);
  scheduleId.value = saved?.id;
  Object.assign(
    schedule,
    saved
      ? {
          cron_expr: saved.cron_expr,
          timezone_offset_seconds: saved.timezone_offset_seconds,
          enabled: saved.status === 'enabled',
        }
      : {
          cron_expr: '0 */5 * * * *',
          timezone_offset_seconds: 28_800,
          enabled: false,
        },
  );
  await loadRuns(job.id);
}
async function edit(job?: Job) {
  editorDetail.value = job ? await DataSyncApi.detail(job.id) : undefined;
  editOpen.value = true;
}
async function resolveConflict(job: Job) {
  if (!configure.value) return;
  if (job.database_id) {
    await router.push({
      path: '/data-sync/jobs',
      query: schemaSettingsQuery(job, true),
    });
    activeTab.value = 'databases';
    return;
  }
  await show(job);
  if (detail.value?.job.active_run_id) {
    message.warning('当前运行未结束或存在待对账批次，暂不能修改配置');
    return;
  }
  await edit(detail.value?.job);
}
async function saved(id: number) {
  await load();
  const current = await DataSyncApi.detail(id);
  await show(current.job);
}
async function dispatch(
  action: 'activate' | 'inspect' | 'reconcile' | 'sync',
  job = detail.value?.job,
) {
  if (!job) return;
  const request =
    action === 'activate'
      ? {
          approved_plan_hash: detail.value?.draft?.plan_hash,
          revision_id: detail.value?.draft?.id,
        }
      : {};
  actionBusy.value = true;
  try {
    const task =
      action === 'sync'
        ? await startJob(job)
        : await DataSyncApi.dispatch(job.id, action, request);
    message.success(`任务已提交 #${task.id}`);
    await load(false);
  } finally {
    actionBusy.value = false;
  }
}
function stopTable(job: Job) {
  stopRun(job.id, `${job.target_database}.${job.target_table}`);
}
function stopRun(id: number, target: string) {
  Modal.confirm({
    title: '停止本表同步？',
    okText: '停止',
    cancelText: '取消',
    zIndex: 2200,
    content: `${target}：停止后续定时调度并停止本次运行，不影响其它表。已提交数据保留，未确定提交结果需要对账。`,
    onOk: async () => {
      actionBusy.value = true;
      try {
        await stopJob(id);
        message.success('本表调度已停止，当前运行已请求停止');
        await load(false);
        if (runDetail.value?.run.job_id === id)
          await showRun(runDetail.value.run);
      } finally {
        actionBusy.value = false;
      }
    },
  });
}
function controlDatabase(job: Job, stop: boolean) {
  if (!job.database_id) return;
  const id = job.database_id;
  Modal.confirm({
    title: stop ? '停止所属全库同步？' : '启动所属全库同步？',
    okText: stop ? '停止' : '启动',
    cancelText: '取消',
    zIndex: 2200,
    content: `${job.target_database}：${stop ? '停止所属全库后续调度及本轮所有表，已提交数据保留' : '恢复全库调度并立即同步，单独暂停的表保持暂停'}。`,
    onOk: async () => {
      actionBusy.value = true;
      try {
        if (stop) {
          await stopDatabase(id);
          message.success('全库调度已停止，当前运行已请求停止');
        } else {
          const task = await startDatabase(await DatabaseSyncApi.detail(id));
          message.success(`全库同步已提交 #${task.id}`);
        }
        await load(false);
      } finally {
        actionBusy.value = false;
      }
    },
  });
}
function activate() {
  Modal.confirm({
    title: '确认目标结构并启用',
    content: `${detail.value?.job.target_database}.${detail.value?.job.target_table}`,
    onOk: () => dispatch('activate'),
  });
}
async function pause() {
  if (!detail.value) return;
  await DataSyncApi.state(
    detail.value.job,
    !detail.value.job.schedule_paused && detail.value.job.state !== 'paused',
  );
  detail.value = await DataSyncApi.detail(detail.value.job.id);
  await load(false);
}
async function showRun(run: SyncRun) {
  runDetail.value = await DataSyncApi.run(run.id);
  batchPage.current = 1;
  await loadBatches(run.id);
}
async function loadBatches(id: number) {
  const page = await DataSyncApi.batches(id, {
    page: batchPage.current,
    size: batchPage.pageSize,
  });
  if (runDetail.value?.run.id === id) {
    batches.value = page.items;
    batchPage.total = page.total;
  }
}
async function saveSchedule() {
  if (!detail.value) return;
  scheduleBusy.value = true;
  try {
    const result = await DataSyncApi.saveSchedule(
      detail.value.job.id,
      schedule,
    );
    scheduleId.value = result.id;
    message.success('定时配置已保存');
  } finally {
    scheduleBusy.value = false;
  }
}
const polling = useTaskPolling({
  delay: 5000,
  load: async () => {
    const query = {
      keyword: keyword.value,
      mode: mode.value,
      frequency: frequency.value,
      schema_conflicts: issue.value === 'schema_conflict' || undefined,
      page: pagination.current,
      size: pagination.pageSize,
    };
    const jobId = detail.value?.job.id;
    const runId = runDetail.value?.run.id;
    const runQuery = { page: runPage.current, size: runPage.pageSize };
    const batchQuery = { page: batchPage.current, size: batchPage.pageSize };
    const [page, sourceInstances, job, history, run, batchHistory] =
      await Promise.all([
        DataSyncApi.jobs(query),
        DataSyncApi.instances(),
        jobId ? DataSyncApi.detail(jobId) : undefined,
        jobId ? DataSyncApi.runs(jobId, runQuery) : undefined,
        runId ? DataSyncApi.run(runId) : undefined,
        runId ? DataSyncApi.batches(runId, batchQuery) : undefined,
      ]);
    return {
      query,
      jobId,
      runId,
      runQuery,
      batchQuery,
      page,
      sourceInstances,
      job,
      history,
      run,
      batchHistory,
    };
  },
  accept: (result) => {
    if (
      result.query.keyword === keyword.value &&
      result.query.mode === mode.value &&
      result.query.frequency === frequency.value &&
      result.query.schema_conflicts ===
        (issue.value === 'schema_conflict' || undefined) &&
      result.query.page === pagination.current &&
      result.query.size === pagination.pageSize
    ) {
      jobs.value = result.page.items;
      pagination.total = result.page.total;
    }
    instances.value = result.sourceInstances;
    if (result.job && detail.value?.job.id === result.jobId) {
      detail.value = result.job;
      if (
        result.history &&
        runPage.current === result.runQuery.page &&
        runPage.pageSize === result.runQuery.size
      ) {
        runs.value = result.history.items;
        runPage.total = result.history.total;
      }
    }
    if (result.run && runDetail.value?.run.id === result.runId) {
      runDetail.value = result.run;
      if (
        result.batchHistory &&
        batchPage.current === result.batchQuery.page &&
        batchPage.pageSize === result.batchQuery.size
      ) {
        batches.value = result.batchHistory.items;
        batchPage.total = result.batchHistory.total;
      }
    }
  },
});
async function openRoute() {
  if (route.path !== '/data-sync/jobs') return;
  if (Number(route.query.database_id) > 0) {
    detail.value = undefined;
    editOpen.value = false;
    activeTab.value = 'databases';
    return;
  }
  const id = Number(route.query.job_id);
  if (id > 0) {
    activeTab.value = 'jobs';
    const current = await DataSyncApi.detail(id);
    if (Number(route.query.job_id) !== id) return;
    await show(current.job);
    if (route.query.edit === '1' && configure.value) {
      if (current.job.active_run_id)
        message.warning('当前运行未结束或存在待对账批次，暂不能修改配置');
      else await edit(current.job);
    }
  }
}
watch(() => route.fullPath, openRoute);
onMounted(async () => {
  await load();
  await openRoute();
  polling.start();
});
</script>

<template>
  <Page title="数据同步" class="management-page">
    <Tabs v-model:active-key="activeTab">
      <TabPane key="databases" tab="全库同步">
        <DatabasePanel
          v-if="activeTab === 'databases'"
          :instances="instances"
          :configure="configure"
          :execute="execute"
          @job="show"
        />
      </TabPane>
      <TabPane key="jobs" tab="同步任务">
        <Tabs v-model:active-key="issue" size="small">
          <TabPane key="all" tab="全部任务" />
          <TabPane key="schema_conflict" tab="结构冲突" />
        </Tabs>
        <Tabs v-model:active-key="mode" size="small">
          <TabPane key="all" tab="全部类型" /><TabPane
            key="id_append"
            tab="ID 增量"
          /><TabPane key="id_and_time" tab="ID + 时间" /><TabPane
            key="time_window"
            tab="时间窗口"
          /><TabPane key="full_table" tab="全表刷新" />
        </Tabs>
        <Tabs v-model:active-key="frequency" size="small">
          <TabPane key="all" tab="全部频率" /><TabPane
            key="scheduled"
            tab="独立定时"
          /><TabPane key="database" tab="全库调度" /><TabPane
            key="manual"
            tab="手动任务"
          />
        </Tabs>
        <div class="toolbar">
          <Input.Search
            v-model:value="keyword"
            placeholder="任务名称"
            allow-clear
            class="search"
            @search="
              pagination.current = 1;
              load();
            "
          />
          <Tooltip title="刷新">
            <Button aria-label="刷新" @click="load()">
              <RefreshCw class="size-4" />
            </Button>
          </Tooltip>
          <Button v-if="configure" type="primary" @click="edit()">
            <Plus class="size-4" />新增任务
          </Button>
        </div>
        <Table
          :columns="columns"
          :data-source="jobs"
          row-key="id"
          :loading="loading"
          :pagination="pagination"
          :scroll="{ x: 800 }"
          @change="
            (page) => {
              pagination.current = page.current ?? 1;
              pagination.pageSize = page.pageSize ?? 20;
              load();
            }
          "
        >
          <template #bodyCell="{ column, record }">
            <a
              v-if="column.key === 'name'"
              :href="`/data-sync/jobs?job_id=${record.id}`"
              @click.prevent="show(record)"
              >{{ record.name }}</a>
            <span v-else-if="column.key === 'target'">{{ record.target_database }}.{{ record.target_table }}</span>
            <div v-else-if="column.key === 'error'">
              {{
                schemaConflictErrors[record.last_error ?? ''] ??
                record.last_error ??
                (record.state === 'schema_conflict'
                  ? '结构已检查，待确认启用'
                  : '')
              }}
              <div
                v-if="isSchemaConflict(record.last_error)"
                class="text-xs text-muted-foreground"
              >
                {{ record.last_error }}
              </div>
            </div>
            <div
              v-else-if="column.key === 'state'"
              class="flex flex-wrap gap-1"
            >
              <Tag :color="color(record.state)">
                {{ states[record.state] ?? record.state }}
              </Tag>
              <Tag v-if="record.schedule_paused" color="warning">
                调度已停止
              </Tag>
            </div>
            <div
              v-else-if="column.key === 'actions'"
              class="flex flex-wrap gap-1"
            >
              <Button
                v-if="
                  configure &&
                  (record.state === 'schema_conflict' ||
                    isSchemaConflict(record.last_error))
                "
                size="small"
                @click="resolveConflict(record)"
              >
                处理冲突
              </Button>
              <Tooltip v-if="execute" title="启动本表同步">
                <Button
                  type="text"
                  aria-label="启动本表同步"
                  size="small"
                  :disabled="
                    !['ready', 'paused'].includes(record.state) ||
                    !!record.active_run_id ||
                    actionBusy
                  "
                  @click="dispatch('sync', record)"
                >
                  <Play class="size-4" />
                </Button>
              </Tooltip>
              <Tooltip v-if="execute" title="停止本表同步">
                <Button
                  type="text"
                  danger
                  aria-label="停止本表同步"
                  size="small"
                  :disabled="
                    (record.schedule_paused && !record.active_run_id) ||
                    record.state === 'superseded' ||
                    actionBusy
                  "
                  @click="stopTable(record)"
                >
                  <Square class="size-4" />
                </Button>
              </Tooltip>
              <Dropdown
                v-if="execute && record.database_id"
                :trigger="['click']"
                :menu="{
                  items: [
                    { key: 'start', label: '启动所属全库同步' },
                    { key: 'stop', label: '停止所属全库同步', danger: true },
                  ],
                  onClick: ({ key }) => controlDatabase(record, key === 'stop'),
                }"
              >
                <Button
                  type="text"
                  aria-label="所属全库操作"
                  size="small"
                  title="所属全库操作"
                  :disabled="actionBusy"
                >
                  <Database class="size-4" />
                </Button>
              </Dropdown>
              <Tooltip v-if="configure && !record.database_id" title="编辑配置">
                <Button
                  type="text"
                  :disabled="!!record.active_run_id"
                  @click="edit(record)"
                  size="small"
                >
                  <Settings2 class="size-4" />
                </Button>
              </Tooltip>
            </div>
          </template>
        </Table>
      </TabPane>
      <TabPane key="instances" tab="源实例">
        <div class="toolbar">
          <Button
            v-if="configure"
            type="primary"
            @click="
              editingInstance = undefined;
              instanceOpen = true;
            "
          >
            <Plus class="size-4" />新增实例
          </Button>
        </div>
        <Table
          :data-source="instances"
          row-key="code"
          :columns="[
            { title: '实例编码', dataIndex: 'code' },
            { title: '显示名称', key: 'name' },
            { title: '数据源', dataIndex: 'ds_code' },
            { title: '状态', key: 'enabled' },
          ]"
        >
          <template #bodyCell="{ column, record }">
            <a
              v-if="column.key === 'name' && configure"
              @click="
                editingInstance = record;
                instanceOpen = true;
              "
              >{{ record.name }}</a>
            <span v-else-if="column.key === 'name'">{{ record.name }}</span>
            <Tag
              v-else-if="column.key === 'enabled'"
              :color="record.enabled ? 'success' : 'default'"
            >
              {{ record.enabled ? '启用' : '停用' }}
            </Tag>
          </template>
        </Table>
      </TabPane>
    </Tabs>
    <Drawer
      :open="!!detail"
      :title="detail?.job.name"
      size="min(1000px, 100vw)"
      :z-index="2000"
      @close="detail = undefined"
    >
      <template v-if="detail">
        <div class="toolbar">
          <Tag :color="color(detail.job.state)">
            {{ states[detail.job.state] }}
            {{ detail.job.schedule_paused ? ' / 调度已停止' : '' }}
          </Tag>
          <Button
            v-if="configure && !detail.job.database_id"
            :disabled="!!detail.job.active_run_id"
            @click="edit(detail.job)"
          >
            编辑配置
          </Button>
          <Button
            v-if="configure && !detail.job.database_id"
            :disabled="!!detail.job.active_run_id"
            :loading="actionBusy"
            @click="dispatch('inspect')"
          >
            检查结构
          </Button>
          <Button
            v-if="configure && !detail.job.database_id"
            :disabled="
              detail.draft?.state !== 'validated' || !!detail.job.active_run_id
            "
            @click="activate"
          >
            确认建表并启用
          </Button>
          <Button
            v-if="execute"
            type="primary"
            :disabled="
              !['ready', 'paused'].includes(detail.job.state) ||
              !!detail.job.active_run_id
            "
            :loading="actionBusy"
            @click="dispatch('sync')"
          >
            <Play class="size-4" />启动本表同步
          </Button>
          <Button
            v-if="execute"
            danger
            :disabled="
              (detail.job.schedule_paused && !detail.job.active_run_id) ||
              actionBusy
            "
            @click="stopTable(detail.job)"
          >
            <Square class="size-4" />停止本表同步
          </Button>
          <Button
            v-if="execute && !detail.job.database_id"
            :disabled="!detail.job.active_revision_id"
            :loading="actionBusy"
            @click="dispatch('reconcile')"
          >
            回执对账
          </Button>
          <Button
            v-if="configure && !detail.job.database_id"
            :disabled="
              !!detail.job.active_run_id || !detail.job.active_revision_id
            "
            @click="pause"
          >
            {{
              detail.job.schedule_paused || detail.job.state === 'paused'
                ? '恢复调度'
                : '暂停调度'
            }}
          </Button>
        </div>
        <Alert
          v-if="detail.job.last_error"
          :message="detail.job.last_error"
          type="error"
          show-icon
          class="mb-4"
        />
        <Tabs>
          <TabPane key="progress" tab="水位与运行">
            <Table
              size="small"
              :pagination="false"
              :data-source="detail.checkpoints"
              row-key="binding_id"
              :columns="[
                { title: '源实例', key: 'instance' },
                { title: '已确认 ID', dataIndex: 'confirmed_id' },
                { title: '已关闭时间窗', dataIndex: 'closed_time_end' },
                { title: '首次同步', key: 'baseline' },
              ]"
            >
              <template #bodyCell="{ column, record }">
                <span v-if="column.key === 'instance'">{{
                  instanceName(record.binding_id)
                }}</span><Tag v-else-if="column.key === 'baseline'">
                  {{ record.baseline_done ? '完成' : '未完成' }}
                </Tag>
              </template>
            </Table>
            <h3>运行历史</h3>
            <Table
              :data-source="runs"
              :columns="runColumns"
              row-key="id"
              :pagination="runPage"
              :scroll="{ x: 780 }"
              @change="
                (p) => {
                  runPage.current = p.current ?? 1;
                  loadRuns(detail!.job.id);
                }
              "
            >
              <template #bodyCell="{ column, record }">
                <Button
                  v-if="column.key === 'id'"
                  type="link"
                  @click="showRun(record)"
                >
                  #{{ record.id }}
</Button><span v-else-if="column.key === 'operation'">{{
                  operations[record.operation]
                }}</span><Tag
                  v-else-if="column.key === 'state'"
                  :color="color(record.state)"
                >
                  {{ states[record.state] }}
                </Tag>
                <span v-else-if="column.key === 'duration'">{{
                  formatSyncDuration(record)
                }}</span>
              </template>
            </Table>
          </TabPane>
          <TabPane key="schema" tab="字段与建表计划">
            <template v-if="plan">
              <Alert
                v-for="warning in plan.warnings"
                :key="warning"
                :message="warning"
                type="warning"
                show-icon
                class="mb-2"
              />
              <p v-if="plan.primary_key_column" class="key-contract">
                联合键：instance_code + {{ plan.primary_key_column }}
              </p>
              <p v-else class="key-contract">实例隔离字段：instance_code</p>
              <Table
                :data-source="plan.target_columns"
                row-key="name"
                :pagination="false"
                size="small"
                :columns="[
                  { title: '字段', dataIndex: 'name' },
                  { title: '类型', key: 'type' },
                  { title: '允许空值', key: 'nullable' },
                  { title: '备注', dataIndex: 'comment' },
                ]"
              >
                <template #bodyCell="{ column, record }">
                  <span v-if="column.key === 'type'">{{ record.data_type.kind
                    }}<template v-if="record.data_type.kind === 'decimal'">({{ record.data_type.precision }},{{
                        record.data_type.scale
                      }})</template></span><span v-else-if="column.key === 'nullable'">{{
                    record.nullable ? '是' : '否'
                  }}</span>
                </template>
              </Table>
              <h3>目标 DDL</h3>
              <SqlPreview :value="plan.ddl" />
            </template>
            <div v-else class="empty-state">尚无结构检查结果</div>
          </TabPane>
          <TabPane v-if="!detail.job.database_id" key="schedule" tab="定时配置">
            <div class="schedule-form">
              <label>Cron<Input
                  v-model:value="schedule.cron_expr"
                  :disabled="!configure"
              /></label>
              <label>调度时区<Select
                  v-model:value="schedule.timezone_offset_seconds"
                  :disabled="!configure"
                  :options="[
                    { value: 0, label: 'UTC' },
                    { value: 28800, label: 'UTC+08:00' },
                    { value: 32400, label: 'UTC+09:00' },
                    { value: -18000, label: 'UTC-05:00' },
                  ]"
              /></label>
              <Checkbox
                v-model:checked="schedule.enabled"
                :disabled="!configure"
              >
                启用定时同步
              </Checkbox>
              <Button
                v-if="configure"
                type="primary"
                :loading="scheduleBusy"
                @click="saveSchedule"
              >
                保存定时配置
              </Button>
              <span v-if="scheduleId" class="text-muted-foreground">调度 #{{ scheduleId }}</span>
            </div>
          </TabPane>
        </Tabs>
      </template>
    </Drawer>
    <Drawer
      :open="!!runDetail"
      :title="`同步运行 #${runDetail?.run.id ?? ''}`"
      size="min(900px, 100vw)"
      :z-index="2100"
      @close="runDetail = undefined"
    >
      <template v-if="runDetail">
        <div class="toolbar">
          <Tag :color="color(runDetail.run.state)">
            {{ states[runDetail.run.state] }}
</Tag><span>同步耗时：{{ formatSyncDuration(runDetail.run) }}</span><span>读取 {{ runDetail.run.read_rows }} / 写入
            {{ runDetail.run.written_rows }}</span><Button
            v-if="execute && runDetail.run.state === 'running'"
            danger
            :loading="actionBusy"
            @click="
              stopRun(runDetail.run.job_id, detail?.job.target_table ?? '')
            "
          >
            停止本表同步
          </Button>
        </div>
        <Alert
          v-if="runDetail.run.error_code"
          type="error"
          :message="runDetail.run.error_code"
          show-icon
          class="mb-4"
        />
        <Table
          :columns="sourceColumns"
          :data-source="runDetail.sources"
          row-key="id"
          :pagination="false"
          size="small"
          :scroll="{ x: 650 }"
        >
          <template #bodyCell="{ column, record }">
            <span v-if="column.key === 'instance'">{{
              instanceName(record.binding_id)
            }}</span><Tag
              v-else-if="column.key === 'state'"
              :color="color(record.state)"
            >
              {{ states[record.state] }}
            </Tag>
          </template>
        </Table>
        <h3>同步批次</h3>
        <Table
          :columns="batchColumns"
          :data-source="batches"
          row-key="id"
          size="small"
          :pagination="batchPage"
          :scroll="{ x: 650 }"
          @change="
            (p) => {
              batchPage.current = p.current ?? 1;
              loadBatches(runDetail!.run.id);
            }
          "
        >
          <template #bodyCell="{ column, record }">
            <span v-if="column.key === 'instance'">{{
              instanceName(record.binding_id)
            }}</span><Tag
              v-else-if="column.key === 'state'"
              :color="color(record.state)"
            >
              {{ states[record.state] }}
            </Tag>
          </template>
        </Table>
      </template>
    </Drawer>
    <JobEditor
      v-model:open="editOpen"
      :detail="editorDetail"
      :instances="instances"
      @saved="saved"
      @instance="
        editingInstance = undefined;
        instanceOpen = true;
      "
    />
    <InstanceEditor
      v-model:open="instanceOpen"
      :instance="editingInstance"
      @saved="load(false)"
    />
  </Page>
</template>

<style scoped>
.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-bottom: 16px;
}

.search {
  width: 260px;
  max-width: 100%;
  margin-right: auto;
}

h3 {
  margin: 24px 0 12px;
  font-size: 15px;
  font-weight: 600;
}

.key-contract {
  margin: 16px 0;
}

.schedule-form {
  display: grid;
  gap: 16px;
  max-width: 400px;
}

.schedule-form label {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.empty-state {
  padding: 32px 0;
  color: #737373;
  text-align: center;
}
</style>
