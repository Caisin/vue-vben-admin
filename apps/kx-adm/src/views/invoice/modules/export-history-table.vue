<script lang="ts" setup>
import type {
  InvoiceExportListQuery,
  InvoiceExportState,
  InvoiceExportView,
} from '#/api/invoice';

import { onActivated, onDeactivated, ref, watch } from 'vue';

import {
  Alert,
  Button,
  Input,
  message,
  Select,
  Space,
  Table,
  Tag,
} from 'antdv-next';

import { InvoiceApi } from '#/api/invoice';
import { requestErrorMessage } from '#/request-errors';
import { useTaskPolling } from '#/task-polling';
import { Times } from '#/times';

const props = withDefaults(
  defineProps<{
    active?: boolean;
    initialExportId?: number | string;
  }>(),
  { active: true, initialExportId: undefined },
);

const rows = ref<InvoiceExportView[]>([]);
const total = ref(0);
const currentPage = ref(1);
const pageSize = ref(20);
const exportId = ref('');
const state = ref<InvoiceExportState>();
const applied = ref<InvoiceExportListQuery>({});
const loading = ref(false);
const error = ref('');
const downloading = ref<number | string>();
let notifyRefresh = false;

const states: Record<InvoiceExportState, { color: string; label: string }> = {
  pending: { color: 'default', label: '等待执行' },
  running: { color: 'processing', label: '导出中' },
  succeeded: { color: 'success', label: '已完成' },
  failed: { color: 'error', label: '失败' },
  cancelled: { color: 'default', label: '已取消' },
};
const columns = [
  { dataIndex: 'id', title: '导出编号', width: 110 },
  { dataIndex: 'scope', title: '导出范围', width: 110 },
  { dataIndex: 'actual_count', title: '导出数量', width: 95 },
  { dataIndex: 'state', title: '状态', width: 110 },
  { dataIndex: 'created_at', title: '创建时间', width: 180 },
  { dataIndex: 'completed_at', title: '完成时间', width: 180 },
  { dataIndex: 'error_message', title: '失败原因', width: 280 },
  { dataIndex: 'operation', title: '操作', width: 90, fixed: 'right' as const },
];

const polling = useTaskPolling({
  load: () =>
    InvoiceApi.exportList({
      ...applied.value,
      page: currentPage.value,
      size: pageSize.value,
    }),
  accept: (value) => {
    rows.value = value.items;
    total.value = Number(value.total);
    loading.value = false;
    error.value = '';
    if (notifyRefresh) message.success('导出任务已刷新');
    notifyRefresh = false;
  },
  done: (value) =>
    !value.items.some((item) => ['pending', 'running'].includes(item.state)),
  onError: (cause) => {
    error.value = requestErrorMessage(cause, '加载导出历史失败，请重试');
    loading.value = false;
    notifyRefresh = false;
    polling.stop();
  },
});

function refresh(notify = false) {
  if (!props.active) return;
  loading.value = true;
  notifyRefresh = notify;
  polling.start();
}
function search() {
  const id = exportId.value.trim();
  if (id && !/^[1-9]\d*$/.test(id)) {
    message.warning('请输入有效的导出编号');
    return;
  }
  applied.value = { id: id || undefined, state: state.value };
  currentPage.value = 1;
  refresh();
}
function reset() {
  exportId.value = '';
  state.value = undefined;
  search();
}
function changePage(pagination: { current?: number; pageSize?: number }) {
  currentPage.value = pagination.current ?? 1;
  pageSize.value = pagination.pageSize ?? 20;
  refresh();
}
async function download(row: InvoiceExportView) {
  downloading.value = row.id;
  try {
    const blob = await InvoiceApi.exportContent(row.id);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `invoice-export-${row.id}.zip`;
    link.click();
    URL.revokeObjectURL(url);
    message.success('导出文件已下载');
  } catch (error) {
    message.error(requestErrorMessage(error, '下载导出文件失败'));
  } finally {
    downloading.value = undefined;
  }
}

watch(
  [() => props.active, () => props.initialExportId],
  ([active, id]) => {
    if (active) {
      exportId.value = id === undefined ? '' : String(id);
      state.value = undefined;
      search();
    } else {
      polling.stop();
      loading.value = false;
    }
  },
  { immediate: true },
);
onDeactivated(() => polling.stop());
onActivated(() => refresh());
</script>

<template>
  <section class="flex min-w-0 flex-col gap-4" aria-label="导出历史">
    <Space wrap>
      <Input
        v-model:value="exportId"
        allow-clear
        class="!w-44"
        placeholder="导出编号"
        @press-enter="search"
      />
      <Select
        v-model:value="state"
        allow-clear
        class="!w-40"
        placeholder="全部状态"
        :options="
          Object.entries(states).map(([value, item]) => ({
            value,
            label: item.label,
          }))
        "
      />
      <Button type="primary" @click="search">查询</Button>
      <Button @click="reset">重置</Button>
      <Button :loading="loading" @click="refresh(true)">刷新</Button>
    </Space>
    <Alert v-if="error" :message="error" show-icon type="error" />
    <Table
      :columns="columns"
      :data-source="rows"
      :loading="loading"
      row-key="id"
      size="small"
      :scroll="{ x: 1155 }"
      :locale="{ emptyText: error ? '查询失败，请刷新重试' : '暂无导出任务' }"
      :pagination="{
        current: currentPage,
        pageSize,
        total,
        showSizeChanger: true,
        pageSizeOptions: ['10', '20', '50', '100'],
        showTotal: (count: number) => `共 ${count} 条`,
      }"
      @change="changePage"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'scope'">
          {{ record.scope === 'selected' ? '所选发票' : '筛选结果' }}
        </template>
        <template v-else-if="column.dataIndex === 'actual_count'">
          {{ record.state === 'succeeded' ? record.actual_count : '—' }}
        </template>
        <Tag
          v-else-if="column.dataIndex === 'state'"
          :color="states[(record as InvoiceExportView).state].color"
        >
          {{ states[(record as InvoiceExportView).state].label }}
        </Tag>
        <template v-else-if="column.dataIndex === 'created_at'">
          {{ Times.formatOptionalUnix(record.created_at) }}
        </template>
        <template v-else-if="column.dataIndex === 'completed_at'">
          {{ Times.formatOptionalUnix(record.completed_at) }}
        </template>
        <div
          v-else-if="column.dataIndex === 'error_message'"
          class="whitespace-pre-wrap break-words"
        >
          {{ record.error_message || '—' }}
        </div>
        <Button
          v-else-if="column.dataIndex === 'operation'"
          :disabled="record.state !== 'succeeded' || !record.output_file_id"
          :loading="downloading === record.id"
          size="small"
          type="link"
          @click="download(record as InvoiceExportView)"
        >
          下载
        </Button>
      </template>
    </Table>
  </section>
</template>
