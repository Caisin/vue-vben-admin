<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { WmxtSnapshot } from '#/api/wmxt';

import { Page, useVbenDrawer } from '@vben/common-ui';

import { Button, Space } from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { WmxtAdminApi } from '#/api/wmxt';

import { useColumns, useFormSchema } from './data';
import RectifyForm from './modules/rectify-form.vue';
import ReviewForm from './modules/review-form.vue';

const [ReviewDrawer, reviewDrawerApi] = useVbenDrawer({
  connectedComponent: ReviewForm,
  destroyOnClose: true,
});
const [RectifyDrawer, rectifyDrawerApi] = useVbenDrawer({
  connectedComponent: RectifyForm,
  destroyOnClose: true,
});

const [Grid, gridApi] = useVbenVxeGrid<WmxtSnapshot>({
  formOptions: { schema: useFormSchema(), submitOnChange: true },
  gridOptions: {
    columns: useColumns(),
    height: 'auto',
    pagerConfig: { pageSize: 20, pageSizes: [10, 20, 50, 100] },
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) =>
          WmxtAdminApi.snapshots({
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
  } as VxeTableGridOptions<WmxtSnapshot>,
});

function onRefresh() {
  gridApi.query();
}

function openReview(row: WmxtSnapshot) {
  reviewDrawerApi.setData(row).open();
}

function openRectify(row: WmxtSnapshot) {
  rectifyDrawerApi.setData(row).open();
}
</script>

<template>
  <Page
    auto-content-height
    class="management-page"
    content-class="management-content"
  >
    <ReviewDrawer @success="onRefresh" />
    <RectifyDrawer @success="onRefresh" />
    <Grid class="management-grid" table-title="随手拍审核">
      <template #actions="{ row }">
        <Space size="small">
          <Button
            v-access:code="'wmxt:snapshot:review'"
            size="small"
            type="link"
            @click.stop="openReview(row)"
          >
            审核
          </Button>
          <Button
            v-access:code="'wmxt:snapshot:review'"
            size="small"
            type="link"
            @click.stop="openRectify(row)"
          >
            整改
          </Button>
        </Space>
      </template>
    </Grid>
  </Page>
</template>
