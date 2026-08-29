<script lang="ts" setup>
import type { VbenFormSchema } from '#/adapter/form';
import type { SubmissionStatus, WmxtSubmission } from '#/api/wmxt';

import { ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { message } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import { WmxtAdminApi } from '#/api/wmxt';

import { toNumber } from '../../utils';

interface ReviewFormValues {
  comment: string;
  score?: number;
  status: SubmissionStatus;
}

const emit = defineEmits<{ success: [] }>();
const current = ref<WmxtSubmission>();

const schema: VbenFormSchema<ReviewFormValues>[] = [
  {
    component: 'DicSelect',
    componentProps: { class: 'w-full', code: 'wmxt_submission_status' },
    fieldName: 'status',
    help: '审核结果会改变小程序端提交记录状态。',
    label: '结果',
    rules: 'selectRequired',
  },
  {
    component: 'InputNumber',
    componentProps: { class: 'w-full', min: 0, precision: 0 },
    fieldName: 'score',
    help: '审核通过时发放的奖励积分；拒绝或整改可填 0。',
    label: '积分',
  },
  {
    component: 'Textarea',
    componentProps: { autoSize: { maxRows: 8, minRows: 4 } },
    fieldName: 'comment',
    formItemClass: 'md:col-span-2',
    help: '审核意见会用于后台追溯，必要时展示给提交人。',
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

const [Drawer, drawerApi] = useVbenDrawer<WmxtSubmission>({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid || !current.value) return;
    drawerApi.lock();
    try {
      const values = await formApi.getValues();
      await WmxtAdminApi.review_submission(current.value.id, {
        comment: values.comment ?? '',
        score: values.score === undefined ? undefined : toNumber(values.score),
        status: values.status,
      });
      message.success('提交审核已保存');
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
    await formApi.setValues({ comment: '', score: 0, status: 'approved' });
  },
});
</script>

<template>
  <Drawer class="w-full max-w-120" title="提交审核">
    <Form class="mx-4" />
  </Drawer>
</template>
