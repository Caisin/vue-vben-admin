<script lang="ts" setup>
import type { VbenFormSchema } from '#/adapter/form';
import type { MallInventoryAdjustWrite, MallInventoryView } from '#/api/mall';

import { computed, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { Alert, Descriptions, DescriptionsItem, message } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import { MallAdminApi } from '#/api/mall';

import { toNumberValue } from '../../shared';

const emit = defineEmits<{ success: [] }>();
const inventory = ref<MallInventoryView>();

const schema: VbenFormSchema<MallInventoryAdjustWrite>[] = [
  {
    component: 'InputNumber',
    componentProps: {
      class: 'w-full',
      onChange: (value: number | string) => {
        deltaPreview.value = value;
      },
    },
    fieldName: 'delta',
    help: '正数增加可售库存，负数减少可售库存；后端会使用乐观版本防止并发覆盖。',
    label: '调整数量',
    rules: 'required',
  },
  {
    component: 'Textarea',
    componentProps: { autoSize: { maxRows: 6, minRows: 3 } },
    fieldName: 'reason',
    formItemClass: 'col-span-full',
    help: '库存调整必须填写审计原因，便于对账和人工排查。',
    label: '调整原因',
    rules: 'required',
  },
];

const [Form, formApi] = useVbenForm<MallInventoryAdjustWrite>({
  commonConfig: { colon: true, formItemClass: 'col-span-1' },
  schema,
  showDefaultActions: false,
  wrapperClass: 'grid-cols-1 md:grid-cols-2 gap-x-4',
});

const deltaPreview = ref<number | string>(0);
const afterStock = computed(() => {
  const current = toNumberValue(inventory.value?.available_stock);
  return current + toNumberValue(deltaPreview.value);
});

const [Drawer, drawerApi] = useVbenDrawer<MallInventoryView>({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid || !inventory.value) return;
    drawerApi.lock();
    try {
      const values = await formApi.getValues();
      await MallAdminApi.adjustInventory(inventory.value.sku_id, {
        delta: values.delta,
        reason: values.reason,
      });
      message.success('库存调整成功');
      drawerApi.close();
      emit('success');
    } finally {
      drawerApi.unlock();
    }
  },
  async onOpenChange(isOpen) {
    if (!isOpen) return;
    inventory.value = drawerApi.getData();
    deltaPreview.value = 0;
    await formApi.reset();
    await formApi.setValues({ delta: 0 });
  },
});

const drawerTitle = computed(
  () => `调整库存 - SKU ${inventory.value?.sku_id ?? ''}`,
);
</script>

<template>
  <Drawer class="w-full max-w-160" :title="drawerTitle">
    <div class="mx-4 grid gap-4">
      <Alert
        show-icon
        type="warning"
        message="库存调整会同事务写入流水；减少库存前请确认不会导致当前可售库存小于 0。"
      />
      <Descriptions v-if="inventory" bordered :column="2" size="small">
        <DescriptionsItem label="SKU ID">
          {{ inventory.sku_id }}
        </DescriptionsItem>
        <DescriptionsItem label="当前可售">
          {{ inventory.available_stock }}
        </DescriptionsItem>
        <DescriptionsItem label="已售数量">
          {{ inventory.sold_stock }}
        </DescriptionsItem>
        <DescriptionsItem label="调整后可售">{{ afterStock }}</DescriptionsItem>
      </Descriptions>
      <Form />
    </div>
  </Drawer>
</template>
