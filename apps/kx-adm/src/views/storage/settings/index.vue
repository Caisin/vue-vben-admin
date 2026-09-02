<script lang="ts" setup>
import type { StorageConfigView } from '#/api/storage/config';

import { computed, onMounted, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import { Button, Form, FormItem, message, Select } from 'antdv-next';

import { StorageConfigApi } from '#/api/storage/config';

const loading = ref(false);
const saving = ref(false);
const stores = ref<StorageConfigView[]>([]);
const form = reactive({
  developer_account_private: '',
  file_share_upload: '',
  import_export_private: '',
});

const allOptions = computed(() =>
  stores.value.map((item) => storageOption(item)),
);
const privateOptions = computed(() =>
  stores.value
    .filter((item) => !item.is_public)
    .map((item) => storageOption(item)),
);

function storageOption(item: StorageConfigView) {
  return {
    label: `${item.storage_name} (${item.code})`,
    value: item.code,
  };
}

async function load() {
  loading.value = true;
  try {
    const [configs, defaults] = await Promise.all([
      StorageConfigApi.list({ page: 1, size: 200 }),
      StorageConfigApi.businessDefaults(),
    ]);
    stores.value = configs.items;
    Object.assign(form, {
      developer_account_private: defaults.developer_account_private.code,
      file_share_upload: defaults.file_share_upload.code,
      import_export_private: defaults.import_export_private.code,
    });
  } finally {
    loading.value = false;
  }
}

async function save() {
  if (
    !form.import_export_private ||
    !form.developer_account_private ||
    !form.file_share_upload
  ) {
    message.warning('请完成所有默认存储设置');
    return;
  }
  saving.value = true;
  try {
    await StorageConfigApi.setBusinessDefaults({ ...form });
    message.success('默认存储设置已保存');
    await load();
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<template>
  <Page auto-content-height title="默认存储设置">
    <Form class="max-w-2xl" layout="vertical">
      <FormItem label="公共导入导出文件" required>
        <Select
          v-model:value="form.import_export_private"
          :loading="loading"
          :options="privateOptions"
          placeholder="选择私有 Storage"
          show-search
        />
      </FormItem>
      <FormItem label="开发者账户资料" required>
        <Select
          v-model:value="form.developer_account_private"
          :loading="loading"
          :options="privateOptions"
          placeholder="选择私有 Storage"
          show-search
        />
      </FormItem>
      <FormItem label="文件分享上传" required>
        <Select
          v-model:value="form.file_share_upload"
          :loading="loading"
          :options="allOptions"
          placeholder="选择 Storage"
          show-search
        />
      </FormItem>
      <Button :loading="saving" type="primary" @click="save">
        <IconifyIcon class="size-4" icon="lucide:save" />保存
      </Button>
    </Form>
  </Page>
</template>
