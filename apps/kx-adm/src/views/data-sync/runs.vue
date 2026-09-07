<script setup lang="ts">
import type { Batch, RunDetail, RunListItem } from '#/api/data-sync';

import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import { useAccess } from '@vben/access';
import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import {
  Alert,
  Button,
  Input,
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
import { useTaskPolling } from '#/task-polling';

import { operations, states } from './data';

const router = useRouter();
const { hasAccessByCodes } = useAccess();
const execute = computed(() => hasAccessByCodes(['data-sync:execute']));
const status = ref('running');
const operation = ref<string>();
const keyword = ref('');
const auto = ref(true);
const error = ref('');
const rows = ref<RunListItem[]>([]);
const loading = ref(false);
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
  { title: '读取 / 写入', key: 'rows', width: 150 },
  { title: '数据量', key: 'bytes', width: 100 },
  { title: '开始时间', key: 'started', width: 180 },
  { title: '最近错误', dataIndex: 'error_code', width: 240 },
  { title: '操作', key: 'actions', width: 190 },
];
async function load() {
  const version = ++generation;
  loading.value = true;
  try {
    const page = await DataSyncApi.allRuns({
      state: status.value || undefined,
      operation: operation.value,
      keyword: keyword.value,
      page: pagination.current,
      size: pagination.pageSize,
    });
    if (version !== generation) return;
    rows.value = page.items;
    pagination.total = page.total;
    error.value = '';
  } catch {
    error.value = '执行记录加载失败';
  } finally {
    if (version === generation) loading.value = false;
  }
}
const polling = useTaskPolling({ delay: 3000, load, accept: () => {} });
watch([status, operation], () => {
  pagination.current = 1;
  load();
});
watch(auto, (enabled) => (enabled ? polling.start() : polling.stop()));
async function show(row: RunListItem) {
  detail.value = await DataSyncApi.run(row.id);
  batchPage.current = 1;
  await batches();
}
async function batches() {
  if (!detail.value) return;
  const page = await DataSyncApi.batches(detail.value.run.id, {
    page: batchPage.current,
    size: batchPage.pageSize,
  });
  batchRows.value = page.items;
  batchPage.total = page.total;
}
async function cancel(row: RunListItem) {
  Modal.confirm({
    title: row.database_id ? '停止所属全库运行？' : '停止本表同步？',
    content: row.database_id
      ? '同一全库运行中的其它子表也会收到取消请求，已提交数据保留。'
      : '已提交数据保留，未确定提交结果需要对账。',
    onOk: async () => {
      await DataSyncApi.cancel(row.id);
      await load();
    },
  });
}
onMounted(() => polling.start());
</script>
<template>
  <Page title="同步执行监控">
    <Tabs v-model:active-key="status">
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
    <Alert v-if="error" :message="error" type="error" />
    <Table
      :data-source="rows"
      :columns="columns"
      row-key="id"
      :loading="loading"
      :pagination="pagination"
      :scroll="{ x: 1400 }"
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
        <span v-else-if="column.key === 'rows'">{{ Number(record.read_rows).toLocaleString() }} /
          {{ Number(record.written_rows).toLocaleString() }}</span>
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
                query: record.database_id
                  ? { database_id: record.database_id }
                  : { job_id: record.job_id },
              })
            "
          >
            配置
</Button><Button
            v-if="execute && record.state === 'running'"
            size="small"
            danger
            @click="cancel(record)"
          >
            {{ record.database_id ? '停止全库' : '停止' }}
          </Button>
        </div>
      </template>
    </Table>
    <Modal
      :open="!!detail"
      title="运行明细"
      width="min(96vw, 1400px)"
      :footer="null"
      @cancel="detail = undefined"
    >
      <template v-if="detail">
        <Button @click="detail && show({ id: detail.run.id } as RunListItem)">
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
          ]"
          @change="
            (p) => {
              batchPage.current = p.current ?? 1;
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
