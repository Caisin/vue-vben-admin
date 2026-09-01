<script lang="ts" setup>
import type { UploadProps } from 'antdv-next';

import type { SelectedStorageFile } from '#/components/file-picker';

import { computed, ref } from 'vue';

import { IconifyIcon, X } from '@vben/icons';

import { Button, message, Progress, Upload } from 'antdv-next';

import { StorageFileShareApi } from '#/api/storage';
import { filesFromDataTransfer } from '#/components/file-picker/internal/dropped-files';

const emit = defineEmits<{ change: [files: SelectedStorageFile[]] }>();
const uploaded = ref<SelectedStorageFile[]>([]);
const total = ref(0);
const succeeded = ref(0);
const failed = ref(0);
const pending = ref(0);
const running = computed(() => pending.value > 0);
const dragging = ref(false);
const percent = computed(() =>
  total.value > 0
    ? Math.round(((succeeded.value + failed.value) / total.value) * 100)
    : 0,
);

function fileKey(file: SelectedStorageFile) {
  return String(file.file.file_id);
}

function displayName(file: SelectedStorageFile) {
  const { file_ext: ext, file_name: name } = file.file;
  return ext && !name.endsWith(`.${ext}`) ? `${name}.${ext}` : name;
}

async function uploadFiles(files: File[]) {
  if (files.length === 0) return;
  pending.value += files.length;
  total.value += files.length;
  for (const file of files) {
    try {
      const results = await StorageFileShareApi.pickerUpload(file);
      for (const result of results) {
        const selected: SelectedStorageFile = {
          file: result.file,
          file_id: result.file.file_id,
          preview_url: result.url,
        };
        if (
          !uploaded.value.some((item) => fileKey(item) === fileKey(selected))
        ) {
          uploaded.value.push(selected);
        }
      }
      succeeded.value += 1;
    } catch {
      failed.value += 1;
    } finally {
      pending.value = Math.max(0, pending.value - 1);
    }
  }
  emit('change', [...uploaded.value]);
  if (failed.value > 0) message.warning(`上传完成，${failed.value} 个文件失败`);
}

const uploadRequest: NonNullable<UploadProps['customRequest']> = async (
  options,
) => {
  if (typeof options.file === 'string' || !(options.file instanceof File))
    return;
  try {
    await uploadFiles([options.file]);
    options.onSuccess?.(true);
  } catch (error) {
    options.onError?.(error instanceof Error ? error : new Error('上传失败'));
  }
};

async function drop(event: DragEvent) {
  dragging.value = false;
  if (!event.dataTransfer) return;
  await uploadFiles(await filesFromDataTransfer(event.dataTransfer));
}

function remove(index: number) {
  uploaded.value.splice(index, 1);
  emit('change', [...uploaded.value]);
}

function reset() {
  uploaded.value = [];
  total.value = 0;
  succeeded.value = 0;
  failed.value = 0;
  pending.value = 0;
  emit('change', []);
}

defineExpose({ isRunning: () => running.value, reset });
</script>

<template>
  <div class="share-upload-field">
    <div
      class="share-upload-drop"
      :class="{ active: dragging }"
      @dragenter.prevent="dragging = true"
      @dragleave.prevent="dragging = false"
      @dragover.prevent
      @drop.prevent="drop"
    >
      <IconifyIcon class="size-7" icon="lucide:upload" />
      <strong>选择或拖入分享文件</strong>
      <span>支持多个文件或整个文件夹，单个失败不会中断其它文件</span>
      <div class="mt-3 flex flex-wrap justify-center gap-2">
        <Upload
          :custom-request="uploadRequest"
          multiple
          :show-upload-list="false"
        >
          <Button :disabled="running">
            <IconifyIcon class="size-4" icon="lucide:upload" />选择文件
          </Button>
        </Upload>
        <Upload
          directory
          :custom-request="uploadRequest"
          multiple
          :show-upload-list="false"
        >
          <Button :disabled="running">
            <IconifyIcon class="size-4" icon="lucide:folder-up" />选择文件夹
          </Button>
        </Upload>
      </div>
    </div>
    <div v-if="total" class="mt-3">
      <div class="mb-1 flex justify-between text-xs text-muted-foreground">
        <span>总数 {{ total }} · 成功 {{ succeeded }} · 失败 {{ failed }}</span>
        <span>{{ percent }}%</span>
      </div>
      <Progress
        :percent="percent"
        :status="failed ? 'exception' : running ? 'active' : 'success'"
        size="small"
      />
    </div>
    <div v-if="uploaded.length" class="share-upload-files">
      <div
        v-for="(item, index) in uploaded"
        :key="fileKey(item)"
        class="share-upload-file"
      >
        <span class="truncate">{{ displayName(item) }}</span>
        <Button
          aria-label="移除文件"
          shape="circle"
          size="small"
          type="text"
          @click="remove(index)"
        >
          <X class="size-4" />
        </Button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.share-upload-drop {
  display: grid;
  place-items: center;
  min-height: 180px;
  padding: 24px;
  color: hsl(var(--muted-foreground));
  text-align: center;
  background: hsl(var(--muted) / 25%);
  border: 1px dashed hsl(var(--border));
  border-radius: 6px;
}

.share-upload-drop strong {
  margin-top: 10px;
  font-size: 16px;
  color: hsl(var(--foreground));
}

.share-upload-drop span {
  margin-top: 4px;
  font-size: 12px;
}

.share-upload-drop.active {
  background: hsl(var(--primary) / 8%);
  border-color: hsl(var(--primary));
}

.share-upload-files {
  display: grid;
  gap: 6px;
  max-height: 160px;
  margin-top: 12px;
  overflow: auto;
}

.share-upload-file {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  min-height: 34px;
  padding: 4px 8px;
  border: 1px solid hsl(var(--border));
  border-radius: 4px;
}
</style>
