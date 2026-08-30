<script lang="ts" setup>
import { computed, ref } from 'vue';

import { Button, Input, message } from 'antdv-next';

export interface JsonFileInputProps {
  maxlength?: number;
  modelValue?: string;
  placeholder?: string;
  rows?: number;
}

const props = withDefaults(defineProps<JsonFileInputProps>(), {
  maxlength: undefined,
  modelValue: '',
  placeholder: '可粘贴 JSON，或拖拽/选择 .json 文件',
  rows: 8,
});
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const fileInput = ref<HTMLInputElement>();
const dragging = ref(false);
const fileName = ref('');
const reading = ref(false);

const value = computed({
  get: () => props.modelValue,
  set: (next: string) => {
    fileName.value = '';
    emit('update:modelValue', next);
  },
});

function openFilePicker() {
  fileInput.value?.click();
}

async function readFile(file?: File) {
  if (!file) return;
  if (
    file.type &&
    file.type !== 'application/json' &&
    !file.name.endsWith('.json')
  ) {
    message.warning('请选择 JSON 文件');
    return;
  }
  reading.value = true;
  try {
    const text = await file.text();
    if (props.maxlength && text.length > props.maxlength) {
      message.error(`文件内容超过 ${props.maxlength} 个字符`);
      return;
    }
    fileName.value = file.name;
    emit('update:modelValue', text);
    message.success(`已读取 ${file.name}`);
  } catch {
    message.error('JSON 文件读取失败');
  } finally {
    reading.value = false;
  }
}

function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  void readFile(input.files?.[0]);
  input.value = '';
}

function handleDrop(event: DragEvent) {
  event.preventDefault();
  dragging.value = false;
  void readFile(event.dataTransfer?.files?.[0]);
}
</script>

<template>
  <div
    class="json-file-input"
    :class="{ 'json-file-input--dragging': dragging }"
    @dragenter.prevent="dragging = true"
    @dragover.prevent="dragging = true"
    @dragleave.prevent="dragging = false"
    @drop="handleDrop"
  >
    <Input.TextArea
      v-model:value="value"
      :maxlength="props.maxlength"
      :placeholder="props.placeholder"
      :rows="props.rows"
    />
    <div class="json-file-input__actions">
      <Button
        :loading="reading"
        size="small"
        type="link"
        @click="openFilePicker"
      >
        选择 JSON 文件
      </Button>
      <span v-if="fileName" class="json-file-input__name">{{ fileName }}</span>
      <span v-else class="json-file-input__hint">也可直接拖拽文件到此处</span>
    </div>
    <input
      ref="fileInput"
      accept=".json,application/json"
      class="hidden"
      type="file"
      @change="handleFileChange"
    />
  </div>
</template>

<style scoped>
.json-file-input {
  padding: 6px;
  border: 1px dashed var(--vben-border-color, #d9d9d9);
  border-radius: 6px;
  transition:
    border-color 0.2s,
    background-color 0.2s;
}

.json-file-input--dragging {
  background: var(--vben-color-primary-bg, #e6f4ff);
  border-color: var(--vben-color-primary, #1677ff);
}

.json-file-input__actions {
  display: flex;
  gap: 8px;
  align-items: center;
  min-height: 26px;
}

.json-file-input__hint,
.json-file-input__name {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  color: var(--vben-gray-500, #8c8c8c);
  white-space: nowrap;
}

.json-file-input__name {
  color: var(--vben-color-primary, #1677ff);
}
</style>
