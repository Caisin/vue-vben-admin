<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { DownloadTask, DownloadTaskItem } from '#/api/res/downloads';

import { onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  Button,
  Card,
  Form,
  FormItem,
  Modal,
  Statistic,
  Table,
  Tag,
} from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { ResDownloadApi } from '#/api/res/downloads';
import { formatFileSize } from '#/components/file-picker/internal/file-picker-options';
import DownloadHistory from '#/desktop/download-history.vue';

import ResourceSelect from './resource-select.vue';

const detailOpen = ref(false);
const historyOpen = ref(false);
const resourceId = ref<number | string>();
const resourceCode = ref<number | string>();
const detailTask = ref<DownloadTask>();
const detailItems = ref<DownloadTaskItem[]>([]);
const detailPage = ref(1);
const detailTotal = ref(0);
const detailLoading = ref(false);
const stats = ref<Awaited<ReturnType<typeof ResDownloadApi.stats>>>();
const detailColumns = [
  { title: '集数', dataIndex: 'seq_no', key: 'seq_no' },
  { title: '章节', dataIndex: 'item_name', key: 'item_name' },
  { title: '文件', dataIndex: 'file_name', key: 'file_name' },
  { title: '状态', dataIndex: 'status', key: 'status' },
  { title: '开始时间', dataIndex: 'started_at', key: 'started_at' },
  { title: '完成时间', dataIndex: 'finished_at', key: 'finished_at' },
];

function date(value: number) {
  return value ? new Date(Number(value) * 1000).toLocaleString() : '—';
}
async function showDetails(task: DownloadTask, page = 1) {
  detailTask.value = task;
  detailOpen.value = true;
  detailPage.value = page;
  detailLoading.value = true;
  try {
    const result = await ResDownloadApi.taskItems(task.id, { page, size: 20 });
    detailItems.value = result.items;
    detailTotal.value = result.total;
  } finally {
    detailLoading.value = false;
  }
}

const [Grid, gridApi] = useVbenVxeGrid<DownloadTask>({
  formOptions: {
    schema: [
      { component: 'Input', fieldName: 'version_keyword', label: '版本' },
      { component: 'Input', fieldName: 'user_keyword', label: '下载人' },
      { component: 'Input', fieldName: 'ip', label: '下载 IP' },
      { component: 'Input', fieldName: 'status', label: '状态' },
    ],
    submitOnChange: true,
  },
  gridOptions: {
    columns: [
      { field: 'res_name', title: '剧名' },
      { field: 'version_name', title: '版本' },
      { field: 'user_name', title: '下载人' },
      { field: 'uid', title: '用户 ID' },
      { field: 'ip', title: '下载 IP' },
      {
        field: 'downloaded_count',
        title: '已下载文件',
        formatter: ({ row }) => `${row.downloaded_count}/${row.total_count}`,
      },
      {
        field: 'started_at',
        title: '开始时间',
        formatter: ({ cellValue }) => date(cellValue),
      },
      {
        field: 'finished_at',
        title: '完成时间',
        formatter: ({ cellValue }) => date(cellValue),
      },
      { field: 'status', title: '状态' },
      { field: 'action', title: '操作' },
    ],
    height: 'auto',
    pagerConfig: { pageSize: 20, pageSizes: [10, 20, 50, 100] },
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) =>
          ResDownloadApi.tasks({
            page: page.currentPage,
            size: page.pageSize,
            res_id: resourceId.value ? Number(resourceId.value) : undefined,
            resource_code: resourceCode.value
              ? String(resourceCode.value)
              : undefined,
            version_keyword: formValues.version_keyword?.trim() || undefined,
            user_keyword: formValues.user_keyword?.trim() || undefined,
            ip: formValues.ip?.trim() || undefined,
            status: formValues.status?.trim() || undefined,
          }),
      },
    },
    toolbarConfig: { refresh: true, search: true, zoom: true },
  } as VxeTableGridOptions<DownloadTask>,
});
onMounted(async () => {
  stats.value = await ResDownloadApi.stats({ limit: 10 });
});
</script>

<template>
  <Page auto-content-height title="下载管理">
    <div class="mb-4 grid grid-cols-4 gap-4">
      <Card>
        <Statistic title="下载任务数" :value="stats?.total_downloads ?? 0" />
      </Card>
      <Card>
        <Statistic title="下载用户数" :value="stats?.unique_users ?? 0" />
      </Card>
      <Card>
        <Statistic title="来源 IP 数" :value="stats?.unique_ips ?? 0" />
      </Card>
      <Card>
        <Statistic
          title="下载量"
          :value="stats?.total_bytes ?? 0"
          :formatter="() => formatFileSize(stats?.total_bytes ?? 0)"
        />
      </Card>
    </div>
    <Form layout="inline" class="mb-4">
      <FormItem label="剧名" html-for="download-resource-name">
        <ResourceSelect
          v-model:value="resourceId"
          kind="name"
          @update:value="gridApi.query()"
        />
      </FormItem>
      <FormItem label="编码" html-for="download-resource-code">
        <ResourceSelect
          v-model:value="resourceCode"
          kind="code"
          @update:value="gridApi.query()"
        />
      </FormItem>
      <Button @click="historyOpen = true">我的下载记录</Button>
    </Form>
    <DownloadHistory v-model:open="historyOpen" />
    <Grid table-title="下载任务记录">
      <template #status="{ row }">
        <Tag>{{ row.status }}</Tag>
      </template>
      <template #action="{ row }">
        <Button type="link" @click="showDetails(row)"> 查看章节 </Button>
      </template>
    </Grid>
    <Card title="最近下载排行" class="mt-4">
      <div
        v-for="row in stats?.ranking ?? []"
        :key="String(row.res_id)"
        class="flex justify-between border-b py-2"
      >
        <span>{{ row.resource_name || `资源 ${row.res_id}` }}</span>
        <strong>{{ row.download_count }} 次</strong>
      </div>
    </Card>
    <Modal
      v-model:open="detailOpen"
      :footer="null"
      width="1000px"
      :title="`${detailTask?.res_name ?? ''} · ${detailTask?.version_name ?? ''} · 章节明细`"
    >
      <Table
        :loading="detailLoading"
        :columns="detailColumns"
        :data-source="detailItems"
        :pagination="{
          current: detailPage,
          pageSize: 20,
          total: detailTotal,
          showSizeChanger: false,
          onChange: (page: number) =>
            detailTask && showDetails(detailTask, page),
        }"
        row-key="id"
      >
        <template #bodyCell="{ column, record }">
          <span v-if="column.key === 'started_at'">{{
            date(record.started_at)
          }}</span>
          <span v-else-if="column.key === 'finished_at'">{{
            date(record.finished_at)
          }}</span>
          <Tag v-else-if="column.key === 'status'">{{ record.status }}</Tag>
        </template>
      </Table>
    </Modal>
  </Page>
</template>
