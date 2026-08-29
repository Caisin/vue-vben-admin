<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type {
  MallAdminAfterSalePageQuery,
  MallAfterSaleView,
} from '#/api/mall';

import { Page, useVbenDrawer } from '@vben/common-ui';

import { Button } from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { MallAdminApi } from '#/api/mall';
import { vxeSortParams } from '#/vxe-sort';

import { useColumns, useGridFormSchema } from './data';
import Detail from './modules/detail.vue';

const sortFields = ['id', 'created_at', 'updated_at'];

const [DetailDrawer, detailDrawerApi] = useVbenDrawer({
  connectedComponent: Detail,
  destroyOnClose: true,
});

const [Grid, gridApi] = useVbenVxeGrid<MallAfterSaleView>({
  formOptions: { schema: useGridFormSchema(), submitOnChange: true },
  gridOptions: {
    columns: useColumns(),
    height: 'auto',
    pagerConfig: { pageSize: 20, pageSizes: [10, 20, 50, 100] },
    proxyConfig: {
      ajax: {
        query: async (params, formValues) => {
          const { page } = params;
          return MallAdminApi.afterSales({
            ...(formValues as MallAdminAfterSalePageQuery),
            ...vxeSortParams(params, sortFields),
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
  } as VxeTableGridOptions<MallAfterSaleView>,
});

function openDetail(row: MallAfterSaleView) {
  detailDrawerApi.setData(row).open();
}
</script>

<template>
  <Page
    auto-content-height
    class="management-page"
    content-class="management-content"
  >
    <DetailDrawer @success="gridApi.query()" />
    <Grid class="management-grid" table-title="商城售后">
      <template #noCell="{ row }">
        <Button
          class="px-0"
          size="small"
          type="link"
          @click.stop="openDetail(row)"
        >
          {{ row.after_sale_no }}
        </Button>
      </template>
    </Grid>
  </Page>
</template>
