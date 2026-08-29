<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { WmxtSurvey } from '#/api/wmxt';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, Popconfirm, Space } from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { WmxtAdminApi } from '#/api/wmxt';

import { useColumns, useFormSchema } from './data';
import SurveyForm from './modules/form.vue';

const [FormDrawer, formDrawerApi] = useVbenDrawer({
  connectedComponent: SurveyForm,
  destroyOnClose: true,
});

const [Grid, gridApi] = useVbenVxeGrid<WmxtSurvey>({
  formOptions: { schema: useFormSchema(), submitOnChange: true },
  gridOptions: {
    columns: useColumns(),
    height: 'auto',
    pagerConfig: { pageSize: 20, pageSizes: [10, 20, 50, 100] },
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) =>
          WmxtAdminApi.surveys({
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
  } as VxeTableGridOptions<WmxtSurvey>,
});

function onRefresh() {
  gridApi.query();
}

function openCreate() {
  formDrawerApi.setData(undefined).open();
}

function openEdit(row: WmxtSurvey) {
  formDrawerApi.setData(row).open();
}

async function onRemove(row: WmxtSurvey) {
  if (row.id === undefined) return;
  await WmxtAdminApi.remove_survey(row.id);
  onRefresh();
}
</script>

<template>
  <Page
    auto-content-height
    class="management-page"
    content-class="management-content"
  >
    <FormDrawer @success="onRefresh" />
    <Grid class="management-grid" table-title="问卷管理">
      <template #toolbar-tools>
        <Button
          v-access:code="'wmxt:survey:write'"
          type="primary"
          @click="openCreate"
        >
          <Plus class="size-5" />新建问卷
        </Button>
      </template>
      <template #actions="{ row }">
        <Space size="small">
          <Button
            v-access:code="'wmxt:survey:write'"
            size="small"
            type="link"
            @click.stop="openEdit(row)"
          >
            编辑
          </Button>
          <Popconfirm title="确定删除该记录？" @confirm="onRemove(row)">
            <Button
              v-access:code="'wmxt:survey:write'"
              danger
              size="small"
              type="link"
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      </template>
    </Grid>
  </Page>
</template>
