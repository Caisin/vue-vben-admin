<script setup lang="ts">
import type {
  FilePickerAdapter,
  FilePickerExpose,
  SelectedStorageFile,
} from '#/components/file-picker/types';

import { ref, watch } from 'vue';

import { Button, message } from 'antdv-next';

import { OfficialSiteAssetsApi } from '#/api/official-site-assets';
import { siteResourceUrl } from '#/api/official-sites';
import { FilePicker } from '#/components/file-picker';
import { requestErrorMessage } from '#/request-errors';

const props = defineProps<{
  label: string;
  modelValue: string;
  defaultValue?: string;
  disabled?: boolean;
}>();
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();
const picker = ref<FilePickerExpose>();
const preview = ref('');
const previewError = ref('');
const adapter: FilePickerAdapter = {
  list: OfficialSiteAssetsApi.list,
  detail: OfficialSiteAssetsApi.detail,
  urls: OfficialSiteAssetsApi.urls,
  upload: OfficialSiteAssetsApi.upload,
  rename: OfficialSiteAssetsApi.rename,
  presignUpload: OfficialSiteAssetsApi.presignUpload,
  presignComplete: OfficialSiteAssetsApi.presignComplete,
  storageOptions: async () => {
    const storages = await OfficialSiteAssetsApi.storages();
    if (storages.length === 0) {
      message.error('未配置公共存储，请先在存储管理中添加公共存储');
      throw new Error('未配置公共存储');
    }
    return storages.map((storage) => ({
      value: storage.code,
      label: storage.storage_name,
      storage_type: storage.storage_type,
    }));
  },
};
let generation = 0;
watch(
  () => props.modelValue,
  async (value) => {
    const current = ++generation;
    preview.value = '';
    previewError.value = '';
    if (value.startsWith('builtin:')) {
      preview.value = siteResourceUrl(`/_official/template/${value.slice(8)}`);
      return;
    }
    if (value.startsWith('file:')) {
      try {
        const files = await OfficialSiteAssetsApi.urls([value.slice(5)]);
        if (current === generation) preview.value = files[0]?.url ?? '';
      } catch (error) {
        if (current === generation)
          previewError.value = requestErrorMessage(
            error,
            '图片暂时无法预览，请从公共存储重新选择',
          );
      }
    }
  },
  { immediate: true },
);
function selected(files: SelectedStorageFile[]) {
  const file = files[0];
  if (file) emit('update:modelValue', `file:${file.file_id}`);
}
</script>
<template>
  <div class="image-field">
    <span class="image-label">{{ label }}</span>
    <div class="image-preview">
      <img v-if="preview" :src="preview" :alt="label" /><span v-else>{{
        previewError || '请选择图片'
      }}</span>
    </div>
    <div v-if="!disabled" class="image-actions">
      <Button
        size="small"
        :aria-label="`选择或上传${label}`"
        @click="picker?.open()"
      >
        选择 / 上传
      </Button>
      <Button
        v-if="defaultValue"
        size="small"
        type="text"
        :aria-label="`恢复${label}参考图`"
        @click="emit('update:modelValue', defaultValue)"
      >
        参考图
      </Button>
    </div>
    <FilePicker
      v-if="!disabled"
      ref="picker"
      :adapter="adapter"
      accept="image/png,image/jpeg,image/webp,image/gif"
      :max_count="1"
      :initial_file_ids="
        modelValue.startsWith('file:') ? [modelValue.slice(5)] : []
      "
      @confirm="selected"
    />
  </div>
</template>
<style scoped>
.image-field {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.image-label {
  font-weight: 500;
}

.image-preview {
  display: grid;
  place-items: center;
  height: 132px;
  padding: 10px;
  font-size: 12px;
  color: var(--muted-foreground);
  background: var(--background);
  border: 1px dashed var(--border);
  border-radius: 10px;
}

.image-preview img {
  width: 100%;
  max-width: 100%;
  height: 110px;
  min-height: 0;
  object-fit: contain;
}

.image-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}
</style>
