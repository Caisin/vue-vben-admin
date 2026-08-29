<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { KxI18n } from '#/api/param/i18n';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button } from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { I18nApi } from '#/api/param/i18n';
import { optionalString } from '#/views/_shared/crud-page';

import { useColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';

const [FormDrawer, formDrawerApi] = useVbenDrawer({
  connectedComponent: Form,
  destroyOnClose: true,
});
const [Grid, gridApi] = useVbenVxeGrid<KxI18n>({
  formOptions: { schema: useGridFormSchema(), submitOnChange: true },
  gridOptions: {
    columns: useColumns(onEnabledChange),
    height: 'auto',
    keepSource: true,
    pagerConfig: { pageSize: 20, pageSizes: [10, 20, 50, 100] },
    proxyConfig: {
      ajax: {
        query: async (_params, formValues) => {
          const locale = optionalString(formValues.locale);
          if (!locale) return { items: [], total: 0 };
          const item = await I18nApi.item(locale);
          return { items: [item], total: 1 };
        },
      },
    },
    rowConfig: { keyField: 'locale' },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<KxI18n>,
});
function onRefresh() {
  gridApi.query();
}
function onCreate() {
  formDrawerApi.setData({}).open();
}
function onEdit(row: KxI18n) {
  formDrawerApi.setData(row).open();
}
async function onEnabledChange(enabled: boolean, row: KxI18n) {
  await I18nApi.save({
    data: row.data,
    enabled,
    locale: row.locale,
    name: row.name,
  });
  return true;
}
function previewJson(value: unknown) {
  const text =
    typeof value === 'string' ? value : JSON.stringify(value ?? null, null, 2);
  return text.length > 260 ? `${text.slice(0, 260)}…` : text;
}
</script>

<template>
  <Page
    auto-content-height
    class="management-page"
    content-class="management-content"
    title="语言包"
  >
    <FormDrawer @success="onRefresh" />
    <Grid class="management-grid" table-title="语言包">
      <template #toolbar-tools>
        <Button type="primary" @click="onCreate">
          <Plus class="size-5" />合并语言包
        </Button>
      </template>
      <template #localeCell="{ row }">
        <Button
          class="min-w-0 truncate px-0 text-left"
          size="small"
          type="link"
          @click.stop="onEdit(row)"
        >
          {{ row.locale || '-' }}
        </Button>
      </template>
      <template #dataCell="{ row }">
        <pre class="json-preview">{{ previewJson(row.data) }}</pre>
      </template>
    </Grid>
  </Page>
</template>

<style scoped>
.json-preview {
  max-height: 88px;
  margin: 0;
  overflow: hidden;
  font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 12px;
  line-height: 1.45;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
</style>
