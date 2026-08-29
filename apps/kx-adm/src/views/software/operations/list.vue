<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type {
  SoftwareApplication,
  SoftwareOperation,
  SoftwareServer,
} from '#/api/software';

import { onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import { Drawer, Tag } from 'antdv-next';

import { useVbenVxeGrid, VbenTableAction } from '#/adapter/vxe-table';
import { SoftwareApi } from '#/api/software';

import { useColumns, useGridFormSchema } from './data';

const servers = ref<SoftwareServer[]>([]);
const applications = ref<SoftwareApplication[]>([]);
const detail = ref<SoftwareOperation>();
const stateColors: Record<string, string> = {
  failed: 'error',
  running: 'processing',
  succeeded: 'success',
};
const serverOptions = () =>
  servers.value.map((item) => ({ label: item.name, value: item.id }));
const applicationOptions = () =>
  applications.value.map((item) => ({ label: item.name, value: item.id }));

const [Grid] = useVbenVxeGrid<SoftwareOperation>({
  formOptions: {
    schema: useGridFormSchema(serverOptions, applicationOptions),
    submitOnChange: true,
  },
  gridOptions: {
    columns: useColumns(),
    height: 'auto',
    pagerConfig: { pageSize: 20, pageSizes: [10, 20, 50, 100] },
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) =>
          SoftwareApi.operations({
            ...formValues,
            page: page.currentPage,
            size: page.pageSize,
          }),
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
  } as VxeTableGridOptions<SoftwareOperation>,
});

async function loadReferenceData() {
  const [serverPage, applicationPage] = await Promise.all([
    SoftwareApi.servers({ page: 1, size: 200 }),
    SoftwareApi.applications({ page: 1, size: 200 }),
  ]);
  servers.value = serverPage.items;
  applications.value = applicationPage.items;
}

function stateColor(value: string) {
  return stateColors[value] ?? 'default';
}

onMounted(loadReferenceData);
</script>

<template>
  <Page
    auto-content-height
    class="management-page"
    content-class="management-content"
    title="操作记录"
  >
    <Grid class="management-grid" table-title="操作记录">
      <template #state="{ row }">
        <Tag :color="stateColor(row.state)">{{ row.state }}</Tag>
      </template>
      <template #operation="{ row }">
        <VbenTableAction
          :actions="[
            {
              icon: 'lucide:eye',
              onClick: () => (detail = row),
              tooltip: '详情',
            },
          ]"
          align="center"
        />
      </template>
    </Grid>

    <Drawer
      :open="Boolean(detail)"
      title="操作详情"
      :size="680"
      @close="detail = undefined"
    >
      <template v-if="detail">
        <h4 class="mb-2 font-medium">标准输出</h4>
        <pre class="max-h-64 overflow-auto whitespace-pre-wrap bg-muted p-3">{{
          detail.stdout_tail || '-'
        }}</pre>
        <h4 class="mb-2 mt-4 font-medium">错误输出</h4>
        <pre class="max-h-64 overflow-auto whitespace-pre-wrap bg-muted p-3">{{
          detail.stderr_tail || detail.error_summary || '-'
        }}</pre>
      </template>
    </Drawer>
  </Page>
</template>
