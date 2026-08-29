<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { WmxtSubmission } from '#/api/wmxt';

import { onMounted, ref } from 'vue';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, message, Space } from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { WmxtAdminApi } from '#/api/wmxt';

import { useColumns, useFormSchema } from './data';
import MaterialForm from './modules/material-form.vue';
import ReviewForm from './modules/review-form.vue';

const taskLabelMap = ref(new Map<number | string, string>());

const [MaterialDrawer, materialDrawerApi] = useVbenDrawer({
  connectedComponent: MaterialForm,
  destroyOnClose: true,
});
const [ReviewDrawer, reviewDrawerApi] = useVbenDrawer({
  connectedComponent: ReviewForm,
  destroyOnClose: true,
});

const [Grid, gridApi] = useVbenVxeGrid<WmxtSubmission>({
  formOptions: { schema: useFormSchema(), submitOnChange: true },
  gridOptions: {
    columns: useColumns((taskId) => {
      if (!taskId || Number(taskId) <= 0) return '公共资料';
      return taskLabelMap.value.get(taskId) ?? `任务（${taskId}）`;
    }),
    height: 'auto',
    pagerConfig: { pageSize: 20, pageSizes: [10, 20, 50, 100] },
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) =>
          WmxtAdminApi.submissions({
            ...(formValues as Record<string, boolean | number | string>),
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
  } as VxeTableGridOptions<WmxtSubmission>,
});

function onRefresh() {
  gridApi.query();
}

function openPublicMaterial() {
  materialDrawerApi.open();
}

function openReview(row: WmxtSubmission) {
  reviewDrawerApi.setData(row).open();
}

async function loadTaskLabels() {
  const result = await WmxtAdminApi.tasks({ page: 1, size: 100 });
  taskLabelMap.value = new Map(
    result.items.map((task) => [task.id, `${task.title}（${task.category}）`]),
  );
}

onMounted(loadTaskLabels);

async function onPackage(row: WmxtSubmission) {
  const task = await WmxtAdminApi.package_submission(row.id);
  message.success(`已提交打包执行：${task.executor_code} #${task.id}`);
  onRefresh();
}
</script>

<template>
  <Page
    auto-content-height
    class="management-page"
    content-class="management-content"
  >
    <MaterialDrawer @success="onRefresh" />
    <ReviewDrawer @success="onRefresh" />
    <Grid class="management-grid" table-title="提交审核">
      <template #toolbar-tools>
        <Button
          v-access:code="'wmxt:submission:review'"
          type="primary"
          @click="openPublicMaterial"
        >
          <Plus class="size-5" />公共资料
        </Button>
      </template>
      <template #actions="{ row }">
        <Space size="small">
          <Button
            v-access:code="'wmxt:submission:review'"
            size="small"
            type="link"
            @click.stop="openReview(row)"
          >
            审核
          </Button>
          <Button
            v-access:code="'wmxt:submission:review'"
            size="small"
            type="link"
            @click.stop="onPackage(row)"
          >
            打包
          </Button>
        </Space>
      </template>
    </Grid>
  </Page>
</template>
