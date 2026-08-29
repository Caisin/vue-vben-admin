<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type {
  MallInventoryLogPageQuery,
  MallInventoryPageQuery,
  MallInventoryView,
} from '#/api/mall';

import { Page, useVbenDrawer } from '@vben/common-ui';

import { Button, TabPane, Tabs } from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { MallAdminApi } from '#/api/mall';
import { vxeSortParams } from '#/vxe-sort';

import MallJobDrawer from '../components/job-drawer.vue';
import {
  useColumns,
  useGridFormSchema,
  useLogColumns,
  useLogGridFormSchema,
} from './data';
import Adjust from './modules/adjust.vue';

const inventorySortFields = [
  'id',
  'sku_id',
  'available_stock',
  'sold_stock',
  'updated_at',
];
const logSortFields = ['id', 'sku_id', 'created_at'];

const [AdjustDrawer, adjustDrawerApi] = useVbenDrawer({
  connectedComponent: Adjust,
  destroyOnClose: true,
});
const [JobDrawer, jobDrawerApi] = useVbenDrawer({
  connectedComponent: MallJobDrawer,
  destroyOnClose: true,
});

const [Grid, gridApi] = useVbenVxeGrid<MallInventoryView>({
  formOptions: { schema: useGridFormSchema(), submitOnChange: true },
  gridOptions: {
    columns: useColumns(),
    height: 'auto',
    keepSource: true,
    pagerConfig: { pageSize: 20, pageSizes: [10, 20, 50, 100] },
    proxyConfig: {
      ajax: {
        query: async (params, formValues) => {
          const { page } = params;
          return MallAdminApi.inventory({
            ...(formValues as MallInventoryPageQuery),
            ...vxeSortParams(params, inventorySortFields),
            page: page.currentPage,
            size: page.pageSize,
          });
        },
      },
    },
    rowConfig: { keyField: 'id' },
    sortConfig: { remote: true },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<MallInventoryView>,
});

const [LogGrid, logGridApi] = useVbenVxeGrid({
  formOptions: { schema: useLogGridFormSchema(), submitOnChange: true },
  gridOptions: {
    columns: useLogColumns(),
    height: 'auto',
    keepSource: true,
    pagerConfig: { pageSize: 20, pageSizes: [10, 20, 50, 100] },
    proxyConfig: {
      ajax: {
        query: async (params, formValues) => {
          const { page } = params;
          return MallAdminApi.inventoryLogs({
            ...(formValues as MallInventoryLogPageQuery),
            ...vxeSortParams(params, logSortFields),
            page: page.currentPage,
            size: page.pageSize,
          });
        },
      },
    },
    rowConfig: { keyField: 'id' },
    sortConfig: { remote: true },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions,
});

function onAdjust(row: MallInventoryView) {
  adjustDrawerApi.setData(row).open();
}
function onVirtualCodeImport() {
  jobDrawerApi
    .setData({ job_type: 'virtual_code_import', title: '虚拟码导入' })
    .open();
}
function onRefresh() {
  gridApi.query();
  logGridApi.query();
}
</script>

<template>
  <Page
    auto-content-height
    class="management-page"
    content-class="management-content"
  >
    <AdjustDrawer @success="onRefresh" />
    <JobDrawer @success="onRefresh" />
    <Tabs>
      <TabPane key="inventory" tab="库存投影">
        <Grid class="management-grid" table-title="库存投影">
          <template #toolbar-tools>
            <Button
              v-access:code="'mall:inventory:adjust'"
              @click="onVirtualCodeImport"
            >
              虚拟码导入
            </Button>
          </template>
          <template #operation="{ row }">
            <Button
              v-access:code="'mall:inventory:adjust'"
              size="small"
              type="link"
              @click="onAdjust(row)"
            >
              调整
            </Button>
          </template>
        </Grid>
      </TabPane>
      <TabPane key="logs" tab="库存流水">
        <LogGrid class="management-grid" table-title="库存流水" />
      </TabPane>
    </Tabs>
  </Page>
</template>
