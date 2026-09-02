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
  article_private: '',
  article_public: '',
  developer_account_private: '',
  file_share_upload: '',
  import_export_private: '',
  invoice_private: '',
  mall_private: '',
  mall_public: '',
  wmxt_private: '',
  wmxt_public: '',
});

const allOptions = computed(() =>
  stores.value.map((item) => storageOption(item)),
);
const privateOptions = computed(() =>
  stores.value
    .filter((item) => !item.is_public)
    .map((item) => storageOption(item)),
);
const publicOptions = computed(() =>
  stores.value
    .filter((item) => item.is_public)
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
      article_private: defaults.article_private?.code ?? '',
      article_public: defaults.article_public?.code ?? '',
      developer_account_private: defaults.developer_account_private.code,
      file_share_upload: defaults.file_share_upload.code,
      import_export_private: defaults.import_export_private.code,
      invoice_private: defaults.invoice_private?.code ?? '',
      mall_private: defaults.mall_private?.code ?? '',
      mall_public: defaults.mall_public?.code ?? '',
      wmxt_private: defaults.wmxt_private?.code ?? '',
      wmxt_public: defaults.wmxt_public?.code ?? '',
    });
  } finally {
    loading.value = false;
  }
}

async function save() {
  if (
    !form.import_export_private ||
    !form.invoice_private ||
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
    <Form class="max-w-6xl" layout="vertical">
      <section>
        <h2 class="mb-3 text-base font-semibold">通用业务</h2>
        <div class="grid grid-cols-1 gap-x-4 md:grid-cols-2 xl:grid-cols-3">
          <FormItem label="公共导入导出文件" required>
            <Select
              v-model:value="form.import_export_private"
              :loading="loading"
              :options="privateOptions"
              placeholder="选择私有 Storage"
              show-search
            />
          </FormItem>
          <FormItem label="发票文件" required>
            <Select
              v-model:value="form.invoice_private"
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
        </div>
      </section>

      <section class="mt-2">
        <h2 class="mb-3 text-base font-semibold">业务模块</h2>
        <div class="grid grid-cols-1 gap-x-4 md:grid-cols-2 xl:grid-cols-3">
          <FormItem label="文章公开文件">
            <Select
              v-model:value="form.article_public"
              :loading="loading"
              :options="publicOptions"
              placeholder="选择公开 Storage"
              show-search
            />
          </FormItem>
          <FormItem label="文章私有文件">
            <Select
              v-model:value="form.article_private"
              :loading="loading"
              :options="privateOptions"
              placeholder="选择私有 Storage"
              show-search
            />
          </FormItem>
          <FormItem label="商城公开文件">
            <Select
              v-model:value="form.mall_public"
              :loading="loading"
              :options="publicOptions"
              placeholder="选择公开 Storage"
              show-search
            />
          </FormItem>
          <FormItem label="商城私有文件">
            <Select
              v-model:value="form.mall_private"
              :loading="loading"
              :options="privateOptions"
              placeholder="选择私有 Storage"
              show-search
            />
          </FormItem>
          <FormItem label="WMXT 公开文件">
            <Select
              v-model:value="form.wmxt_public"
              :loading="loading"
              :options="publicOptions"
              placeholder="选择公开 Storage"
              show-search
            />
          </FormItem>
          <FormItem label="WMXT 私有文件">
            <Select
              v-model:value="form.wmxt_private"
              :loading="loading"
              :options="privateOptions"
              placeholder="选择私有 Storage"
              show-search
            />
          </FormItem>
        </div>
      </section>
      <Button :loading="saving" type="primary" @click="save">
        <IconifyIcon class="size-4" icon="lucide:save" />保存
      </Button>
    </Form>
  </Page>
</template>
