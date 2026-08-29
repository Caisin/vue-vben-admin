<script lang="ts" setup>
import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type {
  PayItem,
  PaySku,
  PaySkuPageQuery,
  PaySkuWrite,
} from '#/api/asset/pay';

import { computed, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, message, Popconfirm, Space } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { PayApi } from '#/api/asset/pay';
import {
  formatJsonEditorValue,
  parseJsonEditorValue,
} from '#/views/_shared/crud-page';
import { vxeSortParams } from '#/vxe-sort';

import { skuProviderOptions, useSkuColumns } from '../data';

const currentItem = ref<PayItem>();
const editingSku = ref<PaySku>();

interface SkuFormValues extends Omit<PaySkuWrite, 'provider_metadata'> {
  provider_metadata?: unknown;
}

const skuSortFields = [
  'id',
  'pay_item_id',
  'provider',
  'product_id',
  'created_at',
];

const schema: VbenFormSchema[] = [
  {
    component: 'Select',
    componentProps: { class: 'w-full', options: skuProviderOptions },
    fieldName: 'provider',
    label: 'Provider',
    rules: 'selectRequired',
  },
  {
    component: 'Input',
    fieldName: 'product_id',
    label: 'SKU ID',
    rules: 'required',
  },
  {
    component: 'Input',
    fieldName: 'product_name',
    label: 'SKU 名称',
    rules: 'required',
  },
  {
    component: 'Switch',
    componentProps: { disabled: true },
    defaultValue: false,
    fieldName: 'subscription',
    help: 'SKU 订阅类型由支付商品“订阅”字段决定，保存时强制同步，避免旧客户端和支付平台语义不一致。',
    label: '订阅',
  },
  {
    component: 'Switch',
    defaultValue: true,
    fieldName: 'enabled',
    label: '启用',
  },
  {
    component: 'JsonEditor',
    componentProps: {
      maxHeight: '360px',
      minHeight: '180px',
      valueMode: 'text',
    },
    fieldName: 'provider_metadata',
    formItemClass: 'col-span-full',
    help: '保存旧 product_info 中 amount、coin、coupon、vip_days、summary 等动态字段；不得写入平台密钥。',
    label: 'Provider 元数据',
  },
];

const [Form, formApi] = useVbenForm({
  commonConfig: { colon: true, formItemClass: 'col-span-1' },
  schema,
  showDefaultActions: false,
  wrapperClass: 'grid-cols-1 md:grid-cols-2 gap-x-4',
});

const [Grid, gridApi] = useVbenVxeGrid<PaySku>({
  formOptions: { schema: [], showCollapseButton: false },
  gridOptions: {
    columns: useSkuColumns(onSkuEnabledChange),
    height: 320,
    keepSource: true,
    pagerConfig: { pageSize: 10, pageSizes: [10, 20, 50] },
    proxyConfig: {
      ajax: {
        query: async (params) => {
          const { page } = params;
          return PayApi.skuList({
            pay_item_id: currentItem.value?.id,
            ...vxeSortParams(params, skuSortFields),
            page: page.currentPage,
            size: page.pageSize,
          } as PaySkuPageQuery);
        },
      },
    },
    rowConfig: { keyField: 'id' },
    sortConfig: { remote: true },
    toolbarConfig: { custom: true, refresh: true, zoom: false },
  } as VxeTableGridOptions<PaySku>,
});

const [Drawer, drawerApi] = useVbenDrawer<PayItem>({
  async onOpenChange(isOpen) {
    if (!isOpen) return;
    currentItem.value = drawerApi.getData();
    await resetForm();
    await gridApi.query();
  },
});

const drawerTitle = computed(() =>
  currentItem.value
    ? `Provider SKU：${currentItem.value.title}`
    : 'Provider SKU',
);

function decodeSku(row?: PaySku): SkuFormValues {
  return {
    enabled: row?.enabled ?? true,
    pay_item_id: currentItem.value?.id ?? row?.pay_item_id ?? 0,
    product_id: row?.product_id ?? '',
    product_name: row?.product_name ?? '',
    provider: row?.provider ?? 'google',
    provider_metadata: formatJsonEditorValue(row?.provider_metadata ?? {}),
    subscription: currentItem.value?.is_sub ?? row?.subscription ?? false,
  };
}

function encodeSku(values: SkuFormValues): PaySkuWrite {
  return {
    ...values,
    pay_item_id: currentItem.value?.id ?? values.pay_item_id,
    provider_metadata: parseJsonEditorValue(values.provider_metadata ?? '{}'),
    subscription: Boolean(currentItem.value?.is_sub),
  };
}

async function resetForm() {
  editingSku.value = undefined;
  await formApi.reset();
  await formApi.setValues(decodeSku());
}

async function editSku(row: PaySku) {
  editingSku.value = row;
  await formApi.reset();
  await formApi.setValues(decodeSku(row));
}

async function submitSku() {
  const { valid } = await formApi.validate();
  if (!valid) return;
  if (!currentItem.value?.id) {
    message.warning('请先选择支付商品');
    return;
  }
  try {
    const values = encodeSku((await formApi.getValues()) as SkuFormValues);
    await (editingSku.value?.id
      ? PayApi.updateSku(editingSku.value.id, values)
      : PayApi.createSku(values));
    message.success('SKU 已保存');
    await resetForm();
    await gridApi.query();
  } catch (error) {
    if (error instanceof SyntaxError) {
      message.error('Provider 元数据 JSON 格式不正确');
      return;
    }
    throw error;
  }
}

async function removeSku(row: PaySku) {
  await PayApi.removeSku(row.id);
  message.success('SKU 已删除');
  await gridApi.query();
}

async function onSkuEnabledChange(enabled: boolean, row: PaySku) {
  await PayApi.updateSku(row.id, {
    enabled,
    pay_item_id: row.pay_item_id,
    product_id: row.product_id,
    product_name: row.product_name,
    provider: row.provider,
    provider_metadata: row.provider_metadata,
    subscription: Boolean(currentItem.value?.is_sub ?? row.subscription),
  });
  return true;
}
</script>

<template>
  <Drawer class="w-full max-w-220" :title="drawerTitle">
    <div class="mx-4 flex flex-col gap-4">
      <Form />
      <Space>
        <Button type="primary" @click="submitSku">
          <Plus class="size-4" />{{ editingSku ? '保存 SKU' : '新增 SKU' }}
        </Button>
        <Button @click="resetForm">清空表单</Button>
      </Space>
      <Grid table-title="平台 SKU">
        <template #skuNameCell="{ row }">
          <Button
            class="px-0"
            size="small"
            type="link"
            @click.stop="editSku(row)"
          >
            {{ row.product_name || '-' }}
          </Button>
        </template>
        <template #toolbar-tools>
          <span class="text-xs text-muted-foreground">
            Android/iOS 旧 SKU 均在此按 Provider 维护；订阅类型跟随商品：{{
              currentItem?.is_sub ? '订阅' : '一次性'
            }}
          </span>
        </template>
        <template #skuActionCell="{ row }">
          <Popconfirm title="确认删除该 SKU？" @confirm="removeSku(row)">
            <Button danger size="small">删除</Button>
          </Popconfirm>
        </template>
      </Grid>
    </div>
  </Drawer>
</template>
