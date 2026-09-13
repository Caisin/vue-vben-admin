<script setup lang="ts">
import type {
  FilePickerAdapter,
  FilePickerExpose,
  SelectedStorageFile,
} from '#/components/file-picker/types';

import { ref, watch } from 'vue';

import { Button } from 'antdv-next';

import { siteResourceUrl } from '#/api/official-sites';
import { StorageFileShareApi } from '#/api/storage';
import { FilePicker } from '#/components/file-picker';

const props = defineProps<{
  label: string;
  modelValue: string;
  defaultValue?: string;
  disabled?: boolean;
}>();
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();
const picker = ref<FilePickerExpose>();
const preview = ref('');
const error = ref('');
const adapter: FilePickerAdapter = {
  list: StorageFileShareApi.pickerFiles,
  detail: StorageFileShareApi.pickerFile,
  urls: StorageFileShareApi.pickerUrls,
  upload: StorageFileShareApi.pickerUpload,
  rename: StorageFileShareApi.pickerRename,
  presignUpload: StorageFileShareApi.pickerPresignUpload,
  presignComplete: StorageFileShareApi.pickerPresignComplete,
  storageOptions: async () => {
    const storage = await StorageFileShareApi.pickerStorage();
    return [
      {
        value: storage.code,
        label: storage.storage_name,
        storage_type: storage.storage_type,
      },
    ];
  },
};
let generation = 0;
watch(
  () => props.modelValue,
  async (value) => {
    const current = ++generation;
    preview.value = '';
    error.value = '';
    if (value.startsWith('builtin:')) {
      preview.value = siteResourceUrl(`/_official/template/${value.slice(8)}`);
      return;
    }
    if (value.startsWith('file:')) {
      try {
        const files = await StorageFileShareApi.pickerUrls([value.slice(5)]);
        if (current === generation) preview.value = files[0]?.url ?? '';
      } catch {
        if (current === generation)
          error.value = '图片暂时无法预览，请重新选择';
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
        error || '请选择图片'
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
