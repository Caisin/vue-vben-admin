<script setup lang="ts">
import type { Batch, RunDetail, RunListItem } from '#/api/data-sync';

import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { useAccess } from '@vben/access';
import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import {
  Alert,
  Button,
  Input,
  message,
  Modal,
  Select,
  Switch,
  Table,
  TabPane,
  Tabs,
  Tag,
  Tooltip,
} from 'antdv-next';

import { DataSyncApi } from '#/api/data-sync';
import { requestErrorMessage } from '#/request-errors';
import { useTaskPolling } from '#/task-polling';

import { operations, states } from './data';
import { formatSyncDuration } from './duration';
import FailureDetail from './failure-detail.vue';
import ForceStopButton from './force-stop-button.vue';
import OperationsPanel from './operations-panel.vue';
import ReconcileButton from './reconcile-button.vue';
import {
  isSchemaConflict,
  schemaConflictErrors,
  schemaSettingsQuery,
} from './schema-conflict';
import StatusOverview from './status-overview.vue';
import { startJob, stopJob } from './sync-control';

const selectedJobs = ref<number[]>([]);
const router = useRouter();
const { hasAccessByCodes } = useAccess();
const execute = computed(() => hasAccessByCodes(['data-sync:execute']));
const configure = computed(() => hasAccessByCodes(['data-sync:configure']));
const route = useRoute();
const status = ref(
  typeof route.query.state === 'string' ? route.query.state : 'running',
);
const operation = ref<string>();
const keyword = ref(
  typeof route.query.keyword === 'string' ? route.query.keyword : '',
);
const auto = ref(true);
const errorText = ref('');
const rows = ref<RunListItem[]>([]);
const loading = ref(false);
const cancelling = ref<number[]>([]);
const forceTarget = ref<RunListItem>();
const forceControl = ref<{ confirm: () => void }>();
async function forceStop(row: RunListItem) {
  forceTarget.value = row;
  await nextTick();
  forceControl.value?.confirm();
}
const pagination = reactive({ current: 1, pageSize: 50, total: 0 });
const detail = ref<RunDetail>();
const batchRows = ref<Batch[]>([]);
const batchPage = reactive({ current: 1, pageSize: 20, total: 0 });
let generation = 0;
const columns = [
  { title: '运行', dataIndex: 'id', width: 100 },
  { title: '任务 / 目标表', key: 'target', width: 260 },
  { title: '操作', key: 'operation', width: 110 },
  { title: '状态', key: 'state', width: 100 },
  { title: '同步耗时', key: 'duration', width: 130 },
  { title: '本次同步总数', key: 'rows', width: 160 },
  { title: '数据量', key: 'bytes', width: 100 },
  { title: '开始时间', key: 'started', width: 180 },
  { title: '失败原因', key: 'error', width: 280 },
  { title: '操作', key: 'actions', width: 250 },
];
async function load() {
  const version = ++generation;
  loading.value = true;
  try {
    const page = await DataSyncApi.allRuns({
      state:
        status.value === 'schema_conflict'
          ? undefined
          : status.value || undefined,
      schema_conflicts: ['failed', 'schema_conflict'].includes(status.value)
        ? status.value === 'schema_conflict'
        : undefined,
      operation: operation.value,
      keyword: keyword.value,
      page: pagination.current,
      size: pagination.pageSize,
    });
    if (version !== generation) return;
    rows.value = page.items;
    pagination.total = page.total;
    errorText.value = '';
  } catch (error) {
    if (version === generation)
      errorText.value = requestErrorMessage(error, '执行记录加载失败');
  } finally {
    if (version === generation) loading.value = false;
  }
}
const polling = useTaskPolling({
  delay: () =>
    status.value === 'running' ||
    rows.value.some((r) => ['cancelling', 'running'].includes(r.state))
      ? 3000
      : 30_000,
  load,
  accept: () => {},
});
watch([status, operation], () => {
  pagination.current = 1;
  load();
});
watch(auto, (enabled) => (enabled ? polling.start() : polling.stop()));
let detailGeneration = 0;
let batchGeneration = 0;
const detailError = ref('');
const detailLoading = ref(false);
async function show(row: Pick<RunListItem, 'id'>) {
  const generation = ++detailGeneration;
  detailLoading.value = true;
  detailError.value = '';
  try {
    const current = await DataSyncApi.run(row.id);
    if (generation !== detailGeneration) return;
    detail.value = current;
    batchPage.current = 1;
    await batches();
  } catch (error) {
    if (generation === detailGeneration)
      detailError.value = requestErrorMessage(error, '明细加载失败');
  } finally {
    if (generation === detailGeneration) detailLoading.value = false;
  }
}
async function batches() {
  const id = detail.value?.run.id;
  if (!id) return;
  const generation = ++batchGeneration;
  try {
    const page = await DataSyncApi.batches(id, {
      page: batchPage.current,
      size: batchPage.pageSize,
    });
    if (generation !== batchGeneration || detail.value?.run.id !== id) return;
    batchRows.value = page.items;
    batchPage.total = page.total;
    detailError.value = '';
  } catch (error) {
    if (generation === batchGeneration)
      detailError.value = requestErrorMessage(error, '批次加载失败');
  }
}
async function restart(row: RunListItem) {
  Modal.confirm({
    title: '重新启动同步？',
    content: `${row.target_database}.${row.target_table}：保留已取消记录 #${row.id}，创建新的运行继续同步。${row.database_id ? '必要时恢复所属全库调度，本次仅同步本表。' : ''}`,
    okText: '重新启动',
    cancelText: '取消',
    onOk: async () => {
      const task = await startJob({ id: row.job_id });
      message.success(`新运行已提交 #${task.id}，原取消记录保留`);
      status.value = 'running';
      await load();
      polling.start();
    },
  });
}
function cancel(row: RunListItem) {
  Modal.confirm({
    title: '停止本表同步？',
    okText: '停止',
    cancelText: '取消',
    content: `${row.target_database}.${row.target_table}：停止后续定时调度并停止本次运行，不影响其它表。已提交数据保留，未确定提交结果需要对账。`,
    onOk: async () => {
      cancelling.value.push(row.id);
      try {
        await stopJob(row.job_id);
        message.success('本表调度已停止，当前运行已请求停止');
        await load();
      } finally {
        cancelling.value = cancelling.value.filter((id) => id !== row.id);
      }
    },
  });
}
onMounted(() => polling.start());
</script>
<template>
  <Page title="同步执行监控">
    <OperationsPanel
      :targets="selectedJobs.map((id) => ({ kind: 'job' as const, id }))"
      :history="false"
      @finished="load"
    />
    <Tabs v-model:active-key="status">
      <TabPane key="schema_conflict" tab="结构冲突" />
      <TabPane key="running" tab="正在进行" /><TabPane
        key="blocked"
        tab="待对账"
      /><TabPane key="failed" tab="失败" /><TabPane
        key="succeeded"
        tab="成功"
      /><TabPane key="cancelled" tab="已取消" /><TabPane
        key=""
        tab="全部记录"
      />
    </Tabs>
    <div class="toolbar">
      <Input
        v-model:value="keyword"
        placeholder="任务、目标库或目标表"
        aria-label="搜索执行记录"
        allow-clear
        @press-enter="
          pagination.current = 1;
          load();
        "
      />
      <Select
        v-model:value="operation"
        allow-clear
        placeholder="全部操作"
        :options="
          Object.entries(operations).map(([value, label]) => ({ value, label }))
        "
      />
      <Tooltip title="刷新">
        <Button aria-label="刷新执行记录" @click="load">
          <IconifyIcon icon="lucide:refresh-cw" />
        </Button>
      </Tooltip>
      <Switch
        v-model:checked="auto"
        checked-children="自动刷新"
        un-checked-children="暂停刷新"
      />
    </div>
    <Alert v-if="errorText" :message="errorText" type="error" />
    <Table
      :data-source="rows"
      :row-selection="
        execute
          ? {
              selectedRowKeys: rows
                .filter((r) => selectedJobs.includes(r.job_id))
                .map((r) => r.id),
              onChange: (_keys: (number | string)[], selected: RunListItem[]) =>
                (selectedJobs = [...new Set(selected.map((r) => r.job_id))]),
            }
          : undefined
      "
      :columns="columns"
      row-key="id"
      :loading="loading"
      :pagination="pagination"
      :scroll="{ x: 1600 }"
      @change="
        (p) => {
          pagination.current = p.current ?? 1;
          pagination.pageSize = p.pageSize ?? 50;
          load();
        }
      "
    >
      <template #bodyCell="{ column, record }">
        <div v-if="column.key === 'target'">
          <a @click="show(record)">{{ record.job_name }}</a>
          <div>{{ record.target_database }}.{{ record.target_table }}</div>
        </div>
        <Tag v-else-if="column.key === 'state'">
          {{ states[record.state] ?? record.state }}
        </Tag>
        <span v-else-if="column.key === 'operation'">{{
          operations[record.operation] ?? record.operation
        }}</span>
        <div v-else-if="column.key === 'error'">
          {{
            schemaConflictErrors[record.error_code ?? ''] ?? record.error_code
          }}
          <div
            v-if="record.error_code && record.message !== record.error_code"
            class="whitespace-pre-wrap break-all text-xs"
          >
            {{ record.message }}
          </div>
        </div>
        <span v-else-if="column.key === 'duration'">{{
          formatSyncDuration(record)
        }}</span>
        <Tooltip
          v-else-if="column.key === 'rows'"
          title="本轮所有来源、所有批次累计确认写入的行数；执行中持续更新"
        >
          <span>{{ Number(record.written_rows).toLocaleString() }} 条</span>
        </Tooltip>
        <span v-else-if="column.key === 'bytes'">{{ (Number(record.bytes) / 1048576).toFixed(2) }} MiB</span>
        <span v-else-if="column.key === 'started'">{{
          new Date(Number(record.started_at) * 1000).toLocaleString()
        }}</span>
        <div v-else-if="column.key === 'actions'" class="actions">
          <Button size="small" @click="show(record)">明细</Button><Button
            size="small"
            @click="
              router.push({
                path: '/data-sync/jobs',
                query: schemaSettingsQuery(
                  record,
                  configure && isSchemaConflict(record.error_code),
                ),
              })
            "
          >
            {{
              configure && isSchemaConflict(record.error_code)
                ? '处理冲突'
                : '配置'
            }}
          </Button>
          <Button
            v-if="
              execute &&
              record.operation === 'sync' &&
              record.state === 'cancelled'
            "
            size="small"
            @click="restart(record)"
          >
            重新启动
          </Button>
          <ReconcileButton
            v-if="record.state === 'blocked'"
            :id="record.job_id"
            :database-id="record.database_id"
            compact
            @finished="load"
          />
          <Button
            v-if="execute && record.state === 'running'"
            size="small"
            danger
            :loading="cancelling.includes(record.id)"
            @click="cancel(record)"
          >
            停止本表
          </Button>
          <Button
            v-if="execute && ['running', 'cancelling'].includes(record.state)"
            danger
            size="small"
            @click="forceStop(record)"
          >
            强制停止
          </Button>
        </div>
      </template>
    </Table>
    <ForceStopButton
      ref="forceControl"
      :id="forceTarget?.job_id ?? 0"
      :expected-id="forceTarget?.id"
      :target="
        forceTarget
          ? `${forceTarget.target_database}.${forceTarget.target_table}`
          : ''
      "
      hidden
      @finished="load"
    />
    <Modal
      :open="!!detail"
      title="运行明细"
      width="min(96vw, 1400px)"
      :footer="null"
      @cancel="
        detailGeneration++;
        batchGeneration++;
        detail = undefined;
      "
    >
      <template v-if="detail">
        <FailureDetail
          :code="detail.run.error_code"
          :message="detail.run.message"
        />
        <StatusOverview
          :target="{ kind: 'job', id: detail.run.job_id }"
          @finished="load"
        />
        <Button
          v-if="execute"
          class="mb-3"
          @click="
            router.push({
              path: '/data-sync/jobs',
              query: { job_id: detail.run.job_id },
            })
          "
        >
          进入任务恢复同步
        </Button>
        <OperationsPanel
          :targets="[{ kind: 'job', id: detail.run.job_id }]"
          :history="false"
          @finished="load"
        />
        <p>
          本次同步总数：{{
            Number(detail.run.written_rows).toLocaleString()
          }}
          条；累计读取：{{
            Number(detail.run.read_rows).toLocaleString()
          }}
          条；同步耗时：{{ formatSyncDuration(detail.run) }}
        </p>
        <p
          v-if="
            detail.run.operation === 'sync' &&
            detail.run.state === 'succeeded' &&
            !detail.run.read_rows &&
            !detail.run.written_rows
          "
        >
          无新增数据：每表保留一条零数据记录，时间为最近一次同步。
        </p>
        <Alert v-if="detailError" type="error" :message="detailError" />
        <Button
          :loading="detailLoading"
          @click="detail && show({ id: detail.run.id })"
        >
          刷新明细
        </Button>
        <Table
          :data-source="detail.sources"
          row-key="id"
          :scroll="{ x: 900 }"
          :columns="[
            { title: '源绑定', dataIndex: 'binding_id' },
            { title: '阶段', dataIndex: 'phase' },
            { title: '状态', dataIndex: 'state' },
            { title: '读取', dataIndex: 'read_rows' },
            { title: '写入', dataIndex: 'written_rows' },
            { title: '目标最大 ID', dataIndex: 'target_max_id' },
            { title: '消息', dataIndex: 'message' },
          ]"
        />
        <h3>批次记录</h3>
        <Table
          :data-source="batchRows"
          row-key="id"
          :pagination="batchPage"
          :scroll="{ x: 900 }"
          :columns="[
            { title: '批次', dataIndex: 'id' },
            { title: '源绑定', dataIndex: 'binding_id' },
            { title: '序号', dataIndex: 'seq' },
            { title: '状态', dataIndex: 'state' },
            { title: '读取行数', dataIndex: 'read_rows' },
            { title: '错误', dataIndex: 'error_code' },
            { title: '目标查询编号', dataIndex: 'query_id' },
          ]"
          @change="
            (p) => {
              batchPage.current = p.current ?? 1;
              batchPage.pageSize = p.pageSize ?? 20;
              batches();
            }
          "
        />
      </template>
    </Modal>
  </Page>
</template>
<style scoped>
.toolbar,
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-bottom: 12px;
}

.toolbar :deep(.ant-input-affix-wrapper) {
  width: 280px;
  max-width: 100%;
}

.toolbar :deep(.ant-select) {
  width: 160px;
}

.actions {
  margin: 0;
}
</style>
