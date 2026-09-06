<script setup lang="ts">
import type { Id } from '#/api/aigc-gateway/studio';

import { onBeforeUnmount, ref, watch } from 'vue';

import { IconifyIcon } from '@vben/icons';

import { Button, Image, message, Spin } from 'antdv-next';

import { StorageFileApi } from '#/api/storage';
import {
  displayFileReference,
  toFileReference,
} from '#/components/file-picker/file-ref';
const props = defineProps<{ id: Id; video?: boolean }>();
const url = ref('');
const loading = ref(false);
const failed = ref(false);
let epoch = 0;
function release() {
  if (url.value.startsWith('blob:')) URL.revokeObjectURL(url.value);
  url.value = '';
}
async function load() {
  const version = ++epoch;
  loading.value = true;
  failed.value = false;
  try {
    const value = await StorageFileApi.url(props.id);
    if (version !== epoch) {
      if (value.startsWith('blob:')) URL.revokeObjectURL(value);
      return;
    }
    release();
    url.value = value;
  } catch {
    failed.value = true;
  } finally {
    if (version === epoch) loading.value = false;
  }
}
async function download() {
  try {
    const [blob, detail] = await Promise.all([
      StorageFileApi.download(props.id),
      StorageFileApi.detail(props.id),
    ]);
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = displayFileReference(toFileReference(detail));
    link.click();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  } catch {
    message.error('下载失败');
  }
}
watch(() => props.id, load, { immediate: true });
onBeforeUnmount(() => {
  epoch++;
  release();
});
</script>
<template>
  <figure class="result-file">
    <Spin v-if="loading" />
    <Button v-else-if="failed" @click="load">重新加载</Button>
    <video v-else-if="video" :src="url" controls preload="metadata"></video>
    <Image v-else :src="url" alt="生成图片" />
    <figcaption>
      <Button size="small" @click="download">
        <template #icon><IconifyIcon icon="lucide:download" /></template>下载原文件
      </Button>
    </figcaption>
  </figure>
</template>
<style scoped>
.result-file {
  display: grid;
  gap: 8px;
  align-content: start;
  min-width: 0;
  margin: 0;
}

.result-file video,
.result-file :deep(img) {
  width: 100%;
  max-height: 540px;
  object-fit: contain;
  background: #151719;
  border-radius: 6px;
}

.result-file video {
  aspect-ratio: 16 / 9;
}

figcaption {
  display: flex;
  justify-content: flex-end;
}
</style>
