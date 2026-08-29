<script lang="ts" setup>
import type { MallSettings } from '#/api/mall';
import type { StorageConfigView } from '#/api/storage/config';

import { computed, onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  Alert,
  Button,
  Card,
  Descriptions,
  DescriptionsItem,
  message,
  Select,
  Spin,
} from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import { MallAdminApi } from '#/api/mall';
import { StorageConfigApi } from '#/api/storage/config';

import { useSettingsSchema } from './data';

const loading = ref(false);
const saving = ref(false);
const settings = ref<MallSettings>();
const publicStorageCode = ref<string>();
const storageConfigs = ref<StorageConfigView[]>([]);
const publicStorageOptions = computed(() =>
  storageConfigs.value
    .filter((item) => item.is_public)
    .map((item) => ({
      label: `${item.storage_name} (${item.code})`,
      value: item.code,
    })),
);

const [Form, formApi] = useVbenForm<MallSettings>({
  commonConfig: { colon: true, formItemClass: 'col-span-1' },
  schema: useSettingsSchema(),
  showDefaultActions: false,
  wrapperClass: 'grid-cols-1 md:grid-cols-2 gap-x-4',
});

async function loadSettings() {
  loading.value = true;
  try {
    const [nextSettings, configs] = await Promise.all([
      MallAdminApi.settings(),
      StorageConfigApi.list({ is_public: true, page: 1, size: 100 }),
    ]);
    settings.value = nextSettings;
    publicStorageCode.value = nextSettings.public_storage_code ?? undefined;
    storageConfigs.value = configs.items;
    await formApi.reset();
    await formApi.setValues(settings.value);
  } finally {
    loading.value = false;
  }
}

async function saveSettings() {
  const { valid } = await formApi.validate();
  if (!valid || !settings.value) return;
  saving.value = true;
  try {
    const values = await formApi.getValues();
    settings.value = await MallAdminApi.updateSettings({
      after_sale_days: values.after_sale_days,
      auto_complete_days: values.auto_complete_days,
      enabled: values.enabled,
      expected_version: settings.value.version,
      low_stock_threshold: values.low_stock_threshold,
      mall_name: values.mall_name,
      notice: values.notice ?? '',
      pickup_token_minutes: values.pickup_token_minutes,
      public_storage_code: publicStorageCode.value ?? '',
    });
    await formApi.setValues(settings.value);
    message.success('商城设置已保存');
  } finally {
    saving.value = false;
  }
}

onMounted(loadSettings);
</script>

<template>
  <Page
    auto-content-height
    class="management-page"
    content-class="management-content"
    title="商城设置"
  >
    <Spin :spinning="loading">
      <div class="grid gap-3">
        <Alert
          show-icon
          type="info"
          message="商城设置使用版本号防止多人覆盖；保存失败时请刷新后重新确认最新配置。"
        />
        <Card class="section-card" size="small" title="当前版本">
          <Descriptions bordered :column="2" size="small">
            <DescriptionsItem label="版本">
              {{ settings?.version ?? '-' }}
            </DescriptionsItem>
            <DescriptionsItem label="状态">
              {{ settings?.enabled ? '启用' : '停用' }}
            </DescriptionsItem>
          </Descriptions>
        </Card>
        <Card class="section-card" size="small" title="运营参数">
          <div class="mb-4 grid gap-2">
            <span class="text-sm font-medium">商品公开 Storage</span>
            <Select
              v-model:value="publicStorageCode"
              class="w-full"
              :options="publicStorageOptions"
              placeholder="选择 is_public=true 的 Storage"
            />
          </div>
          <Form class="mx-1" />
          <div class="mt-4 flex justify-end gap-2">
            <Button @click="loadSettings">刷新</Button>
            <Button
              v-access:code="'mall:settings:write'"
              type="primary"
              :loading="saving"
              @click="saveSettings"
            >
              保存设置
            </Button>
          </div>
        </Card>
      </div>
    </Spin>
  </Page>
</template>
