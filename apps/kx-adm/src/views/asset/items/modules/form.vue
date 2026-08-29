<script lang="ts" setup>
import type { VbenFormSchema } from '#/adapter/form';
import type { AssetItem, AssetItemWrite } from '#/api/asset/asset';

import { computed, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { message } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import { AssetApi } from '#/api/asset/asset';

import { assetKindOptions } from '../data';

const emit = defineEmits<{ success: [] }>();
const formData = ref<AssetItem>();

const schema: VbenFormSchema[] = [
  {
    component: 'Input',
    fieldName: 'code',
    label: '资产编码',
    rules: 'required',
  },
  {
    component: 'Input',
    fieldName: 'name',
    label: '资产名称',
    rules: 'required',
  },
  {
    component: 'Select',
    componentProps: { class: 'w-full', options: assetKindOptions },
    fieldName: 'kind',
    help: '积分使用 coin 类型；WMXT 文明积分科目由系统启动基线自动维护。',
    label: '资产类型',
    rules: 'selectRequired',
  },
  {
    component: 'InputNumber',
    componentProps: { class: 'w-full', min: 0 },
    fieldName: 'spend_priority',
    label: '扣减优先级',
  },
  {
    component: 'InputNumber',
    componentProps: { class: 'w-full', min: 0 },
    fieldName: 'default_valid_seconds',
    label: '默认有效秒数',
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
    fieldName: 'intro',
    formItemClass: 'md:col-span-2',
    label: '说明',
  },
];

const [Form, formApi] = useVbenForm({
  commonConfig: { colon: true, formItemClass: 'col-span-1' },
  schema,
  showDefaultActions: false,
  wrapperClass: 'grid-cols-1 md:grid-cols-2 gap-x-4',
});

const [Drawer, drawerApi] = useVbenDrawer<AssetItem>({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;
    drawerApi.lock();
    try {
      const values = (await formApi.getValues()) as AssetItemWrite;
      await (formData.value?.id
        ? AssetApi.update(formData.value.id, values)
        : AssetApi.create(values));
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
  formData.value?.id ? '编辑资产目录' : '新建资产目录',
);
</script>

<template>
  <Drawer class="w-full max-w-160" :title="drawerTitle">
    <Form class="mx-4" />
  </Drawer>
</template>
