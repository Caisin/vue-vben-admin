<script setup lang="ts">
import type { StorageConfigView } from '#/api/storage/config';

import { computed, onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import { Button, message, Select, Space } from 'antdv-next';

import { ArticleApi } from '#/api/article';
import { StorageConfigApi } from '#/api/storage/config';

const loading = ref(false);
const storages = ref<StorageConfigView[]>([]);
const public_storage_code = ref<string>();
const private_storage_code = ref<string>();

const publicOptions = computed(() =>
  storages.value
    .filter((item) => item.is_public)
    .map((item) => ({
      label: `${item.storage_name} (${item.code})`,
      value: item.code,
    })),
);
const privateOptions = computed(() =>
  storages.value
    .filter((item) => !item.is_public)
    .map((item) => ({
      label: `${item.storage_name} (${item.code})`,
      value: item.code,
    })),
);

async function load() {
  loading.value = true;
  try {
    const [settings, configs] = await Promise.all([
      ArticleApi.storageSettings(),
      StorageConfigApi.list({ page: 1, size: 100 }),
    ]);
    public_storage_code.value = settings.public_storage_code;
    private_storage_code.value = settings.private_storage_code;
    storages.value = configs.items;
  } finally {
    loading.value = false;
  }
}

async function save() {
  if (!public_storage_code.value || !private_storage_code.value) {
    message.warning('请选择公开桶和私有桶');
    return;
  }
  if (public_storage_code.value === private_storage_code.value) {
    message.warning('公开桶和私有桶不能相同');
    return;
  }
  loading.value = true;
  try {
    await ArticleApi.saveStorageSettings({
      private_storage_code: private_storage_code.value,
      public_storage_code: public_storage_code.value,
    });
    message.success('Article Storage 设置已保存');
    await load();
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <Page
    auto-content-height
    class="management-page"
    content-class="management-content"
  >
    <header class="page-heading"><h1>发布设置</h1></header>
    <section class="section-card grid max-w-3xl gap-4">
      <div class="grid gap-2">
        <span class="text-sm font-medium">公开 Storage</span>
        <Select
          v-model:value="public_storage_code"
          class="w-full"
          :options="publicOptions"
          placeholder="选择 is_public=true 的 Storage"
        />
      </div>
      <div class="grid gap-2">
        <span class="text-sm font-medium">私有 Storage</span>
        <Select
          v-model:value="private_storage_code"
          class="w-full"
          :options="privateOptions"
          placeholder="选择 is_public=false 的 Storage"
        />
      </div>
      <Space>
        <Button :loading="loading" type="primary" @click="save">
          保存设置
        </Button>
        <Button :loading="loading" @click="load">重新加载</Button>
      </Space>
    </section>
  </Page>
</template>
