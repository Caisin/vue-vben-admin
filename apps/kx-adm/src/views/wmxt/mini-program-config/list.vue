<script lang="ts" setup>
import type { StorageConfigView } from '#/api/storage/config';

import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';
import { Check, ExternalLink, RotateCw } from '@vben/icons';

import {
  Alert,
  Button,
  InputNumber,
  message,
  Select,
  Space,
  Tag,
} from 'antdv-next';

import { StorageConfigApi } from '#/api/storage/config';
import { WmxtAppearanceSettingsApi, WmxtStorageSettingsApi } from '#/api/wmxt';
import { FileUrlInput } from '#/components/file-picker';

import { configLinks } from './data';

const router = useRouter();
const loading = ref(false);
const saving = ref(false);
const ready = ref(false);
const publicStorages = ref<StorageConfigView[]>([]);
const privateStorages = ref<StorageConfigView[]>([]);
const public_storage_code = ref<string>();
const private_storage_code = ref<string>();
const appearanceSaving = ref(false);
const home_background_file_id = ref<number | string>('');
const home_background_url = ref('');
const home_header_height = ref(520);
const profile_background_file_id = ref<number | string>('');
const profile_background_url = ref('');
const profile_header_height = ref(240);

const publicOptions = computed(() => buildStorageOptions(publicStorages.value));
const privateOptions = computed(() =>
  buildStorageOptions(privateStorages.value),
);

function buildStorageOptions(items: StorageConfigView[]) {
  return items.map((item) => ({
    label: `${item.storage_name} (${item.code})`,
    value: item.code,
  }));
}

function normalizeSelectedCodes() {
  const publicCodes = new Set(publicStorages.value.map((item) => item.code));
  const privateCodes = new Set(privateStorages.value.map((item) => item.code));
  if (
    public_storage_code.value &&
    !publicCodes.has(public_storage_code.value)
  ) {
    public_storage_code.value = undefined;
  }
  if (
    private_storage_code.value &&
    !privateCodes.has(private_storage_code.value)
  ) {
    private_storage_code.value = undefined;
  }
}

async function load() {
  loading.value = true;
  try {
    const [settings, appearance, publicConfigs, privateConfigs] =
      await Promise.all([
        WmxtStorageSettingsApi.detail(),
        WmxtAppearanceSettingsApi.detail(),
        StorageConfigApi.list({ is_public: true, page: 1, size: 100 }),
        StorageConfigApi.list({ is_public: false, page: 1, size: 100 }),
      ]);
    home_background_file_id.value = appearance.home_background_file_id || '';
    home_background_url.value = appearance.home_background_url;
    home_header_height.value = appearance.home_header_height;
    profile_background_file_id.value =
      appearance.profile_background_file_id || '';
    profile_background_url.value = appearance.profile_background_url;
    profile_header_height.value = appearance.profile_header_height;
    public_storage_code.value = settings.public_storage_code;
    private_storage_code.value = settings.private_storage_code;
    ready.value = settings.ready;
    publicStorages.value = publicConfigs.items.filter((item) => item.is_public);
    privateStorages.value = privateConfigs.items.filter(
      (item) => !item.is_public,
    );
    normalizeSelectedCodes();
    ready.value =
      settings.ready &&
      Boolean(public_storage_code.value && private_storage_code.value);
  } finally {
    loading.value = false;
  }
}

async function saveAppearance() {
  const homeFileId = parseAppearanceFileId(
    home_background_file_id.value,
    '首页背景图',
  );
  const profileFileId = parseAppearanceFileId(
    profile_background_file_id.value,
    '用户中心背景图',
  );
  if (homeFileId === undefined || profileFileId === undefined) return;

  appearanceSaving.value = true;
  try {
    const appearance = await WmxtAppearanceSettingsApi.update({
      home_background_file_id: homeFileId,
      home_header_height: Number(home_header_height.value),
      profile_background_file_id: profileFileId,
      profile_header_height: Number(profile_header_height.value),
    });
    home_background_url.value = appearance.home_background_url;
    profile_background_url.value = appearance.profile_background_url;
    message.success('小程序外观已保存');
  } finally {
    appearanceSaving.value = false;
  }
}

function parseAppearanceFileId(
  value: number | string,
  label: string,
): number | undefined {
  if (value === '') return 0;
  const fileId = typeof value === 'number' ? value : Number(value.trim());
  if (!Number.isSafeInteger(fileId) || fileId <= 0) {
    message.warning(`${label}只能从文件库选择，或清空后使用默认图`);
    return undefined;
  }
  return fileId;
}

async function save() {
  if (!public_storage_code.value || !private_storage_code.value) {
    message.warning('请选择公开 Storage 和私有 Storage');
    return;
  }
  if (public_storage_code.value === private_storage_code.value) {
    message.warning('公开 Storage 和私有 Storage 不能相同');
    return;
  }
  saving.value = true;
  try {
    const settings = await WmxtStorageSettingsApi.update({
      private_storage_code: private_storage_code.value,
      public_storage_code: public_storage_code.value,
    });
    ready.value = settings.ready;
    public_storage_code.value = settings.public_storage_code;
    private_storage_code.value = settings.private_storage_code;
    message.success('小程序 Storage 设置已保存');
  } finally {
    saving.value = false;
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
    <header class="page-heading"><h1>小程序配置</h1></header>
    <div
      class="mini-program-config mx-auto flex w-full max-w-5xl flex-col gap-6"
    >
      <section class="border-b pb-6">
        <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <h3 class="m-0 text-base font-medium">文件上传 Storage</h3>
            <Tag :color="ready ? 'success' : 'warning'">
              {{ ready ? '已配置' : '未就绪' }}
            </Tag>
          </div>
          <Space>
            <Button :loading="loading" @click="load">
              <RotateCw class="size-4" />
              重新加载
            </Button>
            <Button
              v-access:code="'wmxt:storage-settings:write'"
              :loading="saving"
              type="primary"
              @click="save"
            >
              <Check class="size-4" />
              保存设置
            </Button>
          </Space>
        </div>

        <Alert
          v-if="!ready"
          class="mb-4"
          message="公开和私有 Storage 都配置后，小程序上传才会生效。"
          show-icon
          type="warning"
        />

        <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div class="grid gap-2">
            <span class="text-sm font-medium">公开 Storage</span>
            <Select
              v-model:value="public_storage_code"
              allow-clear
              class="w-full"
              :disabled="loading || saving"
              :loading="loading"
              :options="publicOptions"
              placeholder="仅可选择 is_public=true 的 Storage"
              show-search
            />
          </div>
          <div class="grid gap-2">
            <span class="text-sm font-medium">私有 Storage</span>
            <Select
              v-model:value="private_storage_code"
              allow-clear
              class="w-full"
              :disabled="loading || saving"
              :loading="loading"
              :options="privateOptions"
              placeholder="仅可选择 is_public=false 的 Storage"
              show-search
            />
          </div>
        </div>
      </section>

      <section class="border-b pb-6">
        <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 class="m-0 text-base font-medium">首页与用户中心外观</h3>
          <Button
            v-access:code="'wmxt:appearance-settings:write'"
            :loading="appearanceSaving"
            type="primary"
            @click="saveAppearance"
          >
            <Check class="size-4" />
            保存外观
          </Button>
        </div>
        <div class="appearance-grid">
          <div class="appearance-editor">
            <span class="text-sm font-medium">首页背景图</span>
            <FileUrlInput
              v-model="home_background_file_id"
              accept="image/*"
              button-text="选择首页背景"
              placeholder="清空后使用内置默认图"
            />
            <span class="text-sm font-medium">首页背景高度（rpx）</span>
            <InputNumber
              v-model:value="home_header_height"
              class="w-full"
              :min="240"
              :max="900"
            />
            <div
              class="appearance-preview"
              :style="{
                height: `${Math.min(home_header_height, 520) / 2}px`,
                backgroundImage: `url(${home_background_url})`,
              }"
            ></div>
          </div>
          <div class="appearance-editor">
            <span class="text-sm font-medium">用户中心背景图</span>
            <FileUrlInput
              v-model="profile_background_file_id"
              accept="image/*"
              button-text="选择用户中心背景"
              placeholder="清空后使用内置默认图"
            />
            <span class="text-sm font-medium">用户中心背景高度（rpx）</span>
            <InputNumber
              v-model:value="profile_header_height"
              class="w-full"
              :min="240"
              :max="900"
            />
            <div
              class="appearance-preview"
              :style="{
                height: `${Math.min(profile_header_height, 520) / 2}px`,
                backgroundImage: `url(${profile_background_url})`,
              }"
            ></div>
          </div>
        </div>
      </section>

      <section>
        <h3 class="mb-3 mt-0 text-base font-medium">相关配置入口</h3>
        <div class="grid grid-cols-1 gap-3 xl:grid-cols-2">
          <div
            v-for="item in configLinks"
            :key="item.path"
            class="flex items-center justify-between gap-3 border-b px-1 py-2"
          >
            <div class="min-w-0 truncate text-sm font-medium">
              {{ item.title }}
            </div>
            <Button size="small" type="link" @click="router.push(item.path)">
              <ExternalLink class="size-4" />
              打开
            </Button>
          </div>
        </div>
      </section>
    </div>
  </Page>
</template>

<style scoped>
.appearance-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
}

.appearance-editor {
  display: grid;
  gap: 10px;
  min-width: 0;
}

.appearance-preview {
  min-height: 120px;
  background-repeat: no-repeat;
  background-position: center;
  background-size: cover;
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

@media (max-width: 900px) {
  .appearance-grid {
    grid-template-columns: 1fr;
  }
}
</style>
