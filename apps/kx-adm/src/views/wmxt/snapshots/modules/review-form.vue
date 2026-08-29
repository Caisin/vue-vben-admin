<script lang="ts" setup>
import type { VbenFormSchema } from '#/adapter/form';
import type { SnapshotStatus, WmxtSnapshot } from '#/api/wmxt';

import { ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { message } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import { WmxtAdminApi } from '#/api/wmxt';

import { toNumber } from '../../utils';
import { reviewStatusOptions } from '../data';

interface ReviewFormValues {
  points?: number;
  review_comment: string;
  status: SnapshotStatus;
}

const emit = defineEmits<{ success: [] }>();
const current = ref<WmxtSnapshot>();

const schema: VbenFormSchema<ReviewFormValues>[] = [
  {
    component: 'Select',
    componentProps: { class: 'w-full', options: reviewStatusOptions },
    fieldName: 'status',
    help: '审核结果会改变随手拍记录在小程序端的状态。',
    label: '结果',
    rules: 'selectRequired',
  },
  {
    component: 'InputNumber',
    componentProps: { class: 'w-full', min: 0, precision: 0 },
    fieldName: 'points',
    help: '审核通过时发放的奖励积分；拒绝或整改可填 0。',
    label: '积分',
  },
  {
    component: 'Textarea',
    componentProps: { autoSize: { maxRows: 8, minRows: 4 } },
    fieldName: 'review_comment',
    formItemClass: 'md:col-span-2',
    help: '审核意见用于追溯，必要时展示给提交人。',
    label: '意见',
  },
];

const [Form, formApi] = useVbenForm<ReviewFormValues>({
  commonConfig: {
    colon: true,
    formItemClass: 'col-span-1',
    labelClass: 'whitespace-nowrap',
    labelWidth: 96,
  },
  schema,
  showDefaultActions: false,
  wrapperClass: 'grid-cols-1 md:grid-cols-2 gap-x-4',
});

const [Drawer, drawerApi] = useVbenDrawer<WmxtSnapshot>({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid || !current.value) return;
    drawerApi.lock();
    try {
      const values = await formApi.getValues();
      await WmxtAdminApi.review_snapshot(current.value.id, {
        points:
          values.points === undefined ? undefined : toNumber(values.points),
        review_comment: values.review_comment ?? '',
        status: values.status,
      });
      message.success('随手拍审核已保存');
      drawerApi.close();
      emit('success');
    } finally {
      drawerApi.unlock();
    }
  },
  async onOpenChange(isOpen) {
    if (!isOpen) return;
    current.value = drawerApi.getData();
    await formApi.reset();
    await formApi.setValues({
      points: 0,
      review_comment: '',
      status: 'approved',
    });
  },
});
</script>

<template>
  <Drawer class="w-full max-w-120" title="随手拍审核">
    <Form class="mx-4" />
  </Drawer>
</template>
