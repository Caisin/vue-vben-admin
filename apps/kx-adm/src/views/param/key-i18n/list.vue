<script lang="ts" setup>
import type { KeyI18nRow } from './data';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { KeyI18nPageQuery } from '#/api/param/i18n';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button } from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { KeyI18nApi } from '#/api/param/i18n';
import { vxeSortParams } from '#/vxe-sort';

import { useColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';

const keyI18nSortFields = ['key', 'lang'];

const [FormDrawer, formDrawerApi] = useVbenDrawer({
  connectedComponent: Form,
  destroyOnClose: true,
});
const [Grid, gridApi] = useVbenVxeGrid<KeyI18nRow>({
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
          const result = await KeyI18nApi.list({
            ...(formValues as KeyI18nPageQuery),
            ...vxeSortParams(params, keyI18nSortFields),
            page: page.currentPage,
            size: page.pageSize,
          });
          return {
            items: result.items.map((item) => ({
              ...item,
              row_key: `${item.lang}:${item.key}`,
              value: item.val,
            })),
            total: result.total,
          };
        },
      },
    },
    sortConfig: { remote: true },
    rowConfig: { keyField: 'row_key' },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<KeyI18nRow>,
});
function onRefresh() {
  gridApi.query();
}
function onCreate() {
  formDrawerApi.setData({}).open();
}
function onEdit(row: KeyI18nRow) {
  formDrawerApi.setData(row).open();
}
</script>

<template>
  <Page
    auto-content-height
    class="management-page"
    content-class="management-content"
    title="按键翻译"
  >
    <FormDrawer @success="onRefresh" />
    <Grid class="management-grid" table-title="按键翻译">
      <template #toolbar-tools>
        <Button type="primary" @click="onCreate">
          <Plus class="size-5" />新增翻译
        </Button>
      </template>
      <template #keyCell="{ row }">
        <Button
          class="min-w-0 truncate px-0 text-left"
          size="small"
          type="link"
          @click.stop="onEdit(row)"
        >
          {{ row.key || '-' }}
        </Button>
      </template>
      <template #valueCell="{ row }">
        <span class="translation-preview" :title="row.value">
          {{ row.value || '-' }}
        </span>
      </template>
    </Grid>
  </Page>
</template>

<style scoped>
.translation-preview {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  color: hsl(var(--foreground));
  white-space: nowrap;
}
</style>
