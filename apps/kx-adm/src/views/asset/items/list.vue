<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { AssetItem, AssetItemPageQuery } from '#/api/asset/asset';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button } from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { AssetApi } from '#/api/asset/asset';
import { vxeSortParams } from '#/vxe-sort';

import { useColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';

const assetSortFields = ['id', 'code', 'spend_priority', 'created_at'];

const [FormDrawer, formDrawerApi] = useVbenDrawer({
  connectedComponent: Form,
  destroyOnClose: true,
});

const [Grid, gridApi] = useVbenVxeGrid<AssetItem>({
  formOptions: { schema: useGridFormSchema(), submitOnChange: true },
  gridOptions: {
    columns: useColumns(onEnabledChange),
    height: 'auto',
    keepSource: true,
    pagerConfig: { pageSize: 20, pageSizes: [10, 20, 50, 100] },
    proxyConfig: {
      ajax: {
        query: async (params, formValues) => {
          const { page } = params;
          return AssetApi.list({
            ...(formValues as AssetItemPageQuery),
            ...vxeSortParams(params, assetSortFields),
            page: page.currentPage,
            size: page.pageSize,
          });
        },
      },
    },
    sortConfig: { remote: true },
    rowConfig: { keyField: 'id' },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<AssetItem>,
});

function onRefresh() {
  gridApi.query();
}
function onCreate() {
  formDrawerApi.setData({}).open();
}
function onEdit(row: AssetItem) {
  formDrawerApi.setData(row).open();
}
async function onEnabledChange(enabled: boolean, row: AssetItem) {
  await AssetApi.update(row.id, {
    code: row.code,
    default_valid_seconds: row.default_valid_seconds,
    enabled,
    intro: row.intro,
    kind: row.kind,
    name: row.name,
    spend_priority: row.spend_priority,
  });
  return true;
}
</script>

<template>
  <Page
    auto-content-height
    class="management-page"
    content-class="management-content"
  >
    <FormDrawer @success="onRefresh" />
    <Grid class="management-grid" table-title="资产目录">
      <template #toolbar-tools>
        <Button type="primary" @click="onCreate">
          <Plus class="size-5" />新建资产
        </Button>
      </template>
      <template #nameCell="{ row }">
        <Button
          class="min-w-0 truncate px-0 text-left"
          size="small"
          type="link"
          @click.stop="onEdit(row)"
        >
          {{ row.name || '-' }}
        </Button>
      </template>
    </Grid>
  </Page>
</template>
