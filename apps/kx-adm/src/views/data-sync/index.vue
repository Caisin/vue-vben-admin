<script setup lang="ts">
import type {
  Batch,
  Instance,
  Job,
  JobDetail,
  RunDetail,
  SyncRun,
} from '#/api/data-sync';

import { computed, onMounted, onUnmounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';

import { useAccess } from '@vben/access';
import { Page } from '@vben/common-ui';
import { createIconifyIcon, Plus } from '@vben/icons';

import {
  Alert,
  Button,
  Checkbox,
  Drawer,
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

import { operations, states } from './data';
import DatabasePanel from './database-panel.vue';
import InstanceEditor from './instance-editor.vue';
import JobEditor from './job-editor.vue';

const route = useRoute();
const activeTab = ref(route.query.database_id ? 'databases' : 'jobs');
const RefreshCw = createIconifyIcon('lucide:refresh-cw');
const Play = createIconifyIcon('lucide:play');
const Settings2 = createIconifyIcon('lucide:settings-2');
const { hasAccessByCodes } = useAccess();
const configure = computed(() => hasAccessByCodes(['data-sync:configure']));
const execute = computed(() => hasAccessByCodes(['data-sync:execute']));
const jobs = ref<Job[]>([]);
const instances = ref<Instance[]>([]);
const loading = ref(false);
const keyword = ref('');
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
  { title: '状态', key: 'state', width: 100 },
  { title: '最近错误', dataIndex: 'last_error', ellipsis: true },
  { title: '操作', key: 'actions', width: 120 },
];
const runColumns = [
  { title: '运行', dataIndex: 'id', key: 'id' },
  { title: '操作', key: 'operation' },
  { title: '状态', key: 'state' },
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
    const task = await DataSyncApi.dispatch(job.id, action, request);
    message.success(`任务已提交 #${task.id}`);
    await load(false);
  } finally {
    actionBusy.value = false;
  }
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
    detail.value.job.state !== 'paused',
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
let timer: ReturnType<typeof setInterval> | undefined;
let polling = false;
onMounted(async () => {
  await load();
  const id = Number(route.query.job_id);
  if (id > 0) {
    const current = await DataSyncApi.detail(id);
    await show(current.job);
  }
  timer = setInterval(async () => {
    if (polling || document.hidden) return;
    polling = true;
    try {
      await load(false);
      const id = detail.value?.job.id;
      if (id) {
        const result = await DataSyncApi.detail(id);
        if (detail.value?.job.id === id) detail.value = result;
        await loadRuns(id);
      }
      const runId = runDetail.value?.run.id;
      if (runId) {
        const result = await DataSyncApi.run(runId);
        if (runDetail.value?.run.id === runId) runDetail.value = result;
        await loadBatches(runId);
      }
    } finally {
      polling = false;
    }
  }, 5000);
});
onUnmounted(() => clearInterval(timer));
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
            <Tag
              v-else-if="column.key === 'state'"
              :color="color(record.state)"
            >
              {{ states[record.state] ?? record.state }}
            </Tag>
            <div v-else-if="column.key === 'actions'" class="flex gap-1">
              <Tooltip v-if="execute && !record.database_id" title="立即同步">
                <Button
                  type="text"
                  :disabled="record.state !== 'ready' || actionBusy"
                  @click="dispatch('sync', record)"
                >
                  <Play class="size-4" />
                </Button>
              </Tooltip>
              <Tooltip v-if="configure && !record.database_id" title="编辑配置">
                <Button
                  type="text"
                  :disabled="!!record.active_run_id"
                  @click="edit(record)"
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
            v-if="execute && !detail.job.database_id"
            type="primary"
            :disabled="detail.job.state !== 'ready'"
            :loading="actionBusy"
            @click="dispatch('sync')"
          >
            <Play class="size-4" />同步
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
            {{ detail.job.state === 'paused' ? '恢复调度' : '暂停调度' }}
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
              :scroll="{ x: 650 }"
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
              <pre class="ddl">{{ plan.ddl }}</pre>
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
</Tag><span>读取 {{ runDetail.run.read_rows }} / 写入
            {{ runDetail.run.written_rows }}</span><Button
            v-if="execute && runDetail.run.state === 'running'"
            danger
            @click="
              DataSyncApi.cancel(runDetail.run.id).then(() =>
                message.success('已请求取消'),
              )
            "
          >
            取消运行
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

.ddl {
  max-height: 280px;
  padding: 12px;
  overflow: auto;
  font-size: 12px;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  border: 1px solid var(--border);
  border-radius: 4px;
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
