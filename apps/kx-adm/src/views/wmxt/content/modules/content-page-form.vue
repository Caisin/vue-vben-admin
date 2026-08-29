<script lang="ts" setup>
import type { VbenFormSchema } from '#/adapter/form';
import type { WmxtContentPage, WmxtContentPageWrite } from '#/api/wmxt';

import { computed, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { message } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import { WmxtAdminApi } from '#/api/wmxt';

const emit = defineEmits<{ success: [page: WmxtContentPage] }>();
const current = ref<WmxtContentPage>();

const schema: VbenFormSchema<WmxtContentPageWrite>[] = [
  {
    component: 'Input',
    componentProps: { placeholder: '如：personal_home' },
    fieldName: 'code',
    help: '页面被模块引用后不可修改编码。',
    label: '页面编码',
    rules: 'required',
  },
  {
    component: 'Input',
    componentProps: { placeholder: '如：个人首页' },
    fieldName: 'name',
    label: '页面名称',
    rules: 'required',
  },
  {
    component: 'InputNumber',
    componentProps: { class: 'w-full', min: 0, precision: 0 },
    fieldName: 'sort_order',
    label: '排序',
    rules: 'required',
  },
  {
    component: 'DicSelect',
    componentProps: { class: 'w-full', code: 'wmxt_module_status' },
    fieldName: 'status',
    label: '状态',
    rules: 'selectRequired',
  },
];

const [Form, formApi] = useVbenForm<WmxtContentPageWrite>({
  commonConfig: { colon: true, labelWidth: 96 },
  schema,
  showDefaultActions: false,
  wrapperClass: 'grid-cols-1',
});

const [Drawer, drawerApi] = useVbenDrawer<WmxtContentPage>({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;
    drawerApi.lock();
    try {
      const values = (await formApi.getValues()) as WmxtContentPageWrite;
      const saved = current.value?.id
        ? await WmxtAdminApi.update_content_page(current.value.id, values)
        : await WmxtAdminApi.create_content_page(values);
      message.success('内容页面已保存');
      emit('success', saved);
      drawerApi.close();
    } finally {
      drawerApi.unlock();
    }
  },
  async onOpenChange(open) {
    if (!open) return;
    current.value = drawerApi.getData();
    await formApi.reset();
    await formApi.setValues(
      current.value?.id
        ? current.value
        : { code: '', name: '', sort_order: 0, status: 'active' },
    );
  },
});

const title = computed(() =>
  current.value?.id ? '编辑内容页面' : '新增内容页面',
);
</script>

<template>
  <Drawer class="w-full max-w-120" :title="title">
    <Form class="mx-4" />
  </Drawer>
</template>
