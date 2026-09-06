<script lang="ts" setup>
import type {
  InvoiceExportDispatchView,
  InvoiceExportView,
} from '#/api/invoice';

import { ref, watch } from 'vue';

import { Button, Drawer, Empty, message, Space, Table, Tag } from 'antdv-next';

import { InvoiceApi } from '#/api/invoice';
import { useTaskPolling } from '#/task-polling';
import { Times } from '#/times';

const props = defineProps<{
  exports: InvoiceExportDispatchView[];
}>();

const emit = defineEmits<{
  download: [value: InvoiceExportView];
  refresh: [value: InvoiceExportDispatchView[]];
}>();

const open = defineModel<boolean>('open', { required: true });
const rows = ref<InvoiceExportDispatchView[]>([]);
const loading = ref(false);
let notifyRefresh = false;

watch(
  () => props.exports,
  (value) => {
    rows.value = value.map((item) => ({ ...item }));
  },
  { immediate: true },
);

watch(
  [open, () => props.exports.map((item) => item.export.id).join(',')],
  () => {
    if (open.value) refreshAll(false);
    else {
      polling.stop();
      loading.value = false;
    }
  },
);

function stateColor(state: InvoiceExportView['state']) {
  if (state === 'succeeded') return 'success';
  if (state === 'failed') return 'error';
  if (state === 'running') return 'processing';
  return 'default';
}

const polling = useTaskPolling({
  load: () =>
    Promise.all(
      rows.value.map(async (item) => ({
        ...item,
        export: await InvoiceApi.exportDetail(item.export.id),
      })),
    ),
  accept: (value) => {
    rows.value = value;
    loading.value = false;
    emit('refresh', value);
    if (notifyRefresh) {
      message.success('导出任务状态已刷新');
      notifyRefresh = false;
    }
  },
  done: (value) =>
    !value.some((item) => ['pending', 'running'].includes(item.export.state)),
  onError: () => {
    loading.value = false;
  },
});
function refreshAll(notify = true) {
  if (!open.value) return;
  notifyRefresh = notify;
  loading.value = notify;
  polling.start();
}
</script>

<template>
  <Drawer
    :open="open"
    size="min(820px, 100vw)"
    title="导出任务"
    @close="open = false"
  >
    <template #extra>
      <Button size="small" @click="refreshAll()">刷新状态</Button>
    </template>
    <Empty v-if="rows.length === 0" description="暂无导出任务" />
    <Table
      v-else
      :columns="[
        { dataIndex: 'id', title: '导出 ID', width: 100 },
        { dataIndex: 'scope', title: '范围', width: 100 },
        { dataIndex: 'actual_count', title: '数量', width: 90 },
        { dataIndex: 'state', title: '状态', width: 110 },
        { dataIndex: 'updated_at', title: '更新时间', width: 180 },
        { dataIndex: 'operation', title: '操作', width: 110 },
      ]"
      :data-source="rows.map((item) => item.export)"
      :loading="loading"
      row-key="id"
      size="small"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'scope'">
          {{
            (record as InvoiceExportView).scope === 'selected'
              ? '所选记录'
              : '当前筛选'
          }}
        </template>
        <Tag
          v-else-if="column.dataIndex === 'state'"
          :color="stateColor((record as InvoiceExportView).state)"
        >
          {{ (record as InvoiceExportView).state }}
        </Tag>
        <template v-else-if="column.dataIndex === 'updated_at'">
          {{
            Times.formatOptionalUnix((record as InvoiceExportView).updated_at)
          }}
        </template>
        <Space v-else-if="column.dataIndex === 'operation'">
          <Button
            :disabled="!(record as InvoiceExportView).output_file_id"
            size="small"
            type="link"
            @click="emit('download', record as InvoiceExportView)"
          >
            下载
          </Button>
        </Space>
      </template>
    </Table>
  </Drawer>
</template>
