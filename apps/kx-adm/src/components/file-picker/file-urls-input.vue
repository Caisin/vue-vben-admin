<script setup lang="ts">
import type { FileListInputValue } from './file-ref';
import type {
  FilePickerExpose,
  FilePickerProps,
  SelectedStorageFile,
} from './types';

import { computed, ref } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { Button, Empty } from 'antdv-next';

import FilePicker from './file-picker.vue';
import {
  normalizeFileId,
  parseFileListValue,
  toFileReference,
} from './file-ref';
import FileRefPreview from './file-ref-preview.vue';

interface Props extends Omit<FilePickerProps, 'multiple'> {
  buttonText?: string;
  modelValue?: FileListInputValue;
  valueMode?: 'id-list' | 'ref-list' | 'text';
}

const props = withDefaults(defineProps<Props>(), {
  buttonText: '选择文件',
  initial_file_ids: () => [],
  modelValue: () => [],
  valueMode: 'id-list',
});

const emit = defineEmits<{
  'update:modelValue': [value: FileListInputValue];
}>();

const pickerRef = ref<FilePickerExpose>();
const values = computed(() => parseFileListValue(props.modelValue));
const initialFileIds = computed(() => {
  const ids = values.value
    .map((item) => normalizeFileId(item))
    .filter(Boolean) as Array<number | string>;
  return ids.length > 0 ? ids : props.initial_file_ids;
});

function openPicker() {
  pickerRef.value?.open();
}

function serialize(next: typeof values.value): FileListInputValue {
  if (props.valueMode === 'text') return next.map(String).join('\n');
  if (props.valueMode === 'ref-list') return next;
  return next.map((item) => normalizeFileId(item) ?? String(item));
}

function update(next: typeof values.value) {
  const deduped: typeof values.value = [];
  const seen = new Set<string>();
  for (const item of next) {
    const key = String(normalizeFileId(item) ?? item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }
  emit('update:modelValue', serialize(deduped));
}

function onConfirm(files: SelectedStorageFile[]) {
  const appended = files.map((item) =>
    props.valueMode === 'ref-list'
      ? toFileReference(item.file)
      : String(item.file_id),
  );
  update([...values.value, ...appended]);
}

function removeAt(index: number) {
  const next = [...values.value];
  next.splice(index, 1);
  update(next);
}
</script>

<template>
  <div class="file-urls-input">
    <FilePicker
      ref="pickerRef"
      multiple
      :accept="accept"
      :group_id="group_id"
      :initial_file_ids="initialFileIds"
      :max_count="max_count"
      :storage_code="storage_code"
      @confirm="onConfirm"
    />
    <div v-if="values.length" class="file-list-preview">
      <FileRefPreview
        v-for="(item, index) in values"
        :key="`${normalizeFileId(item) ?? item}-${index}`"
        removable
        :value="item"
        @remove="removeAt(index)"
      />
    </div>
    <Empty
      v-else
      description="暂未选择文件"
      :image="Empty.PRESENTED_IMAGE_SIMPLE"
    />
    <div class="flex gap-2">
      <Button @click="openPicker">
        <template #icon>
          <IconifyIcon icon="lucide:folder-open" />
        </template>
        {{ buttonText }}
      </Button>
      <Button
        v-if="values.length"
        @click="emit('update:modelValue', props.valueMode === 'text' ? '' : [])"
      >
        清空
      </Button>
    </div>
  </div>
</template>

<style scoped>
.file-urls-input,
.file-list-preview {
  display: grid;
  gap: 8px;
}
</style>
