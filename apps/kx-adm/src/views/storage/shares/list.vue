<script lang="ts" setup>
import type { MenuProps } from 'antdv-next';
import type { Dayjs } from 'dayjs';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { FileShareView } from '#/api/storage';
import type {
  FilePickerExpose,
  SelectedStorageFile,
} from '#/components/file-picker';

import { computed, ref } from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';
import { Copy, Plus } from '@vben/icons';

import {
  Button,
  DatePicker,
  Dropdown,
  message,
  Modal,
  Segmented,
  Space,
  Tag,
  Tooltip,
} from 'antdv-next';
import dayjs from 'dayjs';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { StorageFileShareApi } from '#/api/storage';
import { FilePicker } from '#/components/file-picker';
import { Times } from '#/times';
import { useVxeRowContextMenu } from '#/views/_shared/use-vxe-row-context-menu';
import { vxeSortParams } from '#/vxe-sort';

import { useColumns, useFormSchema } from './data';
import ContentModal from './modules/modal.vue';

type ExpiryPreset = 7 | 15 | 30 | 'custom';

const shareSortFields = ['created_at', 'expires_at', 'file_name', 'id'];
const filePickerRef = ref<FilePickerExpose>();
const selectedFile = ref<SelectedStorageFile>();
const createPreset = ref<ExpiryPreset>(15);
const createExpiry = ref<Dayjs>();
const editingShare = ref<FileShareView>();
const editingExpiry = ref<Dayjs>();

const expiryOptions = [
  { label: '+7 天', value: 7 },
  { label: '+15 天', value: 15 },
  { label: '+30 天', value: 30 },
  { label: '自定义', value: 'custom' },
];

const selectedFileName = computed(() =>
  selectedFile.value ? displayFileName(selectedFile.value.file) : '',
);

const contextMenuItems: MenuProps['items'] = [
  { danger: true, key: 'delete', label: '删除分享' },
];
const rowContextMenu = useVxeRowContextMenu<FileShareView>(
  contextMenuItems,
  (key, row) => {
    if (key === 'delete') confirmDelete(row);
  },
);

const [CreateModal, createModalApi] = useVbenModal({
  class: 'w-[min(560px,calc(100vw-20px))]',
  connectedComponent: ContentModal,
  destroyOnClose: true,
  async onConfirm() {
    const file = selectedFile.value?.file;
    if (!file) {
      message.warning('请选择或上传文件');
      return;
    }
    const expiresAt = selectedExpiry();
    if (!expiresAt || expiresAt <= dayjs().unix()) {
      message.warning('请选择未来的过期时间');
      return;
    }
    createModalApi.lock();
    try {
      await StorageFileShareApi.create({
        expires_at: expiresAt,
        file_id: file.file_id,
        file_name: displayFileName(file),
      });
      message.success('分享链接已创建');
      createModalApi.close();
      await gridApi.query();
    } finally {
      createModalApi.lock(false);
    }
  },
});

const [ExpiryModal, expiryModalApi] = useVbenModal({
  class: 'w-[min(480px,calc(100vw-20px))]',
  connectedComponent: ContentModal,
  destroyOnClose: true,
  async onConfirm() {
    const share = editingShare.value;
    const expiresAt = editingExpiry.value?.unix();
    if (!share || !expiresAt || expiresAt <= dayjs().unix()) {
      message.warning('请选择未来的过期时间');
      return;
    }
    expiryModalApi.lock();
    try {
      await StorageFileShareApi.setExpiry(share.id, expiresAt);
      message.success('过期时间已更新');
      expiryModalApi.close();
      await gridApi.query();
    } finally {
      expiryModalApi.lock(false);
    }
  },
});

const [Grid, gridApi] = useVbenVxeGrid<FileShareView>({
  formOptions: {
    schema: useFormSchema(),
    submitOnChange: true,
  },
  gridOptions: {
    columns: useColumns(),
    height: 'auto',
    pagerConfig: {
      pageSize: 20,
      pageSizes: [10, 20, 50, 100],
    },
    proxyConfig: {
      ajax: {
        query: async (params, formValues) => {
          const { page } = params;
          const result = await StorageFileShareApi.list({
            ...formValues,
            ...vxeSortParams(params, shareSortFields),
            page: page.currentPage,
            size: page.pageSize,
          });
          return { items: result.items, total: result.total };
        },
      },
    },
    rowConfig: { keyField: 'id' },
    sortConfig: { remote: true },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<FileShareView>,
});

function selectedExpiry() {
  if (createPreset.value === 'custom') return createExpiry.value?.unix();
  return dayjs().add(createPreset.value, 'day').unix();
}

function openCreate() {
  selectedFile.value = undefined;
  createPreset.value = 15;
  createExpiry.value = dayjs().add(15, 'day');
  createModalApi.open();
}

function openFilePicker() {
  filePickerRef.value?.open();
}

function handleFileSelected(files: SelectedStorageFile[]) {
  selectedFile.value = files[0];
}

function openExpiry(row: FileShareView) {
  editingShare.value = row;
  editingExpiry.value = dayjs.unix(Number(row.expires_at));
  expiryModalApi.open();
}

async function extend(row: FileShareView, days = 15) {
  await StorageFileShareApi.extend(row.id, days);
  message.success(`有效期已延长 ${days} 天`);
  await gridApi.query();
}

async function copyShareUrl(row: FileShareView) {
  const url = absoluteUrl(row.share_url);
  await navigator.clipboard.writeText(url);
  message.success('分享链接已复制');
}

function confirmDelete(row: FileShareView) {
  Modal.confirm({
    async onOk() {
      await StorageFileShareApi.remove(row.id);
      message.success('分享已删除');
      await gridApi.query();
    },
    okText: '删除',
    okType: 'danger',
    title: `确认删除分享「${row.file_name}」？`,
  });
}

function absoluteUrl(url: string) {
  try {
    return new URL(url, globalThis.location?.origin).toString();
  } catch {
    return url;
  }
}

function displayFileName(file: { file_ext: string; file_name: string }) {
  return file.file_ext && !file.file_name.endsWith(`.${file.file_ext}`)
    ? `${file.file_name}.${file.file_ext}`
    : file.file_name;
}

function formatBytes(value: number | string) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size >= 10 || unitIndex === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[unitIndex]}`;
}

function remaining(expiresAt: number | string) {
  const seconds = Number(expiresAt) - dayjs().unix();
  if (seconds <= 0) return '已过期';
  const days = Math.floor(seconds / 86_400);
  if (days > 0) return `${days} 天`;
  const hours = Math.max(1, Math.ceil(seconds / 3600));
  return `${hours} 小时`;
}

function shareStatus(row: FileShareView) {
  if (row.expired) return { color: 'default', label: '已过期' };
  const seconds = Number(row.expires_at) - dayjs().unix();
  if (seconds <= 3 * 86_400) return { color: 'warning', label: '即将过期' };
  return { color: 'success', label: '有效' };
}

function disablePastDate(current: Dayjs) {
  return current.endOf('day').isBefore(dayjs());
}
</script>

<template>
  <Page
    auto-content-height
    class="management-page"
    content-class="management-content"
    title="文件分享"
  >
    <CreateModal title="新增文件分享">
      <div class="share-form">
        <div class="form-field">
          <span class="field-label">文件</span>
          <div class="file-selection">
            <Button type="primary" ghost @click="openFilePicker">
              选择 / 上传文件
            </Button>
            <span class="selected-file" :title="selectedFileName">
              {{ selectedFileName || '未选择' }}
            </span>
          </div>
        </div>
        <div class="form-field">
          <span class="field-label">有效期</span>
          <Segmented v-model:value="createPreset" :options="expiryOptions" />
        </div>
        <div v-if="createPreset === 'custom'" class="form-field">
          <span class="field-label">过期时间</span>
          <DatePicker
            v-model:value="createExpiry"
            class="w-full"
            :disabled-date="disablePastDate"
            format="YYYY-MM-DD HH:mm"
            show-time
          />
        </div>
      </div>
    </CreateModal>

    <ExpiryModal title="修改过期时间">
      <div class="share-form">
        <div class="form-field">
          <span class="field-label">文件</span>
          <span>{{ editingShare?.file_name }}</span>
        </div>
        <div class="form-field">
          <span class="field-label">过期时间</span>
          <DatePicker
            v-model:value="editingExpiry"
            class="w-full"
            :disabled-date="disablePastDate"
            format="YYYY-MM-DD HH:mm"
            show-time
          />
        </div>
      </div>
    </ExpiryModal>

    <FilePicker
      ref="filePickerRef"
      :max_count="1"
      @confirm="handleFileSelected"
    />

    <Grid class="management-grid" table-title="文件分享">
      <Dropdown
        :menu="rowContextMenu.menu.value"
        :open="rowContextMenu.open.value"
        :trigger="['click']"
        @open-change="rowContextMenu.onOpenChange"
      >
        <span
          class="fixed size-0 overflow-hidden"
          :style="rowContextMenu.anchorStyle.value"
        ></span>
      </Dropdown>

      <template #fileNameCell="{ row }">
        <a
          v-if="!row.expired"
          class="block min-w-0 truncate"
          :href="row.share_url"
          rel="noopener noreferrer"
          target="_blank"
        >
          {{ row.file_name }}
        </a>
        <span v-else class="block min-w-0 truncate" :title="row.file_name">
          {{ row.file_name }}
        </span>
      </template>

      <template #statusCell="{ row }">
        <Tag :color="shareStatus(row).color">
          {{ shareStatus(row).label }}
        </Tag>
      </template>

      <template #expiryCell="{ row }">
        <div class="expiry-cell">
          <Button
            class="min-w-0 px-0"
            type="link"
            @click.stop="openExpiry(row)"
          >
            {{ Times.formatUnix(row.expires_at) }}
          </Button>
          <Tag :color="row.expired ? 'default' : 'processing'">
            {{ remaining(row.expires_at) }}
          </Tag>
          <Button size="small" @click.stop="extend(row, 15)">+15 天</Button>
        </div>
      </template>

      <template #shareUrlCell="{ row }">
        <div class="url-cell">
          <span class="url-value" :title="absoluteUrl(row.share_url)">
            {{ absoluteUrl(row.share_url) }}
          </span>
          <Tooltip title="复制分享链接">
            <Button
              aria-label="复制分享链接"
              size="small"
              type="text"
              @click.stop="copyShareUrl(row)"
            >
              <Copy class="size-4" />
            </Button>
          </Tooltip>
        </div>
      </template>

      <template #sizeCell="{ row }">
        {{ formatBytes(row.size) }}
      </template>

      <template #createdAtCell="{ row }">
        {{ Times.formatUnix(row.created_at) }}
      </template>

      <template #toolbar-tools>
        <Space size="small">
          <Button type="primary" @click="openCreate">
            <Plus class="size-4" />
            新增分享
          </Button>
        </Space>
      </template>
    </Grid>
  </Page>
</template>

<style scoped>
.share-form {
  display: grid;
  gap: 18px;
  padding: 4px;
}

.form-field {
  display: grid;
  gap: 8px;
}

.field-label {
  font-size: 13px;
  font-weight: 500;
}

.file-selection,
.expiry-cell,
.url-cell {
  display: flex;
  gap: 8px;
  align-items: center;
  min-width: 0;
}

.selected-file,
.url-value {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.url-value {
  flex: 1;
  font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 12px;
}
</style>
