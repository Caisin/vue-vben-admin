<script lang="ts" setup>
import type { VbenFormSchema } from '#/adapter/form';
import type { FileGroup, FileGroupWrite } from '#/api/storage/group';

import { computed, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { Alert, message } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import { StorageGroupApi } from '#/api/storage/group';
import { toNumberArray } from '#/views/_shared/crud-page';

const emit = defineEmits<{ success: [] }>();
const formData = ref<FileGroup>();

interface GroupFormValues extends FileGroupWrite {
  file_ids?: Array<number | string>;
}

const schema: VbenFormSchema[] = [
  {
    component: 'Input',
    fieldName: 'group_code',
    label: '分组编码',
    rules: 'required',
  },
  {
    component: 'Input',
    fieldName: 'group_name',
    label: '分组名称',
    rules: 'required',
  },
  {
    component: 'InputNumber',
    componentProps: { class: 'w-full', min: 0 },
    fieldName: 'order_no',
    label: '排序',
  },
  {
    component: 'Select',
    componentProps: { class: 'w-full', mode: 'tags', options: [] },
    fieldName: 'file_ids',
    formItemClass: 'md:col-span-2',
    label: '文件 ID',
  },
];

const [Form, formApi] = useVbenForm({
  commonConfig: { colon: true, formItemClass: 'col-span-1' },
  schema,
  showDefaultActions: false,
  wrapperClass: 'grid-cols-1 md:grid-cols-2 gap-x-4',
});

const [Drawer, drawerApi] = useVbenDrawer<FileGroup>({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;
    drawerApi.lock();
    try {
      const { file_ids = [], ...group } =
        (await formApi.getValues()) as GroupFormValues;
      const saved = formData.value?.id
        ? await StorageGroupApi.update(formData.value.id, group)
        : await StorageGroupApi.create(group);
      await StorageGroupApi.replaceFiles(formData.value?.id ?? saved.id, {
        file_ids: toNumberArray(file_ids),
      });
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
    if (formData.value) {
      const files = await StorageGroupApi.files(formData.value.id);
      await formApi.setValues({
        ...formData.value,
        file_ids: files.map((file) => file.file_id),
      });
    }
  },
});

const drawerTitle = computed(() =>
  formData.value?.id ? '编辑文件分组' : '新建文件分组',
);
</script>

<template>
  <Drawer class="w-full max-w-160" :title="drawerTitle">
    <Alert
      class="mx-4 mb-3"
      message="文件 ID 支持多值录入；保存时会替换当前分组文件关系，不会删除文件本身。"
      show-icon
      type="info"
    />
    <Form class="mx-4" />
  </Drawer>
</template>
