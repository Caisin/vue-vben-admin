<script lang="ts" setup>
import type { VbenFormSchema } from '#/adapter/form';
import type {
  MallProduct,
  MallSku,
  MallSkuSpec,
  MallSkuWrite,
} from '#/api/mall';

import { computed, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { message } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import { MallAdminApi } from '#/api/mall';

import { fulfillmentTypeOptions, mallStatusSelectOptions } from '../../shared';

interface SkuFormValues extends Omit<MallSkuWrite, 'specs'> {
  specs: MallSkuSpec[];
}

const emit = defineEmits<{ success: [] }>();
const formData = ref<MallSku>();
const product = ref<MallProduct>();

const schema: VbenFormSchema<SkuFormValues>[] = [
  {
    component: 'Input',
    fieldName: 'code',
    label: 'SKU 编码',
    rules: 'required',
  },
  {
    component: 'Input',
    fieldName: 'name',
    label: 'SKU 名称',
    rules: 'required',
  },
  {
    component: 'InputNumber',
    componentProps: { class: 'w-full', min: 1 },
    fieldName: 'points_price',
    help: '兑换所需积分必须大于 0；发布商品前至少需要一个已发布 SKU。',
    label: '积分价格',
    rules: 'required',
  },
  {
    component: 'Select',
    componentProps: { class: 'w-full', options: fulfillmentTypeOptions },
    defaultValue: 'physical_delivery',
    fieldName: 'fulfillment_type',
    help: '虚拟发放 SKU 发布前必须先通过库存任务导入可用兑换码。',
    label: '履约类型',
    rules: 'selectRequired',
  },
  {
    component: 'Select',
    componentProps: { class: 'w-full', options: mallStatusSelectOptions },
    defaultValue: 'draft',
    fieldName: 'status',
    label: '状态',
    rules: 'selectRequired',
  },
  {
    component: 'InputNumber',
    componentProps: { class: 'w-full', min: 0 },
    fieldName: 'per_user_limit',
    help: '留空表示不限制单用户兑换数量，0 表示不能兑换。',
    label: '单用户限兑',
  },
  {
    arrayProps: {
      addButtonText: '添加规格',
      createRow: () => ({ name: '', value: '' }),
      emptyText: '单规格商品可不配置规格项',
    },
    children: [
      {
        component: 'Input',
        fieldName: 'name',
        label: '规格名',
        rules: 'required',
      },
      {
        component: 'Input',
        fieldName: 'value',
        label: '规格值',
        rules: 'required',
      },
    ],
    defaultValue: [],
    fieldName: 'specs',
    formItemClass: 'col-span-full',
    label: '规格项',
    type: 'array',
  },
];

const [Form, formApi] = useVbenForm<SkuFormValues>({
  commonConfig: { colon: true, formItemClass: 'col-span-1' },
  schema,
  showDefaultActions: false,
  wrapperClass: 'grid-cols-1 md:grid-cols-2 gap-x-4',
});

const [Drawer, drawerApi] = useVbenDrawer<{
  product: MallProduct;
  sku?: MallSku;
}>({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid || !product.value) return;
    drawerApi.lock();
    try {
      const values = await formApi.getValues();
      const payload: MallSkuWrite = {
        ...values,
        per_user_limit: values.per_user_limit || null,
        product_id: product.value.id,
        specs: values.specs ?? [],
        status: values.status ?? 'draft',
      };
      await (formData.value?.id
        ? MallAdminApi.updateSku(formData.value.id, payload)
        : MallAdminApi.createSku(payload));
      message.success('SKU 保存成功');
      drawerApi.close();
      emit('success');
    } finally {
      drawerApi.unlock();
    }
  },
  async onOpenChange(isOpen) {
    if (!isOpen) return;
    const data = drawerApi.getData();
    if (!data) return;
    product.value = data.product;
    formData.value = data.sku;
    await formApi.reset();
    await formApi.setValues({
      ...data.sku,
      fulfillment_type: data.sku?.fulfillment_type ?? 'physical_delivery',
      specs: data.sku?.specs ?? [],
      status: data.sku?.status ?? 'draft',
    });
  },
});

const drawerTitle = computed(() =>
  formData.value?.id
    ? `编辑 SKU - ${product.value?.name ?? ''}`
    : `新建 SKU - ${product.value?.name ?? ''}`,
);
</script>

<template>
  <Drawer class="w-full max-w-180" :title="drawerTitle">
    <Form class="mx-4" />
  </Drawer>
</template>
