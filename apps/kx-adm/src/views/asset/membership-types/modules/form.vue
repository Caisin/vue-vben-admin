<script lang="ts" setup>
import type { VbenFormSchema } from '#/adapter/form';
import type {
  MembershipType,
  MembershipTypeWrite,
} from '#/api/asset/membership';

import { computed, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { message } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import { MembershipApi } from '#/api/asset/membership';

const emit = defineEmits<{ success: [] }>();
const formData = ref<MembershipType>();

const schema: VbenFormSchema[] = [
  {
    component: 'Input',
    fieldName: 'code',
    label: '类型编码',
    rules: 'required',
  },
  {
    component: 'Input',
    fieldName: 'name',
    label: '类型名称',
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

const [Drawer, drawerApi] = useVbenDrawer<MembershipType>({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;
    drawerApi.lock();
    try {
      const values = (await formApi.getValues()) as MembershipTypeWrite;
      await (formData.value?.id
        ? MembershipApi.updateType(formData.value.id, values)
        : MembershipApi.createType(values));
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
  formData.value?.id ? '编辑会员类型' : '新建会员类型',
);
</script>

<template>
  <Drawer class="w-full max-w-160" :title="drawerTitle">
    <Form class="mx-4" />
  </Drawer>
</template>
