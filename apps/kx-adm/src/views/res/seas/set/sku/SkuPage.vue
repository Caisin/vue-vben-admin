<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';

import { computed, ref } from 'vue';

import { Page } from '@vben/common-ui';

import { Badge, Button, message, Popconfirm, Tag } from 'antdv-next';

import { useVbenVxeGrid, VbenTableAction } from '#/adapter/vxe-table';
import * as androidApi from '#/api/res/seas/set/sku/android';
import * as iosApi from '#/api/res/seas/set/sku/ios';

import { useColumns, useGridFormSchema } from './data';
import SkuModal from './SkuModal.vue';

const props = defineProps<{ platform: 'google' | 'ios'; title: string }>();

const api = computed(() => (props.platform === 'google' ? androidApi : iosApi));
const modalOpen = ref(false);
const modalMode = ref<'base' | 'normal' | 'vip'>('base');
const activeRecord = ref<Record<string, any>>({});

function normalizeRows(payload: any) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.records)) return payload.records;
  return payload ? [payload] : [];
}

function normalizeTotal(payload: any, list: any[]) {
  return Number(payload?.total ?? payload?.count ?? list.length);
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    schema: useGridFormSchema(),
    submitOnChange: true,
  },
  gridOptions: {
    columns: useColumns(),
    height: 'auto',
    pagerConfig: { pageSize: 20, pageSizes: [10, 20, 50, 100] },
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) => {
          const payload = await api.value.getList({
            product_id: formValues.product_id?.trim() || undefined,
            product_name_prefix: formValues.product_name?.trim() || undefined,
            state: formValues.state,
            page: page.currentPage,
            size: page.pageSize,
          });
          const items = normalizeRows(payload);
          return { items, total: normalizeTotal(payload, items) };
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
  } as VxeTableGridOptions,
});

function productInfo(record: any) {
  return record?.product_info ?? {};
}

function itemTypeLabel(record: any) {
  return productInfo(record).item_type === 'vip' ? 'VIP' : '普通充值';
}

function amountText(record: any) {
  const info = productInfo(record);
  if (!info.amount) return '-';
  if (info.item_type === 'vip')
    return `${info.amount} 美分 / VIP ${info.vip_days || 0} 天`;
  return `${info.amount} 美分 / 金币 ${info.coin || 0} + 赠币 ${info.coupon || 0}`;
}

function openModal(
  mode: 'base' | 'normal' | 'vip',
  record: Record<string, any> = {},
) {
  modalMode.value = mode;
  activeRecord.value = record;
  modalOpen.value = true;
}

async function save(payload: any) {
  await api.value.postSave(payload);
  message.success('保存成功');
  modalOpen.value = false;
  await gridApi.query();
}

async function remove(record: any) {
  await api.value.postDelete(record.id);
  message.success('删除成功');
  await gridApi.query();
}
</script>

<template>
  <Page
    auto-content-height
    class="management-page"
    content-class="management-content"
    :title="title"
  >
    <Grid class="management-grid" :table-title="title">
      <template #toolbar-tools>
        <Button
          type="primary"
          @click="
            openModal('base', {
              product_info: { item_type: 'normal' },
              state: 1,
            })
          "
        >
          新增 SKU
        </Button>
      </template>
      <template #itemType="{ row }">
        <Tag :color="productInfo(row).item_type === 'vip' ? 'purple' : 'blue'">
          {{ itemTypeLabel(row) }}
        </Tag>
      </template>
      <template #amount="{ row }">{{ amountText(row) }}</template>
      <template #subscription="{ row }">
        <Badge
          :status="row.subscription ? 'processing' : 'default'"
          :text="row.subscription ? '是' : '否'"
        />
      </template>
      <template #enabled="{ row }">
        <Badge
          :status="row.enabled ? 'success' : 'error'"
          :text="row.enabled ? '正常' : '停用'"
        />
      </template>
      <template #operation="{ row }">
        <VbenTableAction
          :actions="[
            {
              icon: 'lucide:edit',
              onClick: () => openModal('base', row),
              text: '编辑',
            },
            {
              icon: 'lucide:coins',
              onClick: () => openModal('normal', row),
              ifShow: productInfo(row).item_type !== 'vip',
              text: '普通模板',
            },
            {
              icon: 'lucide:crown',
              onClick: () => openModal('vip', row),
              ifShow: productInfo(row).item_type === 'vip',
              text: 'VIP 模板',
            },
          ]"
          align="center"
        />
        <Popconfirm title="确定删除该 SKU？" @confirm="remove(row)">
          <Button danger size="small" type="link">删除</Button>
        </Popconfirm>
      </template>
    </Grid>

    <SkuModal
      v-model:open="modalOpen"
      :mode="modalMode"
      :record="activeRecord"
      @submit="save"
    />
  </Page>
</template>
