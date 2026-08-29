<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { EnabledStatus, WmxtNotification } from '#/api/wmxt';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, Popconfirm, Space } from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { WmxtAdminApi } from '#/api/wmxt';

import { useColumns, useFormSchema } from './data';
import NotificationForm from './modules/form.vue';

const [FormDrawer, formDrawerApi] = useVbenDrawer({
  connectedComponent: NotificationForm,
  destroyOnClose: true,
});

const [Grid, gridApi] = useVbenVxeGrid<WmxtNotification>({
  formOptions: { schema: useFormSchema(), submitOnChange: true },
  gridOptions: {
    columns: useColumns(onStatusChange),
    height: 'auto',
    pagerConfig: { pageSize: 20, pageSizes: [10, 20, 50, 100] },
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) =>
          WmxtAdminApi.notifications({
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
  } as VxeTableGridOptions<WmxtNotification>,
});

function onRefresh() {
  gridApi.query();
}

function openCreate() {
  formDrawerApi.setData(undefined).open();
}

function openEdit(row: WmxtNotification) {
  formDrawerApi.setData(row).open();
}

async function onRemove(row: WmxtNotification) {
  if (row.id === undefined) return;
  await WmxtAdminApi.remove_notification(row.id);
  onRefresh();
}

async function onStatusChange(status: EnabledStatus, row: WmxtNotification) {
  if (row.id === undefined) return false;
  await WmxtAdminApi.update_notification(row.id, {
    content: row.content,
    id: row.id,
    notice_type: row.notice_type,
    published_at: row.published_at,
    sort_order: row.sort_order,
    status,
    target: row.target,
    title: row.title,
  });
  onRefresh();
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
    <Grid class="management-grid" table-title="通知管理">
      <template #toolbar-tools>
        <Button
          v-access:code="'wmxt:notification:write'"
          type="primary"
          @click="openCreate"
        >
          <Plus class="size-5" />新建通知
        </Button>
      </template>
      <template #actions="{ row }">
        <Space size="small">
          <Button
            v-access:code="'wmxt:notification:write'"
            size="small"
            type="link"
            @click.stop="openEdit(row)"
          >
            编辑
          </Button>
          <Popconfirm title="确定删除该记录？" @confirm="onRemove(row)">
            <Button
              v-access:code="'wmxt:notification:write'"
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
