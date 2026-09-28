<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { DownloadLog } from '#/api/res/downloads';

import { onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import { Card, Statistic, TabPane, Tabs } from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { ResDownloadApi } from '#/api/res/downloads';

const stats = ref<Awaited<ReturnType<typeof ResDownloadApi.stats>>>();
const [Grid] = useVbenVxeGrid<DownloadLog>({
  formOptions: {
    schema: [
      { component: 'Input', fieldName: 'uid', label: '用户 ID' },
      { component: 'Input', fieldName: 'res_id', label: '资源 ID' },
    ],
  },
  gridOptions: {
    columns: [
      { field: 'user_name', title: '用户' },
      { field: 'uid', title: '用户 ID' },
      { field: 'res_id', title: '资源 ID' },
      { field: 'file_name', title: '文件' },
      { field: 'ip', title: '下载 IP' },
      { field: 'client', title: '客户端' },
      { field: 'status', title: '状态' },
      {
        field: 'started_at',
        title: '时间',
        formatter: ({ cellValue }) =>
          new Date(Number(cellValue) * 1000).toLocaleString(),
      },
    ],
    height: 'auto',
    pagerConfig: { pageSize: 20, pageSizes: [10, 20, 50, 100] },
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) =>
          ResDownloadApi.logs({
            page: page.currentPage,
            size: page.pageSize,
            uid: formValues.uid ? Number(formValues.uid) : undefined,
            res_id: formValues.res_id ? Number(formValues.res_id) : undefined,
          }),
      },
    },
    toolbarConfig: { refresh: true, search: true, zoom: true },
  } as VxeTableGridOptions<DownloadLog>,
});

onMounted(async () => {
  stats.value = await ResDownloadApi.stats({ limit: 10 });
});
</script>

<template>
  <Page auto-content-height title="资源下载监测">
    <div class="mb-4 grid grid-cols-4 gap-4">
      <Card>
        <Statistic title="下载次数" :value="stats?.total_downloads ?? 0" />
      </Card>
      <Card>
        <Statistic title="下载用户" :value="stats?.unique_users ?? 0" />
      </Card>
      <Card><Statistic title="来源 IP" :value="stats?.unique_ips ?? 0" /></Card>
      <Card>
        <Statistic title="下载字节" :value="stats?.total_bytes ?? 0" />
      </Card>
    </div>
    <Tabs>
      <TabPane key="logs" tab="下载记录">
        <Grid table-title="下载记录" />
      </TabPane>
      <TabPane key="ranking" tab="资源排行">
        <div class="rounded border p-4">
          <div
            v-for="row in stats?.ranking ?? []"
            :key="String(row.res_id)"
            class="flex justify-between border-b py-2"
          >
            <span>{{ row.resource_name || `资源 ${row.res_id}` }}</span>
            <strong>{{ row.download_count }} 次</strong>
          </div>
        </div>
      </TabPane>
    </Tabs>
  </Page>
</template>
