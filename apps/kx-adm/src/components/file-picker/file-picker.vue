<script setup lang="ts">
import type { UploadProps } from 'antdv-next';

import type {
  FileId,
  FilePickerExpose,
  FilePickerProps,
  SelectedStorageFile,
} from './types';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { FileUploadView, UploadFile, UploadFileKind } from '#/api/storage';

import { computed, nextTick, ref, watch } from 'vue';

import { useVbenModal } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import {
  Button,
  Image,
  Input,
  InputSearch,
  message,
  notification,
  Pagination,
  Progress,
  Select,
  Tooltip,
  Upload,
} from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  StorageConfigApi,
  StorageFileApi,
  StorageGroupApi,
} from '#/api/storage';

import { fileKindFromExt, isHttpUrl, toFileReference } from './file-ref';
import {
  acceptsBrowserFile,
  acceptsStoredFile,
  normalizeAccept,
} from './file-type';
import { filesFromDataTransfer } from './internal/dropped-files';
import {
  fileKindOptions,
  filePickerColumns,
  formatFileSize,
  supportsDirectUpload,
  uploadModeOptions,
} from './internal/file-picker-options';
import { uploadErrorMessage } from './internal/upload-error';
import { useDirectUpload } from './internal/use-direct-upload';

const props = withDefaults(defineProps<FilePickerProps>(), {
  initial_file_ids: () => [],
  multiple: false,
  storage_locked: false,
});

const emit = defineEmits<{
  closed: [];
  confirm: [files: SelectedStorageFile[]];
}>();

const files = ref<UploadFile[]>([]);
const groups = ref<Awaited<ReturnType<typeof StorageGroupApi.list>>>([]);
const storage_options = ref<
  Array<{ label: string; storage_type?: string; value: string }>
>([]);
const selected = ref(new Map<string, UploadFile>());
const active_group_id = ref<FileId>();
const active_storage_code = ref<string>();
const active_upload_mode = ref<'direct' | 'serve'>('direct');
const active_file_kind = ref<'all' | UploadFileKind>('all');
const name_prefix = ref('');
const loading = ref(false);
const drag_active = ref(false);
const preview_urls = ref(new Map<string, string>());
const page = ref(1);
const page_size = ref(20);
const total = ref(0);

const renaming_file = ref<UploadFile>();
const rename_value = ref('');
const group_name = ref('');
const group_code = ref('');
const convert_url = ref('');

const adapter = computed(() => props.adapter);
const useArticleAdapter = computed(() => Boolean(adapter.value));
const upload_accept = computed(() => normalizeAccept(props.accept).join(','));
const selected_count = computed(() => selected.value.size);
const selection_limit = computed(() => (props.multiple ? props.max_count : 1));
const active_storage_type = computed(
  () =>
    storage_options.value.find(
      (option) => option.value === active_storage_code.value,
    )?.storage_type,
);
const direct_upload_supported = computed(() =>
  supportsDirectUpload(active_storage_type.value),
);
const available_upload_mode_options = computed(() =>
  direct_upload_supported.value
    ? uploadModeOptions
    : uploadModeOptions.filter((option) => option.value === 'serve'),
);

function selectable(record: UploadFile) {
  return (
    acceptsStoredFile(record, props.accept) &&
    (selected.value.has(fileKey(record)) ||
      selection_limit.value === undefined ||
      selected.value.size < selection_limit.value)
  );
}

const [Grid, gridApi] = useVbenVxeGrid<UploadFile>({
  gridEvents: {
    checkboxAll: updateGridSelection,
    checkboxChange: updateGridSelection,
    radioChange: updateGridSelection,
  },
  gridOptions: {
    checkboxConfig: {
      checkMethod: ({ row }) => selectable(row),
      reserve: true,
    },
    columns: [
      { fixed: 'left', type: props.multiple ? 'checkbox' : 'radio', width: 46 },
      ...(filePickerColumns ?? []),
    ],
    height: 330,
    pagerConfig: { enabled: false },
    radioConfig: { checkMethod: ({ row }) => selectable(row), reserve: true },
    rowConfig: { keyField: 'file_id' },
    toolbarConfig: { enabled: false },
  } as VxeTableGridOptions<UploadFile>,
});

const [RenameModal, renameModalApi] = useVbenModal({
  class: 'w-[min(460px,calc(100vw-20px))]',
  async onConfirm() {
    const file = renaming_file.value;
    const fileName = rename_value.value.trim();
    if (!file || !fileName) {
      message.warning('请输入文件名');
      return;
    }
    renameModalApi.lock();
    try {
      const rename = adapter.value?.rename ?? StorageFileApi.rename;
      const updated = await rename(file.file_id, {
        file_name: fileName,
      });
      const key = fileKey(updated);
      if (selected.value.has(key)) {
        const next = new Map(selected.value);
        next.set(key, updated);
        selected.value = next;
      }
      message.success('文件名已更新');
      renameModalApi.close();
      await loadFiles();
    } finally {
      renameModalApi.lock(false);
    }
  },
});

const [GroupModal, groupModalApi] = useVbenModal({
  class: 'w-[min(480px,calc(100vw-20px))]',
  async onConfirm() {
    if (!group_name.value.trim() || !group_code.value.trim()) {
      message.warning('请输入分组名称和编码');
      return;
    }
    groupModalApi.lock();
    try {
      const created = await StorageGroupApi.create({
        group_code: group_code.value.trim(),
        group_name: group_name.value.trim(),
      });
      await loadGroups();
      active_group_id.value = created.id;
      page.value = 1;
      message.success('分组已创建');
      groupModalApi.close();
      await loadFiles();
    } finally {
      groupModalApi.lock(false);
    }
  },
});

const [ConvertModal, convertModalApi] = useVbenModal({
  class: 'w-[min(520px,calc(100vw-20px))]',
  async onConfirm() {
    const storageCode = active_storage_code.value;
    const convertRemote = adapter.value?.convertRemote;
    const url = convert_url.value.trim();
    if (!convertRemote && !storageCode) {
      message.warning('请选择 storage');
      return;
    }
    if (!isHttpUrl(url)) {
      message.warning('请输入 http 或 https 开头的文件 URL');
      return;
    }

    convertModalApi.lock();
    try {
      const result = convertRemote
        ? await convertRemote(url)
        : await StorageFileApi.convertRemote(storageCode ?? '', url);
      await addUploadedResults([result]);
      const addedCount = result.file ? 1 : 0;
      message.success(
        addedCount > 0
          ? 'URL 已转存为文件并加入已选'
          : 'URL 已转存为文件，但不符合当前选择限制，未加入已选',
      );
      convertModalApi.close();
      page.value = 1;
      await loadFiles();
    } finally {
      convertModalApi.lock(false);
    }
  },
});

const [Modal, modalApi] = useVbenModal({
  centered: false,
  class: 'w-[min(1120px,calc(100vw-20px))]',
  contentClass: 'p-0',
  destroyOnClose: true,
  onClosed() {
    emit('closed');
  },
  async onConfirm() {
    if (selected.value.size === 0) {
      message.warning('请选择文件');
      return;
    }
    modalApi.lock();
    try {
      const selectedFiles = [...selected.value.values()];
      const result = selectedFiles.map((file) => ({
        ...toFileReference(file),
        file,
        preview_url: preview_urls.value.get(fileKey(file)),
      }));
      emit('confirm', result);
      modalApi.close();
    } finally {
      modalApi.lock(false);
    }
  },
  async onOpenChange(isOpen) {
    if (isOpen) await initialize();
  },
});

function fileKey(file: UploadFile) {
  return String(file.file_id);
}

function displayName(file: UploadFile) {
  return file.file_ext && !file.file_name.endsWith(`.${file.file_ext}`)
    ? `${file.file_name}.${file.file_ext}`
    : file.file_name;
}

function fileKind(file: UploadFile) {
  return fileKindFromExt(file.file_ext);
}

function fileMatchesActiveKind(file: UploadFile) {
  return (
    active_file_kind.value === 'all' ||
    fileKind(file) === active_file_kind.value
  );
}

function activeFileKindParam() {
  return active_file_kind.value === 'all' ? undefined : active_file_kind.value;
}

function cachePreviewUrl(file: UploadFile, url?: string) {
  if (!url) return;
  const next = new Map(preview_urls.value);
  next.set(fileKey(file), url);
  preview_urls.value = next;
}

async function loadPreviewUrls(records: UploadFile[]) {
  const previewable = records.filter((file) => fileKind(file) !== 'file');
  const missing = previewable.filter(
    (file) => !preview_urls.value.has(fileKey(file)),
  );
  if (missing.length === 0) return;
  try {
    const urls = adapter.value?.urls ?? StorageFileApi.urls;
    const access = await urls(missing.map((file) => file.file_id));
    const next = new Map(preview_urls.value);
    for (const item of access) next.set(String(item.file_id), item.url);
    preview_urls.value = next;
  } catch {
    // 预览 URL 获取失败不影响选择；确认时仍只返回稳定 file_id。
  }
}

function updateSelection(keys: Array<number | string>, rows: UploadFile[]) {
  const allowedKeys = new Set(keys.map(String));
  const next = new Map(
    [...selected.value].filter(([key]) => allowedKeys.has(key)),
  );
  for (const file of rows) {
    if (acceptsStoredFile(file, props.accept)) next.set(fileKey(file), file);
  }

  const limit = selection_limit.value;
  if (limit !== undefined && next.size > limit) {
    message.warning(`最多选择 ${limit} 个文件`);
    return;
  }
  if (!props.multiple && next.size > 1) {
    const last = [...next].at(-1);
    selected.value = new Map(last ? [last] : []);
    return;
  }
  selected.value = next;
}

function updateGridSelection() {
  const currentIds = new Set(files.value.map((file) => fileKey(file)));
  const retained = [...selected.value.values()].filter(
    (file) => !currentIds.has(fileKey(file)),
  );
  const checked = props.multiple
    ? gridApi.grid.getCheckboxRecords()
    : [gridApi.grid.getRadioRecord()].filter(Boolean);
  const rows = [...retained, ...checked] as UploadFile[];
  updateSelection(
    rows.map((file) => fileKey(file)),
    rows,
  );
}

async function syncGridRows(records: UploadFile[]) {
  await gridApi.grid.reloadData(records);
  await nextTick();
  const selectedOnPage = records.filter((file) =>
    selected.value.has(fileKey(file)),
  );
  await (props.multiple
    ? gridApi.grid.setCheckboxRow(selectedOnPage, true)
    : gridApi.grid.setRadioRow(selectedOnPage[0]));
}

async function loadGroups() {
  groups.value = useArticleAdapter.value ? [] : await StorageGroupApi.list();
}

async function loadFiles() {
  loading.value = true;
  try {
    if (adapter.value) {
      const result = await adapter.value.list({
        file_kind: activeFileKindParam(),
        name_prefix: name_prefix.value.trim() || undefined,
        page: page.value,
        size: page_size.value,
      });
      files.value = result.items;
      total.value = result.total;
      return;
    }
    if (active_group_id.value !== undefined) {
      const groupFiles = await StorageGroupApi.files(active_group_id.value);
      const keyword = name_prefix.value.trim().toLowerCase();
      const filtered = groupFiles.filter(
        (file) =>
          (!active_storage_code.value ||
            file.storage_code === active_storage_code.value) &&
          fileMatchesActiveKind(file) &&
          (!keyword || displayName(file).toLowerCase().includes(keyword)),
      );
      total.value = filtered.length;
      const start = (page.value - 1) * page_size.value;
      files.value = filtered.slice(start, start + page_size.value);
      return;
    }

    const result = await StorageFileApi.list({
      file_kind: activeFileKindParam(),
      name_prefix: name_prefix.value.trim() || undefined,
      page: page.value,
      size: page_size.value,
      storage_code: active_storage_code.value,
    });
    files.value = result.items;
    total.value = result.total;
  } finally {
    loading.value = false;
  }
}

async function initialize() {
  loading.value = true;
  selected.value = new Map();
  name_prefix.value = '';
  active_file_kind.value = 'all';
  page.value = 1;
  try {
    const [configs] = adapter.value
      ? [undefined]
      : await Promise.all([
          StorageConfigApi.list({ page: 1, size: 100 }),
          loadGroups(),
        ]);
    storage_options.value = adapter.value?.storageOptions
      ? await adapter.value.storageOptions()
      : (configs?.items ?? []).map((item) => ({
          label: item.storage_name,
          storage_type: item.storage_type,
          value: item.code,
        }));
    active_storage_code.value =
      props.storage_code ?? storage_options.value[0]?.value;
    active_group_id.value = useArticleAdapter.value
      ? undefined
      : props.group_id;
    syncUploadMode();

    const detailApi = adapter.value?.detail ?? StorageFileApi.detail;
    const initial = await Promise.allSettled(
      props.initial_file_ids.map((id) => detailApi(id)),
    );
    const next = new Map<string, UploadFile>();
    for (const result of initial) {
      if (
        result.status === 'fulfilled' &&
        acceptsStoredFile(result.value, props.accept)
      ) {
        next.set(fileKey(result.value), result.value);
      }
    }
    const limit = selection_limit.value;
    selected.value = new Map(
      [...next].slice(0, limit === undefined ? next.size : limit),
    );
    await loadFiles();
  } finally {
    loading.value = false;
  }
}

async function changeGroup(groupId?: FileId) {
  active_group_id.value = groupId;
  page.value = 1;
  await loadFiles();
}

async function changeStorage() {
  syncUploadMode();
  page.value = 1;
  await loadFiles();
}

function syncUploadMode() {
  active_upload_mode.value = direct_upload_supported.value ? 'direct' : 'serve';
}

async function changeFileKind() {
  page.value = 1;
  await loadFiles();
}

async function searchFiles() {
  page.value = 1;
  await loadFiles();
}

async function changePage(nextPage: number, nextSize: number) {
  page.value = nextSize === page_size.value ? nextPage : 1;
  page_size.value = nextSize;
  await loadFiles();
}

function openRename(file: UploadFile) {
  renaming_file.value = file;
  rename_value.value = displayName(file);
  renameModalApi.open();
}

function openCreateGroup() {
  group_name.value = '';
  group_code.value = '';
  groupModalApi.open();
}

function openConvertUrl() {
  convert_url.value = '';
  convertModalApi.open();
}

async function appendFilesToActiveGroup(uploaded: UploadFile[]) {
  if (
    useArticleAdapter.value ||
    active_group_id.value === undefined ||
    uploaded.length === 0
  )
    return;
  await StorageGroupApi.appendFiles(active_group_id.value, {
    file_ids: uploaded.map((item) => item.file_id),
  });
}

function addSelectedFiles(uploaded: UploadFile[]) {
  const next = props.multiple
    ? new Map(selected.value)
    : new Map<string, UploadFile>();
  const limit = selection_limit.value;
  let addedCount = 0;
  for (const file of uploaded) {
    if (!acceptsStoredFile(file, props.accept)) continue;
    if (limit !== undefined && next.size >= limit && !next.has(fileKey(file)))
      break;
    if (!next.has(fileKey(file))) addedCount += 1;
    next.set(fileKey(file), file);
  }
  selected.value = next;
  return addedCount;
}

async function addUploadedResults(results: FileUploadView[]) {
  const uploaded = results.map((item) => item.file);
  for (const item of results) cachePreviewUrl(item.file, item.url);
  await appendFilesToActiveGroup(uploaded);
  addSelectedFiles(uploaded);
  page.value = 1;
}

const directUpload = useDirectUpload({
  accept: () => props.accept,
  active_group_id,
  active_storage_code,
  addUploaded: addUploadedResults,
  presignComplete: adapter.value?.presignComplete,
  presignUpload: adapter.value?.presignUpload,
  reload: loadFiles,
});

async function uploadServerFile(file: File) {
  const storageCode = active_storage_code.value;
  const upload = adapter.value?.upload;
  if (!storageCode && !upload) throw new Error('请选择 storage');
  if (!acceptsBrowserFile(file, props.accept)) {
    throw new Error('文件类型不符合当前选择限制');
  }
  const result = upload
    ? await upload(file)
    : await StorageFileApi.upload(storageCode ?? '', file);
  await addUploadedResults(result);
  message.success('上传成功');
  await loadFiles();
  return result;
}

function showUploadError(
  mode: '服务端上传' | '本地直传',
  fileName: string,
  error: unknown,
) {
  notification.error({
    description: uploadErrorMessage(error),
    duration: 0,
    title: `${mode}失败：${fileName}`,
  });
}

const serverUploadRequest: NonNullable<UploadProps['customRequest']> = async (
  options,
) => {
  if (typeof options.file === 'string') {
    options.onError?.(new Error('请选择 storage'));
    return;
  }

  try {
    const result = await uploadServerFile(options.file as File);
    options.onSuccess?.(result);
  } catch (error) {
    const normalized =
      error instanceof Error ? error : new Error(uploadErrorMessage(error));
    showUploadError('服务端上传', (options.file as File).name, error);
    options.onError?.(normalized);
  }
};

async function uploadServerFiles(files: File[]) {
  for (const file of files) {
    await uploadServerFile(file);
  }
}

async function dropFiles(event: DragEvent) {
  drag_active.value = false;
  if (!active_storage_code.value || !event.dataTransfer) {
    message.warning('请选择 storage');
    return;
  }
  const files = await filesFromDataTransfer(event.dataTransfer);
  if (files.length === 0) {
    message.warning('没有可上传的文件');
    return;
  }
  try {
    const upload =
      direct_upload_supported.value && active_upload_mode.value === 'direct'
        ? directUpload.uploadFiles
        : uploadServerFiles;
    await upload(files);
  } catch (error) {
    const mode =
      direct_upload_supported.value && active_upload_mode.value === 'direct'
        ? '本地直传'
        : '服务端上传';
    showUploadError(
      mode,
      files.length === 1 ? (files[0]?.name ?? '文件') : '拖拽文件',
      error,
    );
  }
}

function open() {
  modalApi.open();
}

function close() {
  modalApi.close();
}

watch(files, (records) => {
  void loadPreviewUrls(records);
  void syncGridRows(records);
});
watch(loading, (value) => gridApi.setLoading(value), { immediate: true });

defineExpose<FilePickerExpose>({ close, open });
</script>

<template>
  <Modal title="选择文件">
    <div class="file-picker-layout">
      <aside v-if="!useArticleAdapter" class="file-picker-sidebar">
        <button
          v-if="!useArticleAdapter"
          class="file-picker-group"
          :class="{ 'is-active': active_group_id === undefined }"
          type="button"
          @click="changeGroup()"
        >
          <IconifyIcon class="size-4" icon="lucide:files" />
          <span>全部文件</span>
        </button>
        <button
          v-for="group in groups"
          :key="String(group.id)"
          class="file-picker-group"
          :class="{ 'is-active': String(active_group_id) === String(group.id) }"
          type="button"
          @click="changeGroup(group.id)"
        >
          <IconifyIcon class="size-4" icon="lucide:folder" />
          <span class="truncate">{{ group.group_name }}</span>
        </button>
        <Button
          v-if="!useArticleAdapter"
          class="mt-2 w-full justify-start"
          type="text"
          @click="openCreateGroup"
        >
          <template #icon>
            <IconifyIcon icon="lucide:folder-plus" />
          </template>
          创建分组
        </Button>
      </aside>

      <section class="file-picker-main">
        <div class="file-picker-toolbar">
          <Select
            v-if="
              !storage_locked &&
              (!useArticleAdapter || storage_options.length > 0)
            "
            v-model:value="active_storage_code"
            class="storage-select"
            :options="storage_options"
            placeholder="选择 storage"
            @change="changeStorage"
          />
          <span
            v-else-if="storage_options[0]"
            class="storage-select truncate text-sm text-muted-foreground"
            :title="storage_options[0].label"
          >
            {{ storage_options[0].label }}
          </span>
          <Select
            v-model:value="active_file_kind"
            class="file-kind-select"
            :options="fileKindOptions"
            placeholder="文件类型"
            @change="changeFileKind"
          />
          <InputSearch
            v-model:value="name_prefix"
            allow-clear
            class="min-w-44 flex-1"
            placeholder="搜索文件名"
            @search="searchFiles"
          />
          <Select
            v-if="!useArticleAdapter"
            v-model:value="active_upload_mode"
            class="upload-mode-select"
            :disabled="available_upload_mode_options.length === 1"
            :options="available_upload_mode_options"
            placeholder="上传方式"
          />
          <Button :disabled="!active_storage_code" @click="openConvertUrl">
            <template #icon>
              <IconifyIcon icon="lucide:link" />
            </template>
            URL 转存
          </Button>
          <template
            v-if="direct_upload_supported && active_upload_mode === 'direct'"
          >
            <Upload
              :accept="upload_accept || undefined"
              :custom-request="directUpload.request"
              :multiple="multiple"
              :show-upload-list="false"
            >
              <Button type="primary" :disabled="!active_storage_code">
                <template #icon>
                  <IconifyIcon icon="lucide:hard-drive-upload" />
                </template>
                本地直传
              </Button>
            </Upload>
            <Upload
              directory
              :accept="upload_accept || undefined"
              :custom-request="directUpload.request"
              :multiple="true"
              :show-upload-list="false"
              @change="directUpload.handleFolderChange"
            >
              <Button :disabled="!active_storage_code">
                <template #icon>
                  <IconifyIcon icon="lucide:folder-up" />
                </template>
                上传文件夹
              </Button>
            </Upload>
          </template>
          <Upload
            v-else
            :accept="upload_accept || undefined"
            :custom-request="serverUploadRequest"
            :multiple="multiple"
            :show-upload-list="false"
          >
            <Button type="primary" :disabled="!active_storage_code">
              <template #icon>
                <IconifyIcon icon="lucide:upload" />
              </template>
              服务端上传
            </Button>
          </Upload>
        </div>
        <div v-if="directUpload.visible.value" class="direct-upload-progress">
          <div
            class="flex items-center justify-between gap-3 text-xs text-gray-500"
          >
            <span class="truncate">
              正在上传：{{ directUpload.current_name.value || '文件' }}
            </span>
            <span class="shrink-0">
              {{ directUpload.done.value }}/{{ directUpload.total.value || 1 }}
            </span>
          </div>
          <Progress
            :percent="directUpload.percent.value"
            size="small"
            status="active"
          />
        </div>

        <div
          class="file-drop-zone"
          :class="{
            'is-active': drag_active,
            'is-disabled': !active_storage_code,
          }"
          @dragenter.prevent="drag_active = true"
          @dragleave.prevent="drag_active = false"
          @dragover.prevent
          @drop.prevent="dropFiles"
        >
          <IconifyIcon class="size-4" icon="lucide:cloud-upload" />
          <span>拖拽文件或文件夹上传</span>
        </div>

        <Grid>
          <template #fileName="{ row }">
            <div class="flex min-w-0 items-center gap-2">
              <div class="file-picker-thumb">
                <Image
                  v-if="
                    fileKind(row) === 'image' && preview_urls.get(fileKey(row))
                  "
                  :src="preview_urls.get(fileKey(row))"
                  :width="40"
                  :height="40"
                />
                <video
                  v-else-if="
                    fileKind(row) === 'video' && preview_urls.get(fileKey(row))
                  "
                  class="file-picker-video"
                  :src="preview_urls.get(fileKey(row))"
                  muted
                  controls
                ></video>
                <IconifyIcon
                  v-else
                  class="size-4 shrink-0 text-muted-foreground"
                  :icon="
                    fileKind(row) === 'video' ? 'lucide:film' : 'lucide:file'
                  "
                />
              </div>
              <span class="truncate" :title="displayName(row)">
                {{ displayName(row) }}
              </span>
            </div>
          </template>
          <template #size="{ row }">{{ formatFileSize(row.size) }}</template>
          <template #actions="{ row }">
            <template v-if="!useArticleAdapter">
              <Tooltip title="编辑文件名">
                <Button
                  shape="circle"
                  size="small"
                  type="text"
                  @click="openRename(row)"
                >
                  <template #icon>
                    <IconifyIcon icon="lucide:pencil" />
                  </template>
                </Button>
              </Tooltip>
            </template>
          </template>
        </Grid>

        <div class="file-picker-footer">
          <span>已选 {{ selected_count }} 项</span>
          <Pagination
            v-model:current="page"
            v-model:page-size="page_size"
            :show-size-changer="true"
            :total="total"
            size="small"
            @change="changePage"
          />
        </div>
      </section>
    </div>
  </Modal>

  <RenameModal title="编辑文件名">
    <div class="px-1 py-2">
      <Input
        v-model:value="rename_value"
        ::maxlength="255"
        placeholder="文件名"
      />
    </div>
  </RenameModal>

  <GroupModal title="创建分组">
    <div class="grid gap-3 px-1 py-2 sm:grid-cols-2">
      <Input
        v-model:value="group_name"
        ::maxlength="80"
        placeholder="分组名称"
      />
      <Input
        v-model:value="group_code"
        ::maxlength="80"
        placeholder="分组编码"
      />
    </div>
  </GroupModal>

  <ConvertModal title="URL 转存文件">
    <div class="grid gap-2 px-1 py-2">
      <Input
        v-model:value="convert_url"
        placeholder="请输入 http 或 https 文件 URL"
      />
      <div class="text-xs text-muted-foreground">
        系统会将远程 URL 下载并存入当前 storage，业务字段仍保存稳定文件
        ID，不保存临时访问地址。
      </div>
    </div>
  </ConvertModal>
</template>

<style src="./file-picker.css" scoped></style>
