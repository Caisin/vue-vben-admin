<script lang="ts" setup>
import type {
  OnActionClickParams,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';
import type { MallProduct, MallSku } from '#/api/mall';

import { computed, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, message, Modal, Tag } from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { MallAdminApi } from '#/api/mall';

import { useSkuColumns } from '../data';
import SkuForm from './sku-form.vue';

const product = ref<MallProduct>();
const skus = ref<MallSku[]>([]);

const [SkuFormDrawer, skuFormDrawerApi] = useVbenDrawer({
  connectedComponent: SkuForm,
  destroyOnClose: true,
});

const [Grid, gridApi] = useVbenVxeGrid<MallSku>({
  gridOptions: {
    columns: useSkuColumns(onSkuActionClick),
    height: 'auto',
    keepSource: true,
    pagerConfig: { enabled: false },
    proxyConfig: {
      ajax: {
        query: async () => ({ items: skus.value, total: skus.value.length }),
      },
    },
    rowConfig: { keyField: 'id' },
    toolbarConfig: { custom: true, export: false, refresh: false, zoom: true },
  } as VxeTableGridOptions<MallSku>,
});

const [Drawer, drawerApi] = useVbenDrawer<MallProduct>({
  onOpenChange(isOpen) {
    if (!isOpen) return;
    product.value = drawerApi.getData();
    void loadSkus();
  },
});

async function loadSkus() {
  if (!product.value) return;
  const detail = await MallAdminApi.product(product.value.id);
  product.value = detail.product ?? detail;
  skus.value = detail.skus ?? [];
  await gridApi.query();
}

function onCreateSku() {
  if (!product.value) return;
  skuFormDrawerApi.setData({ product: product.value }).open();
}
function onEditSku(row: MallSku) {
  if (!product.value) return;
  skuFormDrawerApi.setData({ product: product.value, sku: row }).open();
}
function onDeleteSku(row: MallSku) {
  Modal.confirm({
    okText: '删除',
    okType: 'danger',
    async onOk() {
      await MallAdminApi.removeSku(row.id);
      message.success('SKU 已删除');
      await loadSkus();
    },
    title: `确认删除 SKU「${row.name}」？`,
  });
}
function onSkuActionClick({ code, row }: OnActionClickParams<MallSku>) {
  if (code === 'edit') onEditSku(row);
  if (code === 'delete') onDeleteSku(row);
}

const drawerTitle = computed(() => `SKU 管理 - ${product.value?.name ?? ''}`);
</script>

<template>
  <Drawer class="w-full max-w-220" :title="drawerTitle">
    <SkuFormDrawer @success="loadSkus" />
    <Grid table-title="SKU 列表">
      <template #toolbar-tools>
        <Button
          v-access:code="'mall:product:write'"
          type="primary"
          @click="onCreateSku"
        >
          <Plus class="size-5" />新建 SKU
        </Button>
      </template>
      <template #skuNameCell="{ row }">
        <Button
          class="min-w-0 truncate px-0 text-left"
          size="small"
          type="link"
          @click.stop="onEditSku(row)"
        >
          {{ row.name || '-' }}
        </Button>
      </template>
      <template #specsCell="{ row }">
        <div class="flex flex-wrap gap-1">
          <Tag
            v-for="spec in row.specs ?? []"
            :key="`${spec.name}:${spec.value}`"
          >
            {{ spec.name }}：{{ spec.value }}
          </Tag>
          <span v-if="!row.specs?.length">单规格</span>
        </div>
      </template>
    </Grid>
  </Drawer>
</template>
