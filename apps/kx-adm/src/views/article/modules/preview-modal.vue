<script setup lang="ts">
import type { ArticleContent } from '#/api/article';

import { nextTick, onBeforeUnmount, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import Checklist from '@editorjs/checklist';
import CodeTool from '@editorjs/code';
import Delimiter from '@editorjs/delimiter';
import EditorJS from '@editorjs/editorjs';
import Header from '@editorjs/header';
import EditorjsList from '@editorjs/list';
import Quote from '@editorjs/quote';
import Table from '@editorjs/table';

import { resolveFileAccessUrl, StorageFileApi } from '#/api/storage/file';

import { articleAssetFileIds, toEditorData } from '../content';
import {
  ArticleAttachmentTool,
  ArticleGalleryTool,
  ArticleImageTool,
  ArticleLinkTool,
} from '../tools';

interface PreviewPayload {
  content?: ArticleContent;
  html?: string;
  title: string;
  type: 'quick' | 'server';
}

const holder = ref<HTMLElement>();
const iframe = ref<HTMLIFrameElement>();
const payload = ref<PreviewPayload>({ title: '预览', type: 'quick' });
let editor: EditorJS | undefined;

const [Modal, modalApi] = useVbenModal({
  class: 'w-[min(1040px,calc(100vw-20px))]',
  destroyOnClose: false,
  showConfirmButton: false,
  async onOpenChange(open) {
    if (open) {
      await nextTick();
      await renderPreview();
    } else {
      await destroyEditor();
    }
  },
});

async function destroyEditor() {
  if (editor) {
    await editor.isReady;
    editor.destroy();
    editor = undefined;
  }
}

async function renderPreview() {
  await destroyEditor();
  if (payload.value.type === 'server') {
    if (iframe.value)
      iframe.value.srcdoc = await resolveServerPreview(
        payload.value.html ?? '',
      );
    return;
  }
  if (!holder.value) return;
  const ids = articleAssetFileIds(payload.value.content);
  let assetUrls = new Map<string, string>();
  if (ids.length > 0) {
    try {
      const access = await StorageFileApi.urls(ids);
      assetUrls = new Map(
        access.map((item) => [String(item.file_id), item.url]),
      );
    } catch {
      assetUrls = new Map();
    }
  }
  editor = new EditorJS({
    data: toEditorData(payload.value.content, assetUrls),
    holder: holder.value,
    minHeight: 0,
    readOnly: true,
    tools: {
      attachment: ArticleAttachmentTool,
      checklist: Checklist,
      code: CodeTool,
      delimiter: Delimiter,
      gallery: ArticleGalleryTool,
      header: Header,
      image: ArticleImageTool,
      link: ArticleLinkTool,
      list: EditorjsList,
      quote: Quote,
      table: Table,
    },
  });
  await editor.isReady;
}

async function resolveServerPreview(html: string) {
  const document = new DOMParser().parseFromString(html, 'text/html');
  await Promise.all(
    [...document.querySelectorAll<HTMLImageElement>('img[src]')].map(
      async (image) => {
        const source = image.getAttribute('src') ?? '';
        const fileId = source.match(/^\/storage\/file\/content\/(\d+)$/)?.[1];
        image.src = fileId
          ? await StorageFileApi.url(fileId)
          : resolveFileAccessUrl(source);
      },
    ),
  );
  for (const link of document.querySelectorAll<HTMLAnchorElement>('a[href]')) {
    link.href = resolveFileAccessUrl(link.getAttribute('href') ?? '');
  }
  return `<!doctype html>${document.documentElement.outerHTML}`;
}

function open(data: PreviewPayload) {
  payload.value = data;
  modalApi.setState({ title: data.title });
  modalApi.open();
}

onBeforeUnmount(() => {
  void destroyEditor();
});

defineExpose({ open });
</script>

<template>
  <Modal>
    <div
      v-if="payload.type === 'quick'"
      ref="holder"
      class="article-preview-canvas"
    ></div>
    <iframe
      v-else
      ref="iframe"
      class="h-[70vh] w-full rounded border border-border bg-white"
      sandbox="allow-same-origin"
      title="文章主题预览"
    ></iframe>
  </Modal>
</template>

<style scoped>
.article-preview-canvas {
  min-height: 60vh;
  max-height: 70vh;
  padding: 24px;
  overflow-y: auto;
  background: hsl(var(--background));
}
</style>
