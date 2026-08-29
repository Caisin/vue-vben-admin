<script lang="ts" setup>
import type { VbenFormSchema } from '#/adapter/form';
import type { MallProduct, MallProductWrite } from '#/api/mall';
import type { JsonValue } from '#/api/request';
import type {
  FilePickerExpose,
  SelectedStorageFile,
} from '#/components/file-picker';

import { computed, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { Button, message, Space } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import { MallAdminApi } from '#/api/mall';
import { FilePicker } from '#/components/file-picker';
import {
  formatJsonEditorValue,
  parseJsonEditorValue,
  toNumberArray,
} from '#/views/_shared/crud-page';

import { buildCategoryTree } from '../../shared';

interface ProductFormValues extends Omit<
  MallProductWrite,
  'detail_json' | 'gallery_file_ids'
> {
  detail_json: string;
  gallery_file_ids: string;
}

const emit = defineEmits<{ success: [] }>();
const formData = ref<MallProduct>();
const pickerRef = ref<FilePickerExpose>();
const pickingKind = ref<'cover' | 'gallery'>('cover');
const publicStorageCode = ref<string>();

function encode(values: ProductFormValues): MallProductWrite {
  return {
    category_id: values.category_id,
    code: values.code,
    cover_file_id: values.cover_file_id || null,
    detail_json: parseJsonEditorValue(values.detail_json) as JsonValue,
    featured: values.featured ?? false,
    gallery_file_ids: toNumberArray(
      String(values.gallery_file_ids ?? '')
        .split(',')
        .map((item) => item.trim()),
    ),
    name: values.name,
    subtitle: values.subtitle ?? '',
  };
}

const schema: VbenFormSchema<ProductFormValues>[] = [
  {
    component: 'Input',
    fieldName: 'code',
    label: '商品编码',
    rules: 'required',
  },
  {
    component: 'Input',
    fieldName: 'name',
    label: '商品名称',
    rules: 'required',
  },
  {
    component: 'ApiTreeSelect',
    componentProps: {
      api: MallAdminApi.categories,
      afterFetch: buildCategoryTree,
      class: 'w-full',
      labelField: 'name',
      parentField: 'parent_id',
      rowField: 'id',
      showSearch: true,
      treeDefaultExpandAll: true,
      valueField: 'id',
    },
    fieldName: 'category_id',
    help: '草稿可选择未发布类目；商品发布时所属类目必须已发布。',
    label: '商品类目',
    rules: 'selectRequired',
  },
  {
    component: 'Switch',
    defaultValue: false,
    fieldName: 'featured',
    label: '推荐',
  },
  {
    component: 'InputNumber',
    componentProps: { class: 'w-full', min: 1 },
    fieldName: 'cover_file_id',
    help: '填写 mall/public Storage 文件 ID；数据库不保存临时访问 URL。',
    label: '封面文件 ID',
  },
  {
    component: 'Input',
    fieldName: 'gallery_file_ids',
    help: '多个 mall/public 文件 ID 用英文逗号分隔，会按填写顺序展示。',
    label: '图库文件 ID',
  },
  {
    component: 'Textarea',
    componentProps: { autoSize: { maxRows: 5, minRows: 2 } },
    fieldName: 'subtitle',
    formItemClass: 'md:col-span-2',
    label: '副标题',
  },
  {
    component: 'JsonEditor',
    componentProps: {
      maxHeight: '460px',
      minHeight: '240px',
      valueMode: 'text',
    },
    defaultValue: '{}',
    fieldName: 'detail_json',
    formItemClass: 'col-span-full',
    help: '商品详情动态 JSON；未知字段会原样提交，JSON 格式错误会阻止保存。',
    label: '详情 JSON',
    rules: 'required',
  },
];

const [Form, formApi] = useVbenForm<ProductFormValues>({
  commonConfig: { colon: true, formItemClass: 'col-span-1' },
  schema,
  showDefaultActions: false,
  wrapperClass: 'grid-cols-1 md:grid-cols-2 gap-x-4',
});

const [Drawer, drawerApi] = useVbenDrawer<MallProduct>({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;
    drawerApi.lock();
    try {
      const values = encode(await formApi.getValues());
      await (formData.value?.id
        ? MallAdminApi.updateProduct(formData.value.id, values)
        : MallAdminApi.createProduct(values));
      message.success('保存成功');
      drawerApi.close();
      emit('success');
    } catch (error) {
      if (error instanceof SyntaxError) {
        message.error('详情 JSON 格式不正确');
        return;
      }
      throw error;
    } finally {
      drawerApi.unlock();
    }
  },
  async onOpenChange(isOpen) {
    if (!isOpen) return;
    const settings = await MallAdminApi.settings();
    publicStorageCode.value = settings.public_storage_code ?? undefined;
    const data = drawerApi.getData();
    formData.value = data?.id ? data : undefined;
    await formApi.reset();
    if (formData.value) {
      const detail = await MallAdminApi.product(formData.value.id);
      formData.value = detail.product;
      await formApi.setValues({
        ...detail.product,
        detail_json: formatJsonEditorValue(detail.product.detail_json ?? {}),
        gallery_file_ids: (detail.product.gallery_file_ids ?? []).join(','),
      });
    } else {
      await formApi.setValues({
        detail_json: '{}',
        featured: false,
        subtitle: '',
      });
    }
  },
});

const drawerTitle = computed(() =>
  formData.value?.id ? '编辑商品' : '新建商品',
);

function openPicker(kind: 'cover' | 'gallery') {
  if (!publicStorageCode.value) {
    message.warning('请先在商城设置中配置商品公开 Storage');
    return;
  }
  pickingKind.value = kind;
  pickerRef.value?.open();
}

async function onFilesSelected(files: SelectedStorageFile[]) {
  if (pickingKind.value === 'cover') {
    const [file] = files;
    await formApi.setFieldValue('cover_file_id', file?.file_id);
    return;
  }
  await formApi.setFieldValue(
    'gallery_file_ids',
    files.map((file) => file.file_id).join(','),
  );
}
</script>

<template>
  <Drawer class="w-full max-w-220" :title="drawerTitle">
    <FilePicker
      ref="pickerRef"
      accept="image/*"
      :multiple="pickingKind === 'gallery'"
      :storage_code="publicStorageCode"
      @confirm="onFilesSelected"
    />
    <Space class="mx-4 mb-4">
      <Button @click="openPicker('cover')">选择封面</Button>
      <Button @click="openPicker('gallery')">选择图库</Button>
    </Space>
    <Form class="mx-4" />
  </Drawer>
</template>
