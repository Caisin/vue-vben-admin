<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { TaskRun, TaskRunStatus, TaskRunTrigger } from '#/api/task';

import { onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';

import { Button, message, Popconfirm, Space, Tag } from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { TaskRunApi } from '#/api/task';
import { displayValue } from '#/management';
import { useTaskPolling } from '#/task-polling';
import { Times } from '#/times';
import { vxeSortParams } from '#/vxe-sort';

import {
  taskColumns,
  taskStatusColor,
  taskStatusLabel,
  taskTriggerLabel,
  useTaskFormSchemaWithOptions,
} from './data';
import RunDetail from './modules/run-detail.vue';

const props = defineProps<{ embedded?: boolean }>();
const router = useRouter();
const route = useRoute();
const detailOpen = ref(false);
const detailLoading = ref(false);
const currentTask = ref<TaskRun>();
let hasActiveRows = false;
const taskSortFields = [
  'id',
  'schedule_id',
  'executor_code',
  'biz_key',
  'scheduled_at',
  'started_at',
  'finished_at',
  'updated_at',
];

const [Grid, gridApi] = useVbenVxeGrid<TaskRun>({
  formOptions: {
    schema: useTaskFormSchemaWithOptions([], []),
    submitOnChange: true,
  },
  gridOptions: {
    columns: taskColumns(),
    height: 'auto',
    pagerConfig: { pageSize: 20, pageSizes: [10, 20, 50, 100] },
    sortConfig: {
      defaultSort: { field: 'id', order: 'desc' },
      remote: true,
    },
    proxyConfig: {
      ajax: {
        query: async (params, formValues) => {
          const { page } = params;
          const result = await TaskRunApi.list({
            biz_key: String(formValues.biz_key ?? '').trim() || undefined,
            executor_code:
              String(formValues.executor_code ?? '').trim() || undefined,
            page: page.currentPage,
            ...vxeSortParams(params, taskSortFields),
            size: page.pageSize,
            status: formValues.status as TaskRunStatus | undefined,
            trigger: formValues.trigger as TaskRunTrigger | undefined,
          });
          hasActiveRows = result.items.some(isActive);
          return { items: result.items, total: result.total };
        },
      },
    },
    rowConfig: { keyField: 'id' },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<TaskRun>,
});

const listPoll = useTaskPolling({
  delay: 3000,
  load: async () => {
    if (hasActiveRows && !document.hidden) await gridApi.query();
  },
  accept: () => {},
});

async function cancelTask(row: TaskRun) {
  const updated = await TaskRunApi.cancel(row.id);
  if (currentTask.value?.id === row.id) currentTask.value = updated;
  message.success('已请求取消任务执行');
  await gridApi.reload();
}

async function openDetail(row: TaskRun) {
  detailPoll.stop();
  currentTask.value = row;
  detailOpen.value = true;
  detailLoading.value = true;
  detailPoll.start();
}

const detailPoll = useTaskPolling({
  load: () => TaskRunApi.detail(currentTask.value?.id ?? ''),
  accept: (task) => {
    currentTask.value = task;
    detailLoading.value = false;
  },
  done: (task) => !isActive(task),
  onError: () => {
    detailLoading.value = false;
  },
});
watch(detailOpen, (open) => {
  if (!open) detailPoll.stop();
});

function isActive(row: TaskRun) {
  return ['queued', 'retrying', 'running'].includes(row.status);
}

function progressText(row: TaskRun) {
  if (row.total_count === null || row.total_count === undefined) {
    return `执行中 ${row.running_count} / 成功 ${row.succeeded_count} / 失败 ${row.failed_count}`;
  }
  return `总 ${row.total_count} / 执行中 ${row.running_count} / 成功 ${row.succeeded_count} / 失败 ${row.failed_count}`;
}

function durationText(row: TaskRun) {
  const startedAt = Times.toUnixSeconds(row.started_at);
  const finishedAt = Times.toUnixSeconds(row.finished_at);
  if (startedAt === undefined || finishedAt === undefined) return '-';
  return Times.formatDurationSeconds(finishedAt - startedAt);
}

async function openBusinessDetail(row: TaskRun) {
  if (!row.detail_path) return;
  await router.push(row.detail_path);
}

onMounted(async () => {
  listPoll.start();
  try {
    const filterOptions = await TaskRunApi.filterOptions();
    await gridApi.formApi.updateSchema(
      useTaskFormSchemaWithOptions(
        filterOptions.executors,
        filterOptions.biz_keys,
      ),
    );
  } catch {
    await gridApi.formApi.updateSchema(useTaskFormSchemaWithOptions([], []));
  }
  const runId = route.query.run_id;
  if (typeof runId !== 'string' || !runId.trim()) return;
  await openDetail({ id: runId } as TaskRun);
});
</script>

<template>
  <component
    :is="props.embedded ? 'div' : Page"
    auto-content-height
    class="management-page"
    content-class="management-content"
  >
    <header v-if="!props.embedded" class="page-heading">
      <h1>任务执行记录</h1>
    </header>

    <Grid class="management-grid" table-title="任务执行记录">
      <template #status="{ row }">
        <Tag :color="taskStatusColor(row.status)">
          {{ taskStatusLabel(row.status) }}
        </Tag>
      </template>
      <template #trigger="{ row }">
        {{ taskTriggerLabel(row.trigger) }}
      </template>
      <template #progress="{ row }">
        {{ progressText(row) }}
      </template>
      <template #duration="{ row }">
        {{ durationText(row) }}
      </template>
      <template #error="{ row }">
        {{ displayValue(row.error_message) }}
      </template>
      <template #operation="{ row }">
        <Space>
          <Button size="small" type="link" @click="openDetail(row)">
            详情
          </Button>
          <Button
            v-if="row.detail_path"
            size="small"
            type="link"
            @click="openBusinessDetail(row)"
          >
            {{ row.detail_label || '业务详情' }}
          </Button>
          <Popconfirm
            v-if="isActive(row) && !row.cancel_requested_at"
            title="确认请求取消该执行？执行器会协作式停止。"
            @confirm="cancelTask(row)"
          >
            <Button
              v-access:code="'tasks:run:cancel'"
              danger
              size="small"
              type="link"
            >
              取消
            </Button>
          </Popconfirm>
        </Space>
      </template>
    </Grid>
    <RunDetail
      v-model:open="detailOpen"
      :loading="detailLoading"
      :task="currentTask"
      @business-detail="openBusinessDetail"
    />
  </component>
</template>

<style scoped>
.management-page {
  min-height: 0;
}

.management-page :deep(.management-content) {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.page-heading {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.page-heading h1 {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
  letter-spacing: 0;
}

.management-grid {
  flex: 1;
  min-height: 0;
}
</style>
