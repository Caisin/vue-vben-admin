<script lang="ts" setup>
import type { MenuProps } from 'antdv-next';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { UploadFile } from '#/api';
import type { SystemUser } from '#/api/system/user';
import type {
  FilePickerExpose,
  SelectedStorageFile,
} from '#/components/file-picker';

import { computed, nextTick, onMounted, ref } from 'vue';

import { useAccess } from '@vben/access';
import { Page, useVbenModal } from '@vben/common-ui';
import { Link2, Plus } from '@vben/icons';
import { downloadFileFromBlob } from '@vben/utils';

import {
  Button,
  Dropdown,
  message,
  Modal,
  Select,
  Space,
  Tag,
} from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { StorageConfigApi, StorageFileApi } from '#/api';
import { SystemUserApi } from '#/api/system/user';
import { FilePicker } from '#/components/file-picker';
import { useVxeRowContextMenu } from '#/views/_shared/use-vxe-row-context-menu';
import { vxeSortParams } from '#/vxe-sort';

import { useColumns, useFormSchema } from './data';
import ContentModal from './modules/modal.vue';

const fileSortFields = ['file_id', 'file_name', 'size', 'created_at'];
const { hasAccessByCodes } = useAccess();
const canViewAllFiles = computed(() =>
  hasAccessByCodes(['storage:files:view-all']),
);

const storage_code = ref<string>();
const storage_options = ref<Array<{ label: string; value: string }>>([]);
const userOptions = ref<Array<{ label: string; value: number }>>([]);
const userLabelMap = ref(new Map<string, string>());
const filePickerRef = ref<FilePickerExpose>();
const fileContextMenuItems: MenuProps['items'] = [
  { danger: true, key: 'delete', label: '删除' },
];
const fileRowContextMenu = useVxeRowContextMenu<UploadFile>(
  fileContextMenuItems,
  (key, row) => {
    if (key === 'delete') confirmDeleteFile(row);
  },
);

const [RemoteForm, remoteFormApi] = useVbenForm({
  layout: 'vertical',
  wrapperClass: 'grid-cols-1',
  schema: [
    {
      component: 'Input',
      componentProps: { placeholder: 'https://example.com/file.png' },
      fieldName: 'url',
      formItemClass: 'col-span-1',
      label: '远程文件地址',
      rules: 'required',
    },
  ],
  showDefaultActions: false,
});

const [RemoteModal, remoteModalApi] = useVbenModal({
  connectedComponent: ContentModal,
  destroyOnClose: true,
  async onConfirm() {
    const { valid } = await remoteFormApi.validate();
    if (!valid || !storage_code.value) return;

    remoteModalApi.lock();
    try {
      const { url } = await remoteFormApi.getValues();
      await StorageFileApi.convertRemote(storage_code.value, String(url));
      message.success('远程文件转存成功');
      remoteModalApi.close();
      await gridApi.query();
    } finally {
      remoteModalApi.lock(false);
    }
  },
});

const [Grid, gridApi] = useVbenVxeGrid<UploadFile>({
  formOptions: {
    schema: useFormSchema(canViewAllFiles.value),
    submitOnChange: true,
  },
  gridOptions: {
    columns: useColumns(
      (uid) => userLabelMap.value.get(String(uid)) ?? `用户 #${uid}`,
    ),
    height: 'auto',
    pagerConfig: {
      pageSize: 20,
      pageSizes: [10, 20, 50, 100],
    },
    proxyConfig: {
      ajax: {
        query: async (params, formValues) => {
          const { page } = params;
          const result = await StorageFileApi.list({
            ...formValues,
            created_by:
              Number(formValues.created_by) > 0
                ? Number(formValues.created_by)
                : undefined,
            ...vxeSortParams(params, fileSortFields),
            page: page.currentPage,
            size: page.pageSize,
          });
          return { items: result.items, total: result.total };
        },
      },
    },
    sortConfig: { remote: true },
    rowConfig: { keyField: 'file_id' },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<UploadFile>,
});

async function downloadFile(row: UploadFile) {
  const blob = await StorageFileApi.download(row.file_id);
  downloadFileFromBlob({ fileName: displayName(row), source: blob });
}

async function deleteFile(row: UploadFile) {
  await StorageFileApi.remove(row.file_id);
  message.success('删除成功');
  await gridApi.query();
}

function confirmDeleteFile(row: UploadFile) {
  Modal.confirm({
    async onOk() {
      await deleteFile(row);
    },
    okText: '删除',
    okType: 'danger',
    title: `确认删除文件「${displayName(row)}」？`,
  });
}

function displayName(file: UploadFile) {
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
  const display =
    size >= 10 || unitIndex === 0 ? size.toFixed(0) : size.toFixed(1);
  return `${display} ${units[unitIndex]}`;
}

async function openRemoteModal() {
  if (!storage_code.value) {
    message.warning('请先选择存储配置');
    return;
  }
  remoteModalApi.open();
  await nextTick();
  await remoteFormApi.reset();
}

function openFilePicker() {
  filePickerRef.value?.open();
}

async function handleFilesSelected(files: SelectedStorageFile[]) {
  message.success(`已选择 ${files.length} 个文件`);
  await gridApi.query();
}

async function loadUserOptions() {
  if (!canViewAllFiles.value) return;
  const users: SystemUser[] = [];
  let page = 1;
  let total = Number.POSITIVE_INFINITY;
  while (users.length < total) {
    const result = await SystemUserApi.options({ page, pageSize: 100 });
    users.push(...result.items);
    total = result.total;
    if (result.items.length === 0) break;
    page += 1;
  }
  userOptions.value = users.map((user) => ({
    label: `${user.name || user.id}（${user.id}）`,
    value: Number(user.id),
  }));
  userLabelMap.value = new Map(
    users.map((user) => [String(user.id), user.name || `用户 #${user.id}`]),
  );
  await gridApi.formApi.updateSchema(useFormSchema(true, userOptions.value));
}

onMounted(async () => {
  await loadUserOptions();
  const result = await StorageConfigApi.list({ page: 1, size: 100 });
  storage_options.value = result.items.map((item) => ({
    label: item.storage_name,
    value: item.code,
  }));
  storage_code.value = storage_options.value[0]?.value;
  await fileRowContextMenu.bind(gridApi.grid);
});
</script>

<template>
  <Page
    auto-content-height
    class="management-page"
    content-class="management-content"
    title="文件管理"
  >
    <FilePicker
      ref="filePickerRef"
      multiple
      :storage_code="storage_code"
      @confirm="handleFilesSelected"
    />
    <RemoteModal title="远程文件转存">
      <RemoteForm class="mx-1" />
    </RemoteModal>

    <div class="storage-context">
      <span>当前存储</span>
      <Tag :color="storage_code ? 'processing' : 'warning'">
        {{ storage_code || '未选择' }}
      </Tag>
    </div>

    <Grid class="management-grid" table-title="文件管理">
      <Dropdown
        :menu="fileRowContextMenu.menu.value"
        :open="fileRowContextMenu.open.value"
        :trigger="['click']"
        @open-change="fileRowContextMenu.onOpenChange"
      >
        <span
          class="fixed size-0 overflow-hidden"
          :style="fileRowContextMenu.anchorStyle.value"
        ></span>
      </Dropdown>
      <template #fileNameCell="{ row }">
        <div class="flex min-w-0 items-center gap-2">
          <Button
            class="min-w-0 truncate px-0 text-left"
            size="small"
            type="link"
            @click.stop="downloadFile(row)"
          >
            {{ displayName(row) }}
          </Button>
        </div>
      </template>
      <template #sizeCell="{ row }">
        <Tag>{{ formatBytes(row.size) }}</Tag>
      </template>
      <template #md5Cell="{ row }">
        <span class="hash-preview" :title="row.md5_hash">
          {{ row.md5_hash || '-' }}
        </span>
      </template>
      <template #toolbar-tools>
        <Space wrap size="small">
          <Select
            v-model:value="storage_code"
            class="w-44"
            :options="storage_options"
            placeholder="选择存储配置"
          />
          <Button
            type="primary"
            :disabled="!storage_code"
            @click="openFilePicker"
          >
            <Plus class="size-4" />
            选择 / 上传
          </Button>
          <Button :disabled="!storage_code" @click="openRemoteModal">
            <Link2 class="size-4" />
            远程转存
          </Button>
        </Space>
      </template>
    </Grid>
  </Page>
</template>

<style scoped>
.storage-context {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  padding: 0 2px 10px;
  font-size: 13px;
  color: hsl(var(--muted-foreground));
}

.hash-preview {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 12px;
  vertical-align: middle;
  white-space: nowrap;
}
</style>
