<script lang="ts" setup>
import type { MenuProps } from 'antdv-next';
import type { Dayjs } from 'dayjs';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { FileShareAccessView, FileShareView } from '#/api/storage';
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
  Drawer,
  Dropdown,
  Input,
  InputNumber,
  message,
  Modal,
  Pagination,
  Segmented,
  Space,
  Switch,
  Table,
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

const shareSortFields = [
  'created_at',
  'download_count',
  'expires_at',
  'file_name',
  'id',
  'view_count',
];
const filePickerRef = ref<FilePickerExpose>();
const selectedFiles = ref<SelectedStorageFile[]>([]);
const createTitle = ref('');
const createPreset = ref<ExpiryPreset>(15);
const createExpiry = ref<Dayjs>();
const createDownloadStart = ref<Dayjs>();
const createImmediate = ref(true);
const createUnlimited = ref(true);
const createDownloadLimit = ref(10);
const editingShare = ref<FileShareView>();
const editingExpiry = ref<Dayjs>();
const policyStart = ref<Dayjs>();
const policyImmediate = ref(true);
const policyUnlimited = ref(true);
const policyLimit = ref(10);
const accessOpen = ref(false);
const accessLoading = ref(false);
const accessShare = ref<FileShareView>();
const accessRows = ref<FileShareAccessView[]>([]);
const accessPage = ref(1);
const accessTotal = ref(0);

const expiryOptions = [
  { label: '+7 天', value: 7 },
  { label: '+15 天', value: 15 },
  { label: '+30 天', value: 30 },
  { label: '自定义', value: 'custom' },
];

const selectedFileName = computed(() =>
  selectedFiles.value.length > 0
    ? `${selectedFiles.value.length} 个文件：${selectedFiles.value
        .slice(0, 3)
        .map((item) => displayFileName(item.file))
        .join('、')}${selectedFiles.value.length > 3 ? '…' : ''}`
    : '',
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
  title: '新增文件分享',
  async onConfirm() {
    if (selectedFiles.value.length === 0) {
      message.warning('请选择或上传文件');
      return;
    }
    const expiresAt = selectedExpiry();
    if (!expiresAt || expiresAt <= dayjs().unix()) {
      message.warning('请选择未来的过期时间');
      return;
    }
    const downloadStartAt = createImmediate.value
      ? 0
      : createDownloadStart.value?.unix();
    if (
      downloadStartAt === undefined ||
      downloadStartAt < 0 ||
      (downloadStartAt > 0 && downloadStartAt >= expiresAt)
    ) {
      message.warning('开始下载时间必须早于过期时间');
      return;
    }
    const downloadLimit = createUnlimited.value ? 0 : createDownloadLimit.value;
    if (downloadLimit < 1 && !createUnlimited.value) {
      message.warning('下载次数必须大于 0');
      return;
    }
    createModalApi.lock();
    try {
      await StorageFileShareApi.create({
        expires_at: expiresAt,
        file_ids: selectedFiles.value.map((item) => item.file.file_id),
        file_name: createTitle.value.trim() || undefined,
        download_start_at: downloadStartAt,
        download_limit: downloadLimit,
      });
      message.success('分享链接已创建');
      createModalApi.close();
      await gridApi.query();
    } finally {
      createModalApi.lock(false);
    }
  },
});

const [PolicyModal, policyModalApi] = useVbenModal({
  class: 'w-[min(520px,calc(100vw-20px))]',
  connectedComponent: ContentModal,
  destroyOnClose: true,
  title: '下载策略',
  async onConfirm() {
    const share = editingShare.value;
    if (!share) return;
    const startAt = policyImmediate.value ? 0 : policyStart.value?.unix();
    if (
      startAt === undefined ||
      startAt < 0 ||
      (startAt > 0 && startAt >= Number(share.expires_at))
    ) {
      message.warning('开始下载时间必须早于过期时间');
      return;
    }
    const limit = policyUnlimited.value ? 0 : policyLimit.value;
    if (limit > 0 && limit < Number(share.download_count)) {
      message.warning('总下载次数不能小于已下载次数');
      return;
    }
    policyModalApi.lock();
    try {
      await StorageFileShareApi.setDownloadPolicy(share.id, {
        download_limit: limit,
        download_start_at: startAt,
      });
      message.success('下载策略已更新');
      policyModalApi.close();
      await gridApi.query();
    } finally {
      policyModalApi.lock(false);
    }
  },
});

const [ExpiryModal, expiryModalApi] = useVbenModal({
  class: 'w-[min(480px,calc(100vw-20px))]',
  connectedComponent: ContentModal,
  destroyOnClose: true,
  title: '修改过期时间',
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
  selectedFiles.value = [];
  createTitle.value = '';
  createPreset.value = 15;
  createExpiry.value = dayjs().add(15, 'day');
  createImmediate.value = true;
  createDownloadStart.value = dayjs();
  createUnlimited.value = true;
  createDownloadLimit.value = 10;
  createModalApi.open();
}

function openFilePicker() {
  filePickerRef.value?.open();
}

function handleFileSelected(files: SelectedStorageFile[]) {
  selectedFiles.value = files;
}

function openPolicy(row: FileShareView) {
  editingShare.value = row;
  policyImmediate.value = Number(row.download_start_at) === 0;
  policyStart.value = policyImmediate.value
    ? dayjs()
    : dayjs.unix(Number(row.download_start_at));
  policyUnlimited.value = Number(row.download_limit) === 0;
  policyLimit.value = policyUnlimited.value ? 10 : Number(row.download_limit);
  policyModalApi.open();
}

async function addDownloads(row: FileShareView, count: number) {
  await StorageFileShareApi.addDownloads(row.id, count);
  message.success(`已增加 ${count} 次下载额度`);
  await gridApi.query();
}

async function openAccess(row: FileShareView) {
  accessShare.value = row;
  accessOpen.value = true;
  await loadAccess(1);
}

async function loadAccess(page: number) {
  const share = accessShare.value;
  if (!share) return;
  accessPage.value = page;
  accessLoading.value = true;
  try {
    const result = await StorageFileShareApi.access(share.id, {
      page,
      size: 50,
    });
    accessRows.value = result.items;
    accessTotal.value = Number(result.total);
  } finally {
    accessLoading.value = false;
  }
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
    <CreateModal>
      <div class="share-form">
        <div class="form-field">
          <span class="field-label">分享标题</span>
          <Input
            v-model:value="createTitle"
            :maxlength="255"
            placeholder="单文件默认使用文件名，多文件默认使用文件数量"
          />
        </div>
        <div class="form-field">
          <span class="field-label">文件（可多选）</span>
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
        <div class="two-fields">
          <div class="form-field">
            <span class="field-label">立即允许下载</span>
            <Switch v-model:checked="createImmediate" />
          </div>
          <div class="form-field">
            <span class="field-label">不限下载次数</span>
            <Switch v-model:checked="createUnlimited" />
          </div>
        </div>
        <div v-if="!createImmediate" class="form-field">
          <span class="field-label">开始下载时间</span>
          <DatePicker
            v-model:value="createDownloadStart"
            class="w-full"
            :disabled-date="disablePastDate"
            format="YYYY-MM-DD HH:mm"
            show-time
          />
        </div>
        <div v-if="!createUnlimited" class="form-field">
          <span class="field-label">总下载次数</span>
          <InputNumber
            v-model:value="createDownloadLimit"
            class="w-full"
            :min="1"
          />
        </div>
      </div>
    </CreateModal>

    <ExpiryModal>
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

    <PolicyModal>
      <div class="share-form">
        <div class="form-field">
          <span class="field-label">分享</span>
          <span>{{ editingShare?.file_name }}</span>
        </div>
        <div class="two-fields">
          <div class="form-field">
            <span class="field-label">立即允许下载</span>
            <Switch v-model:checked="policyImmediate" />
          </div>
          <div class="form-field">
            <span class="field-label">不限下载次数</span>
            <Switch v-model:checked="policyUnlimited" />
          </div>
        </div>
        <div v-if="!policyImmediate" class="form-field">
          <span class="field-label">开始下载时间</span>
          <DatePicker
            v-model:value="policyStart"
            class="w-full"
            format="YYYY-MM-DD HH:mm"
            show-time
          />
        </div>
        <div v-if="!policyUnlimited" class="form-field">
          <span class="field-label">总下载次数</span>
          <InputNumber
            v-model:value="policyLimit"
            class="w-full"
            :min="Number(editingShare?.download_count || 1)"
          />
        </div>
      </div>
    </PolicyModal>

    <Drawer
      v-model:open="accessOpen"
      size="large"
      :title="`访问明细 · ${accessShare?.file_name || ''}`"
    >
      <Table
        :columns="[
          { title: 'IP', dataIndex: 'client_ip', width: 180 },
          { title: '查看', dataIndex: 'view_count', width: 80 },
          { title: '下载', dataIndex: 'download_count', width: 80 },
          { title: '最近查看', dataIndex: 'last_viewed_at' },
          { title: '最近下载', dataIndex: 'last_downloaded_at' },
        ]"
        :data-source="accessRows"
        :loading="accessLoading"
        :pagination="false"
        row-key="client_ip"
        size="small"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'last_viewed_at'">
            {{
              Number(record.last_viewed_at) > 0
                ? Times.formatUnix(record.last_viewed_at)
                : '-'
            }}
          </template>
          <template v-else-if="column.dataIndex === 'last_downloaded_at'">
            {{
              Number(record.last_downloaded_at) > 0
                ? Times.formatUnix(record.last_downloaded_at)
                : '-'
            }}
          </template>
        </template>
      </Table>
      <Pagination
        v-if="accessTotal > 50"
        v-model:current="accessPage"
        class="mt-4 text-right"
        :page-size="50"
        :show-size-changer="false"
        :total="accessTotal"
        @change="loadAccess"
      />
    </Drawer>

    <FilePicker
      ref="filePickerRef"
      :max_count="100"
      multiple
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
          <small>{{ row.file_count }} 个文件</small>
        </a>
        <span v-else class="block min-w-0 truncate" :title="row.file_name">
          {{ row.file_name }}
          <small>{{ row.file_count }} 个文件</small>
        </span>
      </template>

      <template #statusCell="{ row }">
        <Tag :color="shareStatus(row).color">
          {{ shareStatus(row).label }}
        </Tag>
      </template>

      <template #usageCell="{ row }">
        <div class="usage-cell">
          <Button type="link" class="px-0" @click.stop="openAccess(row)">
            {{ row.view_count }} 查看
          </Button>
          <span>{{ row.download_count }} 下载</span>
          <span> 剩余 {{ row.remaining_download_count ?? '不限' }} </span>
          <template v-if="Number(row.download_limit) > 0">
            <Button size="small" @click.stop="addDownloads(row, 10)">
              +10
            </Button>
            <Button size="small" @click.stop="addDownloads(row, 100)">
              +100
            </Button>
          </template>
        </div>
      </template>

      <template #downloadPolicyCell="{ row }">
        <Button class="px-0" type="link" @click.stop="openPolicy(row)">
          {{
            Number(row.download_start_at) === 0
              ? '立即下载'
              : Times.formatUnix(row.download_start_at)
          }}
        </Button>
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
.usage-cell,
.url-cell {
  display: flex;
  gap: 8px;
  align-items: center;
  min-width: 0;
}

.two-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.usage-cell {
  flex-wrap: wrap;
}

.selected-file,
.url-value {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.management-grid small {
  display: block;
  font-size: 12px;
  color: var(--vben-text-color-secondary);
}

.url-value {
  flex: 1;
  font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 12px;
}

@media (max-width: 640px) {
  .two-fields {
    grid-template-columns: 1fr;
  }
}
</style>
