<script lang="ts" setup>
import type { VbenFormSchema } from '#/adapter/form';
import type { WmxtPointYearOverview } from '#/api/wmxt';

import { ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { Alert, message } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import { WmxtAdminApi } from '#/api/wmxt';

const emit = defineEmits<{ success: [] }>();
const current = ref<WmxtPointYearOverview>();

const schema: VbenFormSchema[] = [
  {
    component: 'DatePicker',
    componentProps: { class: 'w-full', picker: 'year', valueFormat: 'YYYY' },
    fieldName: 'year',
    help: '选择需要配置积分预算和换算比例的自然年度。',
    label: '年度',
    rules: 'required',
  },
  {
    component: 'InputNumber',
    componentProps: { addonAfter: '元', class: 'w-full', min: 1, precision: 0 },
    fieldName: 'budget_amount',
    help: '本年度用于积分发放的投入金额，单位为元；该值不是积分数量。',
    label: '总投入金额',
    rules: 'required',
  },
  {
    component: 'InputNumber',
    componentProps: {
      addonAfter: '积分/元',
      class: 'w-full',
      min: 1,
      precision: 0,
    },
    fieldName: 'point_ratio',
    formItemClass: 'md:col-span-2',
    help: '每投入 1 元可换算的积分数。例如填 100，表示 1 元 = 100 积分；年度可发积分 = 总投入金额 × 积分换算比例。',
    label: '积分换算比例',
    rules: 'required',
  },
  {
    component: 'Textarea',
    componentProps: { autoSize: { maxRows: 6, minRows: 3 } },
    fieldName: 'remark',
    formItemClass: 'md:col-span-2',
    help: '记录本年度积分预算配置的业务说明或调整原因。',
    label: '备注',
  },
];

const [Form, formApi] = useVbenForm({
  layout: 'vertical',
  commonConfig: {
    formItemClass: 'col-span-1',
  },
  schema,
  showDefaultActions: false,
  wrapperClass: 'grid-cols-1 md:grid-cols-2 gap-x-6',
});

const [Modal, modalApi] = useVbenModal<WmxtPointYearOverview>({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;

    modalApi.lock();
    try {
      const values = await formApi.getValues();
      await WmxtAdminApi.save_point_config({
        budget_amount: Number(values.budget_amount),
        id: current.value?.id,
        point_ratio: Number(values.point_ratio),
        remark: values.remark,
        year: Number(values.year),
      });
      message.success('年度积分配置已保存');
      modalApi.close();
      emit('success');
    } finally {
      modalApi.lock(false);
    }
  },
  async onOpenChange(isOpen) {
    if (!isOpen) return;
    current.value = modalApi.getData();
    await formApi.reset();
    await formApi.setValues({
      budget_amount: Number(current.value?.budget_amount ?? 0),
      point_ratio: Number(current.value?.point_ratio ?? 1),
      remark: current.value?.remark ?? '',
      year: String(current.value?.year ?? new Date().getFullYear()),
    });
  },
});
</script>

<template>
  <Modal class="w-full max-w-200" title="年度积分配置">
    <div class="space-y-5 px-1">
      <Alert
        description="例如投入 10,000 元，比例为 100 积分/元，则本年度最多可发 1,000,000 积分。"
        message="年度可发积分 = 总投入金额（元）× 积分换算比例（积分/元）"
        show-icon
        type="info"
      />
      <Form />
    </div>
  </Modal>
</template>
