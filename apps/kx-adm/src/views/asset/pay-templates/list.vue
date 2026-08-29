<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { PayTemplate, PayTemplatePageQuery } from '#/api/asset/pay';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, TabPane, Tabs } from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { PayApi } from '#/api/asset/pay';
import { vxeSortParams } from '#/vxe-sort';

import { useColumns, useGridFormSchema } from './data';
import Defaults from './modules/defaults.vue';
import Form from './modules/form.vue';

const payTemplateSortFields = ['id', 'code', 'created_at'];

const [FormDrawer, formDrawerApi] = useVbenDrawer({
  connectedComponent: Form,
  destroyOnClose: true,
});
const [Grid, gridApi] = useVbenVxeGrid<PayTemplate>({
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
          return PayApi.templateList({
            ...(formValues as PayTemplatePageQuery),
            ...vxeSortParams(params, payTemplateSortFields),
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
  } as VxeTableGridOptions<PayTemplate>,
});
function onRefresh() {
  gridApi.query();
}
function onCreate() {
  formDrawerApi.setData({}).open();
}
function onEdit(row: PayTemplate) {
  formDrawerApi.setData(row).open();
}
async function onEnabledChange(enabled: boolean, row: PayTemplate) {
  await PayApi.updateTemplate(row.id, {
    code: row.code,
    enabled,
    name: row.name,
    remark: row.remark,
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
    <Tabs>
      <TabPane key="templates" tab="支付模板">
        <Grid class="management-grid" table-title="支付模板">
          <template #toolbar-tools>
            <Button type="primary" @click="onCreate">
              <Plus class="size-5" />新建支付模板
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
      </TabPane>
      <TabPane key="defaults" tab="默认模板">
        <Defaults />
      </TabPane>
    </Tabs>
  </Page>
</template>
