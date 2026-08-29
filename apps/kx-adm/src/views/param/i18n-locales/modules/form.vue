<script lang="ts" setup>
import type { VbenFormSchema } from '#/adapter/form';
import type { I18nSave, KxI18n } from '#/api/param/i18n';

import { computed, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { Alert, message } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import { I18nApi } from '#/api/param/i18n';
import {
  formatJsonEditorValue,
  parseJsonEditorValue,
} from '#/views/_shared/crud-page';

const emit = defineEmits<{ success: [] }>();
const formData = ref<KxI18n>();

interface LocaleFormValues extends Omit<I18nSave, 'data'> {
  data: unknown;
}

const schema: VbenFormSchema[] = [
  {
    component: 'Input',
    fieldName: 'locale',
    label: '语言地区',
    rules: 'required',
  },
  { component: 'Input', fieldName: 'name', label: '显示名称' },
  {
    component: 'Switch',
    defaultValue: true,
    fieldName: 'enabled',
    label: '启用',
  },
  {
    component: 'JsonEditor',
    componentProps: {
      maxHeight: '560px',
      minHeight: '300px',
      valueMode: 'text',
    },
    fieldName: 'data',
    formItemClass: 'col-span-full',
    label: '语言包 JSON',
    rules: 'required',
  },
];

const [Form, formApi] = useVbenForm({
  commonConfig: { colon: true, formItemClass: 'col-span-1' },
  schema,
  showDefaultActions: false,
  wrapperClass: 'grid-cols-1 md:grid-cols-2 gap-x-4',
});

function encode(values: LocaleFormValues): I18nSave {
  return { ...values, data: parseJsonEditorValue(values.data) };
}

const [Drawer, drawerApi] = useVbenDrawer<KxI18n>({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;
    drawerApi.lock();
    try {
      await I18nApi.save(
        encode((await formApi.getValues()) as LocaleFormValues),
      );
      message.success('保存成功');
      drawerApi.close();
      emit('success');
    } catch (error) {
      if (error instanceof SyntaxError) {
        message.error('JSON 字段格式不正确');
        return;
      }
      throw error;
    } finally {
      drawerApi.unlock();
    }
  },
  async onOpenChange(isOpen) {
    if (!isOpen) return;
    const data = drawerApi.getData();
    formData.value = data?.locale ? data : undefined;
    await formApi.reset();
    if (formData.value)
      await formApi.setValues({
        ...formData.value,
        data: formatJsonEditorValue(formData.value.data),
      });
  },
});

const drawerTitle = computed(() =>
  formData.value?.locale ? '编辑语言包' : '合并语言包',
);
</script>

<template>
  <Drawer class="w-full max-w-180" :title="drawerTitle">
    <Alert
      class="mx-4 mb-3"
      message="语言包会按 locale 合并保存；请确认 JSON 顶层结构与前端翻译 key 一致，避免覆盖为非对象值。"
      show-icon
      type="info"
    />
    <Form class="mx-4" />
  </Drawer>
</template>
