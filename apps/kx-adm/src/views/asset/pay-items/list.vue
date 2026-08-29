<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type {
  PayItem,
  PayItemPageQuery,
  PayItemView,
  PayItemWrite,
} from '#/api/asset/pay';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button } from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { PayApi } from '#/api/asset/pay';
import { vxeSortParams } from '#/vxe-sort';

import { useColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';
import SkuDrawer from './modules/sku-drawer.vue';

const payItemSortFields = [
  'id',
  'template_id',
  'sort_no',
  'amount_minor',
  'created_at',
];

const [FormDrawer, formDrawerApi] = useVbenDrawer({
  connectedComponent: Form,
  destroyOnClose: true,
});
const [SkuDrawerComp, skuDrawerApi] = useVbenDrawer({
  connectedComponent: SkuDrawer,
  destroyOnClose: true,
});
const [Grid, gridApi] = useVbenVxeGrid<PayItem>({
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
          return PayApi.itemList({
            ...(formValues as PayItemPageQuery),
            ...vxeSortParams(params, payItemSortFields),
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
  } as VxeTableGridOptions<PayItem>,
});
function onRefresh() {
  gridApi.query();
}
function onCreate() {
  formDrawerApi.setData({}).open();
}
function onEdit(row: PayItem) {
  formDrawerApi.setData(row).open();
}
function onSku(row: PayItem) {
  skuDrawerApi.setData(row).open();
}
function itemViewToWrite(view: PayItemView, enabled?: boolean): PayItemWrite {
  const item = view.item;
  return {
    amount_minor: item.amount_minor,
    back_amount_minor: item.back_amount_minor,
    back_percent: item.back_percent,
    balance_grants: view.balance_grants.map(
      ({ asset_item_id, quantity, valid_seconds }) => ({
        asset_item_id,
        quantity,
        valid_seconds,
      }),
    ),
    code: item.code,
    currency: item.currency,
    cycle_day: item.cycle_day,
    display_config: item.display_config,
    enabled: enabled ?? item.enabled,
    ext_info: item.ext_info,
    intro: item.intro,
    is_sub: item.is_sub,
    item_type: item.item_type,
    lang_info: item.lang_info,
    membership_grants: view.membership_grants.map(
      ({ duration_seconds, membership_plan_id }) => ({
        duration_seconds,
        membership_plan_id,
      }),
    ),
    platform: item.platform,
    remark: item.remark,
    sort_no: item.sort_no,
    summary: item.summary,
    template_id: item.template_id,
    title: item.title,
    unlock_episode_count: item.unlock_episode_count,
  };
}

async function onEnabledChange(enabled: boolean, row: PayItem) {
  const detail = await PayApi.item(row.id);
  await PayApi.updateItem(row.id, itemViewToWrite(detail, enabled));
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
    <SkuDrawerComp />
    <Grid class="management-grid" table-title="支付商品">
      <template #toolbar-tools>
        <Button type="primary" @click="onCreate">
          <Plus class="size-5" />新建支付商品
        </Button>
      </template>
      <template #skuCell="{ row }">
        <Button size="small" type="link" @click.stop="onSku(row)">
          管理 SKU
        </Button>
      </template>
      <template #titleCell="{ row }">
        <Button
          class="min-w-0 truncate px-0 text-left"
          size="small"
          type="link"
          @click.stop="onEdit(row)"
        >
          {{ row.title || '-' }}
        </Button>
      </template>
    </Grid>
  </Page>
</template>
