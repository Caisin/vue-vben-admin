<script setup lang="ts">
import type {
  FileInputValue,
  StorageFileMediaType,
  StorageFileReference,
} from './file-ref';

import { computed, ref, watch } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { Button, Image, Tooltip } from 'antdv-next';

import { StorageFileApi } from '#/api/storage';

import {
  displayFileReference,
  fileKindFromReference,
  isFileReference,
  isHttpUrl,
  normalizeFileId,
  toFileReference,
} from './file-ref';

const props = withDefaults(
  defineProps<{
    removable?: boolean;
    value?: FileInputValue;
  }>(),
  { removable: false, value: '' },
);

const emit = defineEmits<{ remove: [] }>();

const loading = ref(false);
const previewUrl = ref('');
const failed = ref(false);
const fileMeta = ref<StorageFileReference>();

const fileId = computed(() => normalizeFileId(props.value));
const resolvedReference = computed<FileInputValue>(() => {
  if (isFileReference(props.value)) {
    return { ...props.value, ...fileMeta.value, file_id: props.value.file_id };
  }
  return fileMeta.value ?? props.value;
});
const kind = computed<StorageFileMediaType>(() =>
  fileKindFromReference(resolvedReference.value),
);
const displayName = computed(() => {
  const value = resolvedReference.value;
  if (isFileReference(value)) return displayFileReference(value);
  if (typeof value === 'string')
    return isHttpUrl(value) ? value.split('/').pop() || value : value;
  return value === undefined ? '' : String(value);
});
const resolvedUrl = computed(() =>
  isHttpUrl(props.value) ? props.value : previewUrl.value,
);

watch(
  () => props.value,
  async () => {
    previewUrl.value = '';
    fileMeta.value = undefined;
    failed.value = false;
    if (!props.value) return;
    if (isHttpUrl(props.value)) return;
    if (!fileId.value) return;

    loading.value = true;
    try {
      const [detailResult, urlResult] = await Promise.allSettled([
        StorageFileApi.detail(fileId.value),
        StorageFileApi.url(fileId.value),
      ]);
      if (detailResult.status === 'fulfilled') {
        fileMeta.value = toFileReference(detailResult.value);
      }
      if (urlResult.status === 'fulfilled') {
        previewUrl.value = urlResult.value;
      } else {
        failed.value = true;
      }
    } finally {
      loading.value = false;
    }
  },
  { immediate: true },
);
</script>

<template>
  <div v-if="value" class="file-ref-preview">
    <div class="file-ref-thumb" :class="`is-${kind}`">
      <Image
        v-if="kind === 'image' && resolvedUrl"
        :src="resolvedUrl"
        :width="56"
        :height="56"
        :preview="true"
        class="file-ref-image"
      />
      <video
        v-else-if="kind === 'video' && resolvedUrl"
        :src="resolvedUrl"
        class="file-ref-video"
        controls
        muted
      ></video>
      <IconifyIcon
        v-else
        class="size-6 text-muted-foreground"
        :icon="kind === 'video' ? 'lucide:film' : 'lucide:file'"
      />
    </div>
    <div class="min-w-0 flex-1">
      <div class="truncate text-sm" :title="displayName">{{ displayName }}</div>
      <div class="text-xs text-muted-foreground">
        <template v-if="fileId">文件 ID：{{ fileId }}</template>
        <template v-else-if="isHttpUrl(value)">外部 URL</template>
        <template v-else>文件引用</template>
        <template v-if="loading"> · 加载预览中</template>
        <template v-if="failed"> · 预览地址获取失败</template>
      </div>
    </div>
    <Tooltip v-if="removable" title="移除">
      <Button shape="circle" size="small" type="text" @click="emit('remove')">
        <template #icon><IconifyIcon icon="lucide:x" /></template>
      </Button>
    </Tooltip>
  </div>
</template>

<style scoped>
.file-ref-preview {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 8px;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.file-ref-thumb {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  overflow: hidden;
  background: hsl(var(--muted));
  border-radius: 6px;
}

.file-ref-image :deep(img),
.file-ref-video {
  width: 56px;
  height: 56px;
  object-fit: cover;
}
</style>
