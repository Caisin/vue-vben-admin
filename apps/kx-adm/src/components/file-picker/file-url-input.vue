<script setup lang="ts">
import type { FileInputValue, StorageFileReference } from './file-ref';
import type {
  FilePickerExpose,
  FilePickerProps,
  SelectedStorageFile,
} from './types';

import { computed, ref } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { Button, Input, Space } from 'antdv-next';

import FilePicker from './file-picker.vue';
import { normalizeFileId, toFileReference } from './file-ref';
import FileRefPreview from './file-ref-preview.vue';

interface Props extends Omit<FilePickerProps, 'multiple'> {
  buttonText?: string;
  modelValue?: FileInputValue;
  placeholder?: string;
  valueMode?: 'id' | 'ref' | 'url';
}

const props = withDefaults(defineProps<Props>(), {
  buttonText: '选择文件',
  initial_file_ids: () => [],
  modelValue: '',
  placeholder: '可填写外部 URL，或从文件库选择/上传（文件库仅保存文件 ID）',
  valueMode: 'id',
});

const emit = defineEmits<{
  'update:modelValue': [value: FileInputValue];
}>();

const pickerRef = ref<FilePickerExpose>();

const inputValue = computed({
  get: () =>
    typeof props.modelValue === 'object'
      ? String(props.modelValue.file_id)
      : String(props.modelValue ?? ''),
  set: (value: string) => emit('update:modelValue', value.trim()),
});

const initialFileIds = computed(() => {
  const current = normalizeFileId(props.modelValue);
  return current ? [current] : props.initial_file_ids;
});

function openPicker() {
  pickerRef.value?.open();
}

function outputValue(selected: SelectedStorageFile): FileInputValue {
  if (props.valueMode === 'url') return selected.preview_url ?? '';
  if (props.valueMode === 'ref')
    return toFileReference(selected.file) as StorageFileReference;
  return normalizeFileId(selected.file_id) ?? selected.file_id;
}

function onConfirm(files: SelectedStorageFile[]) {
  const selected = files[0];
  if (selected) emit('update:modelValue', outputValue(selected));
}
</script>

<template>
  <div class="file-url-input">
    <FilePicker
      ref="pickerRef"
      :accept="accept"
      :group_id="group_id"
      :initial_file_ids="initialFileIds"
      :max_count="1"
      :storage_code="storage_code"
      @confirm="onConfirm"
    />
    <Input v-model:value="inputValue" :placeholder="placeholder" />
    <FileRefPreview :value="modelValue" />
    <Space>
      <Button @click="openPicker">
        <template #icon>
          <IconifyIcon icon="lucide:folder-open" />
        </template>
        {{ buttonText }}
      </Button>
      <Button v-if="inputValue" @click="emit('update:modelValue', '')">
        清空
      </Button>
    </Space>
  </div>
</template>

<style scoped>
.file-url-input {
  display: grid;
  gap: 8px;
}
</style>
