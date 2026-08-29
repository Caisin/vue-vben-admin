<script lang="ts" setup>
import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';
import type { MallProduct, MallProductPageQuery } from '#/api/mall';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, message, Modal, Space, Tag } from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { MallAdminApi } from '#/api/mall';
import { vxeSortParams } from '#/vxe-sort';

import MallJobDrawer from '../components/job-drawer.vue';
import { useColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';
import Skus from './modules/skus.vue';

const productSortFields = [
  'id',
  'name',
  'status',
  'published_at',
  'created_at',
  'updated_at',
];

const [FormDrawer, formDrawerApi] = useVbenDrawer({
  connectedComponent: Form,
  destroyOnClose: true,
});
const [SkusDrawer, skusDrawerApi] = useVbenDrawer({
  connectedComponent: Skus,
  destroyOnClose: true,
});
const [JobDrawer, jobDrawerApi] = useVbenDrawer({
  connectedComponent: MallJobDrawer,
  destroyOnClose: true,
});

const [Grid, gridApi] = useVbenVxeGrid<MallProduct>({
  formOptions: { schema: useGridFormSchema(), submitOnChange: true },
  gridOptions: {
    columns: useColumns(onActionClick),
    height: 'auto',
    keepSource: true,
    pagerConfig: { pageSize: 20, pageSizes: [10, 20, 50, 100] },
    proxyConfig: {
      ajax: {
        query: async (params, formValues) => {
          const { page } = params;
          return MallAdminApi.products({
            ...(formValues as MallProductPageQuery),
            ...vxeSortParams(params, productSortFields),
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
  } as VxeTableGridOptions<MallProduct>,
});

function onRefresh() {
  gridApi.query();
}
function onCreate() {
  formDrawerApi.setData({}).open();
}
function onProductImport() {
  jobDrawerApi
    .setData({ job_type: 'product_import', title: '商品导入' })
    .open();
}
function onEdit(row: MallProduct) {
  formDrawerApi.setData(row).open();
}
function onSkus(row: MallProduct) {
  skusDrawerApi.setData(row).open();
}
function onDelete(row: MallProduct) {
  Modal.confirm({
    okText: '删除',
    okType: 'danger',
    async onOk() {
      await MallAdminApi.removeProduct(row.id);
      message.success('商品已删除');
      onRefresh();
    },
    title: `确认删除商品「${row.name}」？`,
  });
}
function publishMessage(row: MallProduct) {
  return `发布商品「${row.name}」会立即进入公开目录；发布校验会检查类目、SKU、库存和履约配置。`;
}
function onPublish(row: MallProduct) {
  Modal.confirm({
    content: publishMessage(row),
    okText: '发布',
    async onOk() {
      await MallAdminApi.publishProduct(row.id);
      message.success('商品已发布');
      onRefresh();
    },
    title: '确认发布商品？',
  });
}
function onUnpublish(row: MallProduct) {
  Modal.confirm({
    content: `下架商品「${row.name}」后用户端不再展示，历史引用仍保留。`,
    okText: '下架',
    async onOk() {
      await MallAdminApi.unpublishProduct(row.id);
      message.success('商品已下架');
      onRefresh();
    },
    title: '确认下架商品？',
  });
}
function onActionClick({ code, row }: OnActionClickParams<MallProduct>) {
  if (code === 'edit') onEdit(row);
  if (code === 'skus') onSkus(row);
  if (code === 'delete') onDelete(row);
  if (code === 'publish') onPublish(row);
  if (code === 'unpublish') onUnpublish(row);
}
</script>

<template>
  <Page
    auto-content-height
    class="management-page"
    content-class="management-content"
  >
    <FormDrawer @success="onRefresh" />
    <SkusDrawer @success="onRefresh" />
    <JobDrawer @success="onRefresh" />
    <Grid class="management-grid" table-title="商城商品">
      <template #toolbar-tools>
        <Space>
          <Button v-access:code="'mall:product:write'" @click="onProductImport">
            商品导入
          </Button>
          <Button
            v-access:code="'mall:product:write'"
            type="primary"
            @click="onCreate"
          >
            <Plus class="size-5" />新建商品
          </Button>
        </Space>
      </template>
      <template #nameCell="{ row }">
        <div class="min-w-0">
          <Button
            class="min-w-0 truncate px-0 text-left"
            size="small"
            type="link"
            @click.stop="onEdit(row)"
          >
            {{ row.name || '-' }}
          </Button>
          <div class="truncate text-xs text-muted-foreground">
            {{ row.subtitle || '无副标题' }}
          </div>
        </div>
      </template>
      <template #featuredCell="{ row }">
        <Tag :color="row.featured ? 'success' : 'default'">
          {{ row.featured ? '推荐' : '普通' }}
        </Tag>
      </template>
    </Grid>
  </Page>
</template>
