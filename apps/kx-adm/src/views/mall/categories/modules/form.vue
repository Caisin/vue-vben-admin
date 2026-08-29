<script lang="ts" setup>
import type { VbenFormSchema } from '#/adapter/form';
import type { MallCategory, MallCategoryWrite } from '#/api/mall';
import type {
  FilePickerExpose,
  SelectedStorageFile,
} from '#/components/file-picker';

import { computed, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { Button, message } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import { MallAdminApi } from '#/api/mall';
import { FilePicker } from '#/components/file-picker';
import { wrapTreeWithRoot } from '#/tree-select';

import { buildCategoryTree, mallStatusSelectOptions } from '../../shared';

const emit = defineEmits<{ success: [] }>();
const formData = ref<MallCategory>();
const pickerRef = ref<FilePickerExpose>();
const publicStorageCode = ref<string>();

const schema: VbenFormSchema<MallCategoryWrite>[] = [
  {
    component: 'Input',
    fieldName: 'code',
    label: '类目编码',
    rules: 'required',
  },
  {
    component: 'Input',
    fieldName: 'name',
    label: '类目名称',
    rules: 'required',
  },
  {
    component: 'ApiTreeSelect',
    componentProps: () => ({
      api: MallAdminApi.categories,
      afterFetch: (items: MallCategory[]) =>
        wrapTreeWithRoot(buildCategoryTree(items), {
          code: 'root',
          id: 0,
          name: '根类目',
          parent_id: null,
          sort_order: 0,
          status: 'published',
          updated_at: 0,
        }),
      allowClear: true,
      class: 'w-full',
      childrenField: 'children',
      labelField: 'name',
      showSearch: true,
      treeDefaultExpandAll: true,
      valueField: 'id',
    }),
    fieldName: 'parent_id',
    help: '根类目用于用户端一级目录；不能把类目移动到自己或自己的子级下。',
    label: '上级类目',
  },
  {
    component: 'Select',
    componentProps: { class: 'w-full', options: mallStatusSelectOptions },
    defaultValue: 'draft',
    fieldName: 'status',
    help: '只有已发布类目会出现在用户端目录；商品发布时也要求所属类目已发布。',
    label: '状态',
    rules: 'selectRequired',
  },
  {
    component: 'InputNumber',
    componentProps: { class: 'w-full', min: 0 },
    defaultValue: 0,
    fieldName: 'sort_order',
    label: '排序',
    rules: 'required',
  },
  {
    component: 'InputNumber',
    componentProps: { class: 'w-full', min: 1 },
    fieldName: 'icon_file_id',
    help: '填写已绑定 mall/public 槽位的 Storage 文件 ID；不要粘贴临时签名 URL。',
    label: '图标文件 ID',
  },
];

const [Form, formApi] = useVbenForm<MallCategoryWrite>({
  commonConfig: { colon: true, formItemClass: 'col-span-1' },
  schema,
  showDefaultActions: false,
  wrapperClass: 'grid-cols-1 md:grid-cols-2 gap-x-4',
});

const [Drawer, drawerApi] = useVbenDrawer<Partial<MallCategory>>({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;
    drawerApi.lock();
    try {
      const values = await formApi.getValues();
      const payload: MallCategoryWrite = {
        code: values.code,
        icon_file_id: values.icon_file_id || null,
        name: values.name,
        parent_id: values.parent_id || null,
        sort_order: values.sort_order ?? 0,
        status: values.status ?? 'draft',
      };
      await (formData.value?.id
        ? MallAdminApi.updateCategory(formData.value.id, payload)
        : MallAdminApi.createCategory(payload));
      message.success('保存成功');
      drawerApi.close();
      emit('success');
    } finally {
      drawerApi.unlock();
    }
  },
  async onOpenChange(isOpen) {
    if (!isOpen) return;
    const settings = await MallAdminApi.settings();
    publicStorageCode.value = settings.public_storage_code ?? undefined;
    const data = drawerApi.getData();
    formData.value = data?.id ? (data as MallCategory) : undefined;
    await formApi.reset();
    await formApi.setValues({
      ...data,
      parent_id: data?.parent_id ?? 0,
      status: data?.status ?? 'draft',
    });
  },
});

const drawerTitle = computed(() =>
  formData.value?.id ? '编辑商城类目' : '新建商城类目',
);

function openPicker() {
  if (!publicStorageCode.value) {
    message.warning('请先在商城设置中配置商品公开 Storage');
    return;
  }
  pickerRef.value?.open();
}

async function onFileSelected(files: SelectedStorageFile[]) {
  await formApi.setFieldValue('icon_file_id', files[0]?.file_id);
}
</script>

<template>
  <Drawer class="w-full max-w-160" :title="drawerTitle">
    <FilePicker
      ref="pickerRef"
      accept="image/*"
      :storage_code="publicStorageCode"
      @confirm="onFileSelected"
    />
    <Button class="mx-4 mb-4" @click="openPicker">选择类目图标</Button>
    <Form class="mx-4" />
  </Drawer>
</template>
