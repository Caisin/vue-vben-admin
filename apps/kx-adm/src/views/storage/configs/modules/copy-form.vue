<script lang="ts" setup>
import type { VbenFormSchema } from '#/adapter/form';
import type {
  StorageConfigCopyWrite,
  StorageConfigView,
} from '#/api/storage/config';

import { ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { Alert, message } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import { StorageConfigApi } from '#/api/storage/config';

const emit = defineEmits<{ success: [] }>();
const source = ref<StorageConfigView>();

function isObjectStorage() {
  return ['ali', 'cos', 's3', 'tos'].includes(source.value?.storage_type ?? '');
}

function requiresRoot() {
  return ['fs', 'local', 'sftp'].includes(source.value?.storage_type ?? '');
}

function requiresEndpoint() {
  return ['s3', 'sftp'].includes(source.value?.storage_type ?? '');
}

const schema: VbenFormSchema[] = [
  {
    component: 'Input',
    fieldName: 'code',
    label: '新配置编码',
    rules: 'required',
  },
  {
    component: 'Input',
    fieldName: 'storage_name',
    label: '新配置名称',
    rules: 'required',
  },
  {
    component: 'Input',
    dependencies: { show: requiresRoot, triggerFields: [] },
    fieldName: 'root',
    formItemClass: 'md:col-span-2',
    label: '根目录',
  },
  {
    component: 'Input',
    fieldName: 'upload_dir',
    formItemClass: 'md:col-span-2',
    help: '复制后可改为不同的目录前缀；认证信息仍复用源配置引用。',
    label: '上传目录',
  },
  {
    component: 'Input',
    dependencies: { show: requiresEndpoint, triggerFields: [] },
    fieldName: 'endpoint',
    formItemClass: 'md:col-span-2',
    label: 'Endpoint',
  },
  {
    component: 'Input',
    dependencies: { show: isObjectStorage, triggerFields: [] },
    fieldName: 'bucket',
    label: 'Bucket',
  },
  {
    component: 'Input',
    dependencies: { show: isObjectStorage, triggerFields: [] },
    fieldName: 'region',
    label: 'Region',
  },
  {
    component: 'Input',
    fieldName: 'cdn_domain',
    formItemClass: 'md:col-span-2',
    label: 'CDN 域名',
  },
  {
    component: 'Switch',
    fieldName: 'is_public',
    label: '公开访问',
  },
  {
    component: 'InputNumber',
    componentProps: { class: 'w-full', min: 0 },
    fieldName: 'order_no',
    label: '排序',
  },
];

const [Form, formApi] = useVbenForm({
  commonConfig: { colon: true, formItemClass: 'col-span-1' },
  layout: 'vertical',
  schema,
  showDefaultActions: false,
  wrapperClass: 'grid-cols-1 md:grid-cols-2 gap-x-4',
});

const [Drawer, drawerApi] = useVbenDrawer<StorageConfigView>({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid || !source.value) return;
    drawerApi.lock();
    try {
      const values = (await formApi.getValues()) as StorageConfigCopyWrite;
      await StorageConfigApi.copy(source.value.code, values);
      message.success('存储配置已复制');
      drawerApi.close();
      emit('success');
    } finally {
      drawerApi.unlock();
    }
  },
  async onOpenChange(isOpen) {
    if (!isOpen) return;
    source.value = drawerApi.getData();
    await formApi.reset();
    if (source.value) {
      await formApi.setValues({
        ...source.value,
        code: `${source.value.code}-copy`,
        storage_name: `${source.value.storage_name} 副本`,
      });
    }
  },
});
</script>

<template>
  <Drawer class="w-full max-w-160" title="复制存储配置">
    <Alert
      class="mx-4 mb-3"
      message="复制会复用源配置的凭证引用，但不会复制或展示任何凭证明文；保存前请调整目录、Endpoint 或 Bucket，避免与源配置写入同一路径。"
      show-icon
      type="warning"
    />
    <Form class="mx-4" />
  </Drawer>
</template>
