<script setup lang="ts">
import type { ToolConstructable } from '@editorjs/editorjs';
import type EditorJS from '@editorjs/editorjs';

import type {
  ArticleContent,
  ArticleDetail,
  ArticleThemeView,
  ArticleUpdateWrite,
  ArticleVisibility,
} from '#/api/article';
import type { UploadFilePageQuery } from '#/api/storage';
import type {
  FilePickerAdapter,
  FilePickerExpose,
  SelectedStorageFile,
} from '#/components/file-picker';

import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import Checklist from '@editorjs/checklist';
import CodeTool from '@editorjs/code';
import Delimiter from '@editorjs/delimiter';
import EditorCore from '@editorjs/editorjs';
import Header from '@editorjs/header';
import EditorjsList from '@editorjs/list';
import Quote from '@editorjs/quote';
import Table from '@editorjs/table';
import {
  Modal as AntModal,
  Button,
  Image,
  Input,
  message,
  Select,
  Space,
  Tag,
} from 'antdv-next';

import { ArticleApi } from '#/api/article';
import { StorageFileApi } from '#/api/storage';
import { FilePicker } from '#/components/file-picker';

import {
  articleAssetFileIds,
  normalizeEditorData,
  toEditorData,
} from '../content';
import { visibilityOptions } from '../data';
import {
  ArticleAttachmentTool,
  ArticleGalleryTool,
  ArticleImageTool,
  ArticleLinkTool,
} from '../tools';
import PreviewModal from './preview-modal.vue';

interface ModalPayload {
  id?: number | string;
}

const emit = defineEmits<{ success: [] }>();
const holder = ref<HTMLElement>();
const previewRef = ref<InstanceType<typeof PreviewModal>>();
const pickerRef = ref<FilePickerExpose>();
const pickingKind = ref<'attachment' | 'cover' | 'gallery' | 'image'>('image');
const detail = ref<ArticleDetail>();
const themes = ref<ArticleThemeView[]>([]);
const loading = ref(false);
const saving = ref(false);
const saveState = ref<
  'conflict' | 'dirty' | 'error' | 'idle' | 'saved' | 'saving'
>('idle');
const lastSavedAt = ref('');
const coverPreviewUrl = ref('');
let editor: EditorJS | undefined;
let saveTimer: number | undefined;
let savePromise: Promise<void> | undefined;
let saveQueued = false;
let changeVersion = 0;
let suppressAutosave = false;

const form = reactive({
  author_name: '',
  cover_file_id: undefined as number | string | undefined,
  password: '',
  summary: '',
  theme_code: 'default',
  title: '',
  visibility: 'public' as ArticleVisibility,
});

const themeOptions = computed(() =>
  themes.value.map((theme) => ({
    label: `${theme.name} (${theme.version})`,
    value: theme.code,
  })),
);
const articleId = computed(() => detail.value?.id);
const storageLabel = computed(() =>
  form.visibility === 'public' ? '公开桶' : '私有桶',
);
const canSave = computed(() => Boolean(detail.value && editor));

const articleAssetAdapter = computed<FilePickerAdapter | undefined>(() => {
  const id = articleId.value;
  if (!id) return undefined;
  return {
    list: (params?: UploadFilePageQuery) => ArticleApi.assets(id, params),
    upload: (file: File) => ArticleApi.uploadAsset(id, file),
    convertRemote: (url: string) => ArticleApi.transferRemoteImage(id, { url }),
    storageOptions: async () => [
      { label: `Article ${storageLabel.value}`, value: 'article' },
    ],
  };
});

const [Modal, modalApi] = useVbenModal<ModalPayload>({
  centered: true,
  class: 'h-[min(860px,calc(100dvh-20px))] w-[min(1400px,calc(100vw-24px))]',
  contentClass: 'overflow-hidden p-0',
  destroyOnClose: false,
  footer: false,
  fullscreenButton: true,
  async onBeforeClose() {
    await flushBeforeClose();
    if (['conflict', 'dirty', 'error', 'saving'].includes(saveState.value)) {
      message.warning('草稿尚未安全保存');
      return false;
    }
    return true;
  },
  async onOpenChange(open) {
    if (!open) {
      await destroyEditor();
      detail.value = undefined;
      return;
    }
    const payload = modalApi.getData();
    if (!payload) return;
    if (payload.id) await loadArticle(payload.id);
  },
});

async function destroyEditor() {
  if (!editor) return;
  await editor.isReady;
  editor.destroy();
  editor = undefined;
}

function editorTools(): Record<string, ToolConstructable> {
  return {
    attachment: ArticleAttachmentTool as unknown as ToolConstructable,
    checklist: Checklist,
    code: CodeTool,
    delimiter: Delimiter,
    gallery: ArticleGalleryTool as unknown as ToolConstructable,
    header: Header,
    image: ArticleImageTool as unknown as ToolConstructable,
    link: ArticleLinkTool as unknown as ToolConstructable,
    list: EditorjsList,
    quote: Quote,
    table: Table,
  };
}

async function mountEditor(
  content?: ArticleContent,
  assetUrls: ReadonlyMap<string, string> = new Map(),
) {
  await destroyEditor();
  await nextTick();
  if (!holder.value) return;
  editor = new EditorCore({
    data: toEditorData(content, assetUrls),
    holder: holder.value,
    minHeight: 560,
    onChange: scheduleSave,
    placeholder: '在此输入正文',
    tools: editorTools(),
  });
  await editor.isReady;
}

function fillForm(row: ArticleDetail) {
  suppressAutosave = true;
  form.author_name = row.author_name ?? '';
  form.cover_file_id = row.cover_file_id;
  form.password = '';
  form.summary = row.summary ?? '';
  form.theme_code = row.theme_code || 'default';
  form.title = row.title;
  form.visibility = row.visibility;
  suppressAutosave = false;
}

async function loadArticle(id: number | string) {
  loading.value = true;
  saveState.value = 'idle';
  try {
    const [row, themeList] = await Promise.all([
      ArticleApi.detail(id),
      ArticleApi.themes(),
    ]);
    themes.value = themeList;
    detail.value = row;
    fillForm(row);
    const ids = articleAssetFileIds(row.content);
    if (row.cover_file_id) ids.push(row.cover_file_id);
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
    coverPreviewUrl.value = row.cover_file_id
      ? (assetUrls.get(String(row.cover_file_id)) ?? '')
      : '';
    await mountEditor(row.content, assetUrls);
  } finally {
    loading.value = false;
  }
}

function scheduleSave() {
  if (!canSave.value || suppressAutosave) return;
  changeVersion += 1;
  saveState.value = 'dirty';
  if (saveTimer) window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => void saveDraft(), 1800);
}

watch(
  () => [
    form.title,
    form.author_name,
    form.summary,
    form.cover_file_id,
    form.theme_code,
    form.visibility,
    form.password,
  ],
  scheduleSave,
  { flush: 'sync' },
);

async function buildPayload(): Promise<ArticleUpdateWrite> {
  if (!detail.value || !editor) throw new Error('文章未加载完成');
  const data = normalizeEditorData(await editor.save());
  return {
    author_name: form.author_name.trim(),
    content: data,
    cover_file_id: form.cover_file_id,
    editor_version: data.version,
    expected_draft_revision: detail.value.draft_revision,
    password: form.password.trim() || undefined,
    summary: form.summary.trim(),
    theme_code: form.theme_code,
    title: form.title.trim(),
    visibility: form.visibility,
  };
}

async function saveDraft() {
  if (!detail.value || !editor) return;
  if (savePromise) {
    saveQueued = true;
    await savePromise;
    if (saveState.value === 'dirty') await saveDraft();
    return;
  }
  if (saveTimer) window.clearTimeout(saveTimer);
  saveQueued = false;
  savePromise = performSave();
  await savePromise;
  savePromise = undefined;
  if (saveQueued && saveState.value === 'dirty') {
    saveQueued = false;
    await saveDraft();
  }
}

async function performSave() {
  if (!detail.value || !editor) return;
  const savingVersion = changeVersion;
  saving.value = true;
  saveState.value = 'saving';
  try {
    const updated = await ArticleApi.update(
      detail.value.id,
      await buildPayload(),
    );
    detail.value = updated;
    suppressAutosave = true;
    form.password = '';
    suppressAutosave = false;
    if (changeVersion === savingVersion) {
      saveState.value = 'saved';
      lastSavedAt.value = new Date().toLocaleTimeString();
    } else {
      saveQueued = true;
      saveState.value = 'dirty';
    }
    emit('success');
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    saveState.value = text.includes('article_revision_conflict')
      ? 'conflict'
      : 'error';
    message.error(text || '草稿保存失败');
  } finally {
    saving.value = false;
  }
}

async function flushBeforeClose() {
  if (saveTimer) window.clearTimeout(saveTimer);
  if (saveState.value === 'dirty' || savePromise) await saveDraft();
}

async function quickPreview() {
  if (!editor) return;
  previewRef.value?.open({
    content: normalizeEditorData(await editor.save()),
    title: `快速预览：${form.title || '未命名文章'}`,
    type: 'quick',
  });
}

async function serverPreview() {
  if (!detail.value) return;
  await saveDraft();
  if (['conflict', 'dirty', 'error', 'saving'].includes(saveState.value))
    return;
  const result = await ArticleApi.preview(
    detail.value.id,
    detail.value.draft_revision,
  );
  previewRef.value?.open({
    html: result.html,
    title: `主题预览：${form.title}`,
    type: 'server',
  });
}

async function publish() {
  if (!detail.value) return;
  await saveDraft();
  if (['conflict', 'dirty', 'error', 'saving'].includes(saveState.value))
    return;
  const row = detail.value;
  if (!row) return;
  AntModal.confirm({
    title: '发布文章',
    content: '发布会生成新的静态 HTML 版本；若已有相同发布任务则返回当前任务。',
    async onOk() {
      const result = await ArticleApi.publish(row.id, row.draft_revision);
      message.success(
        result.unchanged ? '当前内容与线上版本一致' : '发布任务已提交',
      );
      detail.value = await ArticleApi.detail(row.id);
      emit('success');
    },
  });
}

async function unpublish() {
  if (!detail.value) return;
  const row = await ArticleApi.unpublish(detail.value.id);
  detail.value = row;
  fillForm(row);
  message.success('已取消发布');
  emit('success');
}

function openPicker(kind: 'attachment' | 'cover' | 'gallery' | 'image') {
  pickingKind.value = kind;
  pickerRef.value?.open();
}

function clearCover() {
  form.cover_file_id = undefined;
  coverPreviewUrl.value = '';
  scheduleSave();
}

async function insertPicked(files: SelectedStorageFile[]) {
  if (!editor || files.length === 0) return;
  if (pickingKind.value === 'cover') {
    const [file] = files;
    if (!file) return;
    form.cover_file_id = file.file_id;
    coverPreviewUrl.value = file.preview_url ?? '';
    scheduleSave();
    return;
  }
  if (pickingKind.value === 'gallery') {
    await editor.blocks.insert('gallery', {
      items: files.map((file) => ({
        alt: file.file_name,
        caption: '',
        file_id: file.file_id,
        url: file.preview_url,
      })),
    });
    scheduleSave();
    return;
  }
  for (const file of files) {
    const isImage = pickingKind.value === 'image';
    await editor.blocks.insert(
      isImage ? 'image' : 'attachment',
      isImage
        ? {
            alt: file.file_name,
            caption: '',
            file_id: file.file_id,
            url: file.preview_url,
          }
        : { file_id: file.file_id, title: file.file_name },
    );
  }
  scheduleSave();
}

async function handlePaste(event: ClipboardEvent) {
  if (!detail.value || !editor) return;
  const files = [...(event.clipboardData?.files ?? [])].filter((file) =>
    file.type.startsWith('image/'),
  );
  if (files.length > 0) {
    event.preventDefault();
    for (const file of files) {
      const [result] = await ArticleApi.uploadAsset(detail.value.id, file);
      if (!result) continue;
      await editor.blocks.insert('image', {
        alt: result.file.file_name,
        caption: '',
        file_id: result.file.file_id,
        url: result.url,
      });
    }
    scheduleSave();
    return;
  }
  const text = event.clipboardData?.getData('text/plain').trim();
  if (text && /^https?:\/\/\S+$/i.test(text)) {
    event.preventDefault();
    try {
      const result = await ArticleApi.transferRemoteImage(detail.value.id, {
        url: text,
      });
      await editor.blocks.insert('image', {
        alt: result.file.file_name,
        caption: '',
        file_id: result.file.file_id,
        url: result.url,
      });
      scheduleSave();
    } catch {
      await editor.blocks.insert('link', {
        description: '',
        title: text,
        url: text,
      });
    }
  }
}

onBeforeUnmount(() => {
  if (saveTimer) window.clearTimeout(saveTimer);
  void destroyEditor();
});
</script>

<template>
  <Modal :title="form.title || '编辑文章'">
    <PreviewModal ref="previewRef" />
    <FilePicker
      ref="pickerRef"
      :accept="pickingKind === 'attachment' ? undefined : 'image/*'"
      :adapter="articleAssetAdapter"
      :multiple="pickingKind === 'image' || pickingKind === 'gallery'"
      @confirm="insertPicked"
    />
    <div class="article-editor-shell" :class="{ 'is-loading': loading }">
      <div class="article-editor-toolbar">
        <Space wrap>
          <Tag
            :color="
              ['conflict', 'error'].includes(saveState)
                ? 'error'
                : saveState === 'dirty'
                  ? 'warning'
                  : 'success'
            "
          >
            {{
              saveState === 'saving'
                ? '保存中'
                : saveState === 'dirty'
                  ? '待保存'
                  : saveState === 'conflict'
                    ? '保存冲突'
                    : saveState === 'error'
                      ? '保存失败'
                      : saveState === 'idle'
                        ? '已加载'
                        : `已保存 ${lastSavedAt}`
            }}
          </Tag>
          <Tag v-if="detail?.current_release_id" color="processing">
            线上版本 #{{ detail.current_release_id }}
          </Tag>
          <Button :loading="saving" @click="saveDraft">保存草稿</Button>
          <Button @click="quickPreview">快速预览</Button>
          <Button @click="serverPreview">主题预览</Button>
          <Button type="primary" @click="publish">发布</Button>
          <Button
            v-if="detail?.state === 'published'"
            danger
            @click="unpublish"
          >
            取消发布
          </Button>
        </Space>
      </div>
      <div class="article-editor-body">
        <main class="article-editor-main">
          <Input
            v-model:value="form.title"
            class="article-title-input"
            ::maxlength="120"
            placeholder="文章标题"
          />
          <div
            ref="holder"
            class="article-editor-canvas"
            @paste.capture="handlePaste"
          ></div>
        </main>
        <aside class="article-editor-settings">
          <label>
            <span>作者显示名</span>
            <Input v-model:value="form.author_name" ::maxlength="80" />
          </label>
          <label>
            <span>摘要</span>
            <Input.TextArea
              v-model:value="form.summary"
              ::maxlength="300"
              :rows="4"
            />
          </label>
          <div class="grid gap-2">
            <span class="text-[13px] font-semibold">封面</span>
            <Image
              v-if="coverPreviewUrl"
              :src="coverPreviewUrl"
              :width="160"
              class="max-h-28 object-cover"
            />
            <Space>
              <Button @click="openPicker('cover')">选择封面</Button>
              <Button v-if="form.cover_file_id" danger @click="clearCover">
                清除
              </Button>
            </Space>
          </div>
          <div class="grid gap-1.5 text-[13px]">
            <span class="font-semibold">公开地址</span>
            <a
              v-if="detail?.slug"
              class="break-all text-primary"
              :href="`/p/${detail.slug}`"
              target="_blank"
            >
              /p/{{ detail.slug }}
            </a>
            <span v-else class="text-muted-foreground">首次发布时自动生成</span>
          </div>
          <label>
            <span>主题</span>
            <Select
              v-model:value="form.theme_code"
              class="w-full"
              :options="themeOptions"
            />
          </label>
          <label>
            <span>访问方式</span>
            <Select
              v-model:value="form.visibility"
              class="w-full"
              :options="visibilityOptions"
            />
          </label>
          <label v-if="form.visibility === 'password'">
            访问密码
            <Input.Password
              v-model:value="form.password"
              placeholder="留空表示保持已有密码"
            />
          </label>
          <div class="grid gap-2">
            <Button block @click="openPicker('image')">插入图片</Button>
            <Button block @click="openPicker('gallery')">插入图库</Button>
            <Button block @click="openPicker('attachment')">插入附件</Button>
          </div>
        </aside>
      </div>
    </div>
  </Modal>
</template>

<style scoped>
.article-editor-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: min(560px, calc(80dvh - 64px));
}

.article-editor-toolbar {
  flex: none;
  padding: 10px 16px;
  border-bottom: 1px solid hsl(var(--border));
}

.article-editor-body {
  display: grid;
  flex: 1;
  grid-template-columns: minmax(0, 1fr) 320px;
  min-height: 0;
}

.article-editor-main {
  min-width: 0;
  padding: 18px 24px;
  overflow-y: auto;
}

.article-title-input {
  margin-bottom: 16px;
  font-size: 24px;
  font-weight: 700;
}

.article-editor-canvas {
  min-height: 520px;
  padding: 20px 32px;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.article-editor-settings {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px;
  overflow-y: auto;
  border-left: 1px solid hsl(var(--border));
}

.article-editor-settings label {
  display: grid;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
}

:deep(.article-tool-input) {
  width: 100%;
  padding: 6px 8px;
  margin-top: 8px;
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

:deep(.article-image-tool__box),
:deep(.article-attachment-tool) {
  padding: 12px;
  background: hsl(var(--muted));
  border-radius: 8px;
}

:deep(.article-image-tool__box img) {
  max-width: 100%;
  border-radius: 6px;
}

:deep(.article-gallery-tool) {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 10px;
}

:deep(.article-gallery-tool figure) {
  margin: 0;
  overflow: hidden;
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

:deep(.article-gallery-tool img) {
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: cover;
}

:deep(.article-gallery-tool figcaption) {
  padding: 6px 8px;
  font-size: 12px;
}

:deep(.article-link-tool) {
  display: grid;
  gap: 6px;
}

@media (max-width: 900px) {
  .article-editor-body {
    grid-template-columns: 1fr;
    overflow-y: auto;
  }

  .article-editor-main,
  .article-editor-settings {
    overflow: visible;
  }

  .article-editor-settings {
    border-top: 1px solid hsl(var(--border));
    border-left: 0;
  }
}
</style>
