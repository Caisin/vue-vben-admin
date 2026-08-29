<script lang="ts" setup>
import type { VbenFormSchema } from '#/adapter/form';
import type { PayTemplate, PayTemplateWrite } from '#/api/asset/pay';

import { computed, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { message } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import { PayApi } from '#/api/asset/pay';

const emit = defineEmits<{ success: [] }>();
const formData = ref<PayTemplate>();

const schema: VbenFormSchema[] = [
  {
    component: 'Input',
    fieldName: 'code',
    label: '模板编码',
    rules: 'required',
  },
  {
    component: 'Input',
    fieldName: 'name',
    label: '模板名称',
    rules: 'required',
  },
  {
    component: 'Switch',
    defaultValue: true,
    fieldName: 'enabled',
    label: '启用',
  },
  {
    component: 'Textarea',
    componentProps: { autoSize: { maxRows: 8, minRows: 3 } },
    fieldName: 'remark',
    formItemClass: 'md:col-span-2',
    label: '备注',
  },
];

const [Form, formApi] = useVbenForm({
  commonConfig: { colon: true, formItemClass: 'col-span-1' },
  schema,
  showDefaultActions: false,
  wrapperClass: 'grid-cols-1 md:grid-cols-2 gap-x-4',
});

const [Drawer, drawerApi] = useVbenDrawer<PayTemplate>({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;
    drawerApi.lock();
    try {
      const values = (await formApi.getValues()) as PayTemplateWrite;
      await (formData.value?.id
        ? PayApi.updateTemplate(formData.value.id, values)
        : PayApi.createTemplate(values));
      message.success('保存成功');
      drawerApi.close();
      emit('success');
    } finally {
      drawerApi.unlock();
    }
  },
  async onOpenChange(isOpen) {
    if (!isOpen) return;
    const data = drawerApi.getData();
    formData.value = data?.id ? data : undefined;
    await formApi.reset();
    if (formData.value) await formApi.setValues(formData.value);
  },
});

const drawerTitle = computed(() =>
  formData.value?.id ? '编辑支付模板' : '新建支付模板',
);
</script>

<template>
  <Drawer class="w-full max-w-160" :title="drawerTitle">
    <Form class="mx-4" />
  </Drawer>
</template>
