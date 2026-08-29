<script lang="ts" setup>
import type { VbenFormSchema } from '#/adapter/form';
import type { WmxtPointYearOverview } from '#/api/wmxt';

import { useVbenDrawer } from '@vben/common-ui';

import { message } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import { WmxtAdminApi } from '#/api/wmxt';

const emit = defineEmits<{ success: [] }>();

const schema: VbenFormSchema[] = [
  {
    component: 'DatePicker',
    componentProps: { class: 'w-full', picker: 'year', valueFormat: 'YYYY' },
    fieldName: 'year',
    help: '选择签到积分生效的自然年度。',
    label: '年度',
    rules: 'required',
  },
  {
    component: 'InputNumber',
    componentProps: { class: 'w-full', min: 0, precision: 0 },
    fieldName: 'sign_in_points',
    help: '用户每日签到成功后获得的积分数量。',
    label: '签到积分',
    rules: 'required',
  },
];

const [Form, formApi] = useVbenForm({
  commonConfig: {
    colon: true,
    formItemClass: 'col-span-1',
    labelClass: 'whitespace-nowrap',
    labelWidth: 120,
  },
  schema,
  showDefaultActions: false,
  wrapperClass: 'grid-cols-1',
});

const [Drawer, drawerApi] = useVbenDrawer<WmxtPointYearOverview>({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;

    drawerApi.lock();
    try {
      const values = await formApi.getValues();
      await WmxtAdminApi.save_checkin_config({
        sign_in_points: Number(values.sign_in_points),
        year: Number(values.year),
      });
      message.success('签到积分配置已保存');
      drawerApi.close();
      emit('success');
    } finally {
      drawerApi.unlock();
    }
  },
  async onOpenChange(isOpen) {
    if (!isOpen) return;
    const current = drawerApi.getData();
    await formApi.reset();
    await formApi.setValues({
      sign_in_points: Number(current?.sign_in_points ?? 0),
      year: String(current?.year ?? new Date().getFullYear()),
    });
  },
});
</script>

<template>
  <Drawer class="w-full max-w-120" title="签到积分配置">
    <Form class="mx-4" />
  </Drawer>
</template>
