<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type {
  SoftwareApplication,
  SoftwareOperation,
  SoftwareServer,
} from '#/api/software';

import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';

import { Page } from '@vben/common-ui';

import { Drawer, Tag } from 'antdv-next';

import { useVbenVxeGrid, VbenTableAction } from '#/adapter/vxe-table';
import { SoftwareApi } from '#/api/software';

import { useColumns, useGridFormSchema } from './data';
import OperationLog from './operation-log.vue';

const servers = ref<SoftwareServer[]>([]);
const applications = ref<SoftwareApplication[]>([]);
const detail = ref<SoftwareOperation>();
const route = useRoute();
const stateColors: Record<string, string> = {
  failed: 'error',
  running: 'processing',
  succeeded: 'success',
};
const stateLabels: Record<string, string> = {
  cancelled: '已取消',
  failed: '失败',
  pending: '等待执行',
  running: '执行中',
  succeeded: '成功',
};
const actionLabels: Record<string, string> = {
  check: '检查状态',
  health_check: '检查状态',
  install: '安装',
  reinstall: '重新安装',
  rollback: '回滚',
  switch: '切换版本',
  uninstall: '卸载',
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

function stateLabel(value: string) {
  return stateLabels[value] ?? value;
}

function actionLabel(value: string) {
  return actionLabels[value] ?? value;
}

onMounted(async () => {
  await loadReferenceData();
  const id = route.query.operation_id;
  if (typeof id === 'string' && id.trim())
    detail.value = await SoftwareApi.operation(id);
});
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
        <Tag :color="stateColor(row.state)">{{ stateLabel(row.state) }}</Tag>
      </template>
      <template #action="{ row }">{{ actionLabel(row.action) }}</template>
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
      size="min(680px, 100vw)"
      @close="detail = undefined"
    >
      <OperationLog v-if="detail" :operation-id="detail.id" />
    </Drawer>
  </Page>
</template>
