<script lang="ts" setup>
import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';
import type { FileGroup } from '#/api/storage/group';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, message, Modal } from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { StorageGroupApi } from '#/api/storage/group';
import { localPageResult } from '#/views/_shared/crud-page';
import { vxeSortLocalRows } from '#/vxe-sort';

import { useColumns } from './data';
import Form from './modules/form.vue';

const groupSortFields = ['id', 'group_code', 'order_no', 'create_time'];

const [FormDrawer, formDrawerApi] = useVbenDrawer({
  connectedComponent: Form,
  destroyOnClose: true,
});

const [Grid, gridApi] = useVbenVxeGrid<FileGroup>({
  gridOptions: {
    columns: useColumns(onActionClick),
    height: 'auto',
    keepSource: true,
    pagerConfig: { pageSize: 20, pageSizes: [10, 20, 50, 100] },
    proxyConfig: {
      ajax: {
        query: async (params) => {
          const { page } = params;
          const rows = vxeSortLocalRows(
            await StorageGroupApi.list(),
            params,
            groupSortFields,
          );
          return localPageResult(rows, {
            page: page.currentPage,
            size: page.pageSize,
          });
        },
      },
    },
    sortConfig: { remote: true },
    rowConfig: { keyField: 'id' },
    toolbarConfig: { custom: true, export: false, refresh: true, zoom: true },
  } as VxeTableGridOptions<FileGroup>,
});

function onActionClick({ code, row }: OnActionClickParams<FileGroup>) {
  if (code === 'delete') onDelete(row);
}
function onRefresh() {
  gridApi.query();
}
function onCreate() {
  formDrawerApi.setData({}).open();
}
function onEdit(row: FileGroup) {
  formDrawerApi.setData(row).open();
}
function onDelete(row: FileGroup) {
  Modal.confirm({
    cancelText: '取消',
    content: '删除后会解除该分组的文件关系，但不会删除文件本身。',
    okButtonProps: { danger: true },
    okText: '删除分组',
    title: `确认删除文件分组“${row.group_name}”？`,
    async onOk() {
      const hideLoading = message.loading({
        content: `正在删除文件分组 ${row.group_name}`,
        duration: 0,
        key: 'action_process_msg',
      });
      try {
        await StorageGroupApi.remove(row.id);
        message.success({
          content: `文件分组 ${row.group_name} 已删除`,
          key: 'action_process_msg',
        });
        onRefresh();
      } catch (error) {
        hideLoading();
        throw error;
      }
    },
  });
}
</script>

<template>
  <Page
    auto-content-height
    class="management-page"
    content-class="management-content"
    title="文件分组"
  >
    <FormDrawer @success="onRefresh" />
    <Grid class="management-grid" table-title="文件分组">
      <template #toolbar-tools>
        <Button type="primary" @click="onCreate">
          <Plus class="size-5" />新建文件分组
        </Button>
      </template>
      <template #nameCell="{ row }">
        <Button
          class="min-w-0 truncate px-0 text-left"
          size="small"
          type="link"
          @click.stop="onEdit(row)"
        >
          {{ row.group_name || '-' }}
        </Button>
      </template>
    </Grid>
  </Page>
</template>
