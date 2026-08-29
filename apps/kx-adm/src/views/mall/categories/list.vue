<script lang="ts" setup>
import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';
import type { MallCategory, MallProductStatus } from '#/api/mall';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, message, Modal } from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { MallAdminApi } from '#/api/mall';

import { useColumns, useFormSchema } from './data';
import Form from './modules/form.vue';

const [FormDrawer, formDrawerApi] = useVbenDrawer({
  connectedComponent: Form,
  destroyOnClose: true,
});

const [Grid, gridApi] = useVbenVxeGrid<MallCategory>({
  formOptions: { schema: useFormSchema(), submitOnChange: true },
  gridOptions: {
    columns: useColumns(onActionClick),
    height: 'auto',
    keepSource: true,
    pagerConfig: { enabled: false },
    proxyConfig: {
      ajax: {
        query: async (_params, formValues) => {
          const keyword = String(formValues.keyword ?? '').trim();
          const status = formValues.status as MallProductStatus | undefined;
          const categories = await MallAdminApi.categories();
          const items = categories.filter((item) => {
            const keywordMatched =
              !keyword ||
              item.name.includes(keyword) ||
              item.code.includes(keyword);
            const statusMatched = !status || item.status === status;
            return keywordMatched && statusMatched;
          });
          return { items, total: items.length };
        },
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
    treeConfig: {
      parentField: 'parent_id',
      rowField: 'id',
      transform: true,
    },
  } as VxeTableGridOptions<MallCategory>,
});

function onActionClick({ code, row }: OnActionClickParams<MallCategory>) {
  if (code === 'append') onAppend(row);
  if (code === 'edit') onEdit(row);
  if (code === 'delete') onDelete(row);
}

function onRefresh() {
  gridApi.query();
}
function onCreate() {
  formDrawerApi.setData({}).open();
}
function onAppend(row: MallCategory) {
  formDrawerApi.setData({ parent_id: row.id }).open();
}
function onEdit(row: MallCategory) {
  formDrawerApi.setData(row).open();
}
function onDelete(row: MallCategory) {
  Modal.confirm({
    okText: '删除',
    okType: 'danger',
    async onOk() {
      await MallAdminApi.removeCategory(row.id);
      message.success('删除成功');
      onRefresh();
    },
    title: `确认删除类目「${row.name}」？`,
  });
}
</script>

<template>
  <Page
    auto-content-height
    class="management-page"
    content-class="management-content"
  >
    <FormDrawer @success="onRefresh" />
    <Grid class="management-grid" table-title="商城类目">
      <template #toolbar-tools>
        <Button
          v-access:code="'mall:category:write'"
          type="primary"
          @click="onCreate"
        >
          <Plus class="size-5" />新建类目
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
