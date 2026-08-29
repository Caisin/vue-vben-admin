<script lang="ts" setup>
import type { KeyI18nRow } from '../data';

import type { VbenFormSchema } from '#/adapter/form';
import type { KeyI18nWrite } from '#/api/param/i18n';

import { computed, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { Alert, message } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import { KeyI18nApi } from '#/api/param/i18n';

const emit = defineEmits<{ success: [] }>();
const formData = ref<KeyI18nRow>();

const schema: VbenFormSchema[] = [
  {
    component: 'Input',
    fieldName: 'lang',
    label: '语言编码',
    rules: 'required',
  },
  { component: 'Input', fieldName: 'key', label: '翻译键', rules: 'required' },
  {
    component: 'Textarea',
    componentProps: { autoSize: { maxRows: 10, minRows: 4 } },
    fieldName: 'value',
    formItemClass: 'md:col-span-2',
    label: '翻译文本',
    rules: 'required',
  },
];

const [Form, formApi] = useVbenForm({
  commonConfig: { colon: true, formItemClass: 'col-span-1' },
  schema,
  showDefaultActions: false,
  wrapperClass: 'grid-cols-1 md:grid-cols-2 gap-x-4',
});

const [Drawer, drawerApi] = useVbenDrawer<KeyI18nRow>({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;
    drawerApi.lock();
    try {
      await KeyI18nApi.save((await formApi.getValues()) as KeyI18nWrite);
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
    formData.value = data?.row_key ? data : undefined;
    await formApi.reset();
    if (formData.value) await formApi.setValues(formData.value);
  },
});

const drawerTitle = computed(() =>
  formData.value?.row_key ? '编辑按键翻译' : '新增按键翻译',
);
</script>

<template>
  <Drawer class="w-full max-w-160" :title="drawerTitle">
    <Alert
      class="mx-4 mb-3"
      message="单条翻译用于快速修复页面文案；同一语言编码下 key 应保持唯一。"
      show-icon
      type="info"
    />
    <Form class="mx-4" />
  </Drawer>
</template>
