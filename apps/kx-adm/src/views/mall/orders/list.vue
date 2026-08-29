<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { MallAdminOrder, MallAdminOrderPageQuery } from '#/api/mall';

import { ref } from 'vue';

import { Page, useVbenDrawer } from '@vben/common-ui';

import { Button, Space } from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { MallAdminApi } from '#/api/mall';
import { vxeSortParams } from '#/vxe-sort';

import MallJobDrawer from '../components/job-drawer.vue';
import { useColumns, useGridFormSchema } from './data';
import Detail from './modules/detail.vue';

const orderSortFields = ['id', 'created_at', 'points_total', 'status'];
const lastQuery = ref<MallAdminOrderPageQuery>({});

const [DetailDrawer, detailDrawerApi] = useVbenDrawer({
  connectedComponent: Detail,
  destroyOnClose: true,
});
const [JobDrawer, jobDrawerApi] = useVbenDrawer({
  connectedComponent: MallJobDrawer,
  destroyOnClose: true,
});

const [Grid, gridApi] = useVbenVxeGrid<MallAdminOrder>({
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
          lastQuery.value = formValues as MallAdminOrderPageQuery;
          return MallAdminApi.orders({
            ...lastQuery.value,
            ...vxeSortParams(params, orderSortFields),
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
  } as VxeTableGridOptions<MallAdminOrder>,
});

function openDetail(row: MallAdminOrder) {
  detailDrawerApi.setData(row).open();
}

function onRefresh() {
  gridApi.query();
}
function openShipmentImport() {
  jobDrawerApi
    .setData({ job_type: 'shipment_import', title: '批量发货' })
    .open();
}
function openOrderExport() {
  const { fulfillment_type, status } = lastQuery.value;
  jobDrawerApi
    .setData({
      job_type: 'order_export',
      params: { fulfillment_type, status },
      title: '订单导出',
    })
    .open();
}
</script>

<template>
  <Page
    auto-content-height
    class="management-page"
    content-class="management-content"
  >
    <DetailDrawer @success="onRefresh" />
    <JobDrawer @success="onRefresh" />
    <Grid class="management-grid" table-title="商城订单">
      <template #toolbar-tools>
        <Space>
          <Button
            v-access:code="'mall:order:fulfill'"
            @click="openShipmentImport"
          >
            批量发货
          </Button>
          <Button v-access:code="'mall:order:export'" @click="openOrderExport">
            订单导出
          </Button>
        </Space>
      </template>
      <template #orderNoCell="{ row }">
        <Button
          class="px-0"
          size="small"
          type="link"
          @click.stop="openDetail(row)"
        >
          {{ row.order_no }}
        </Button>
      </template>
    </Grid>
  </Page>
</template>
