<script lang="ts" setup>
import type { MenuProps } from 'antdv-next';
import type { Dayjs } from 'dayjs';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type {
  FileShareAccessView,
  FileShareFileView,
  FileShareView,
} from '#/api/storage';
import type { BusinessContact } from '#/auth';
import type { SelectedStorageFile } from '#/components/file-picker';

import { onMounted, ref } from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';
import {
  Copy,
  Download,
  ExternalLink,
  Eye,
  IconifyIcon,
  Plus,
} from '@vben/icons';
import { downloadFileFromBlob } from '@vben/utils';

import { useClipboard } from '@vueuse/core';
import {
  Button,
  DatePicker,
  Descriptions,
  DescriptionsItem,
  Drawer,
  Dropdown,
  Input,
  InputNumber,
  message,
  Modal,
  Pagination,
  Popover,
  QRCode,
  Segmented,
  Space,
  Switch,
  Table,
  TabPane,
  Tabs,
  Tag,
  Tooltip,
} from 'antdv-next';
import dayjs from 'dayjs';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { AuthApi } from '#/api/core/auth';
import { StorageFileShareApi } from '#/api/storage';
import { Times } from '#/times';
import { useVxeRowContextMenu } from '#/views/_shared/use-vxe-row-context-menu';
import { vxeSortParams } from '#/vxe-sort';

import { useColumns, useFormSchema } from './data';
import ContentModal from './modules/modal.vue';
import ShareUploadField from './modules/share-upload-field.vue';

type ExpiryPreset = 7 | 15 | 30 | 'custom';

const shareSortFields = [
  'created_at',
  'download_count',
  'expires_at',
  'file_name',
  'id',
  'view_count',
];
const shareUploadRef = ref<{ isRunning: () => boolean; reset: () => void }>();
const selectedFiles = ref<SelectedStorageFile[]>([]);
const createTitle = ref('');
const createPreset = ref<ExpiryPreset>(15);
const createExpiry = ref<Dayjs>();
const createDownloadStart = ref<Dayjs>();
const createImmediate = ref(true);
const createUnlimited = ref(true);
const createDownloadLimit = ref(10);
const createPasswordRequired = ref(false);
const createPassword = ref('');
const createShowBusinessContact = ref(false);
const businessContactAvailable = ref(false);
const editingShare = ref<FileShareView>();
const editingExpiry = ref<Dayjs>();
const policyStart = ref<Dayjs>();
const policyImmediate = ref(true);
const policyUnlimited = ref(true);
const policyLimit = ref(10);
const policyPasswordAction = ref<'clear' | 'custom' | 'keep' | 'reset'>('keep');
const policyCustomPassword = ref('');
const detailOpen = ref(false);
const detailTab = ref('overview');
const settingsSaving = ref(false);
const addDownloadCount = ref(10);
const editShowBusinessContact = ref(false);
const editBusinessContact = ref<BusinessContact>(emptyBusinessContact());
const accessLoading = ref(false);
const accessRows = ref<FileShareAccessView[]>([]);
const accessPage = ref(1);
const accessTotal = ref(0);
const { copy: copyText } = useClipboard({ legacy: true });
const generatedPasswords = new Map<string, string>();

const expiryOptions = [
  { label: '+7 天', value: 7 },
  { label: '+15 天', value: 15 },
  { label: '+30 天', value: 30 },
  { label: '自定义', value: 'custom' },
];

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
  class: 'w-[min(820px,calc(100vw-20px))]',
  connectedComponent: ContentModal,
  destroyOnClose: true,
  title: '新增文件分享',
  async onConfirm() {
    if (shareUploadRef.value?.isRunning()) {
      message.warning('文件仍在上传，请等待上传完成');
      return;
    }
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
    const downloadPassword = createPassword.value.trim();
    if (
      createPasswordRequired.value &&
      downloadPassword &&
      !validDownloadPassword(downloadPassword)
    ) {
      message.warning('下载密码需要 6–32 个字符');
      return;
    }
    createModalApi.lock();
    try {
      const created = await StorageFileShareApi.create({
        expires_at: expiresAt,
        file_ids: selectedFiles.value.map((item) => item.file.file_id),
        file_name: createTitle.value.trim() || undefined,
        download_start_at: downloadStartAt,
        download_limit: downloadLimit,
        download_password:
          createPasswordRequired.value && downloadPassword
            ? downloadPassword
            : undefined,
        password_required: createPasswordRequired.value,
        show_business_contact: createShowBusinessContact.value,
      });
      message.success('分享链接已创建');
      createModalApi.close();
      await gridApi.query();
      showGeneratedPassword(created.id, created.download_password);
    } finally {
      createModalApi.lock(false);
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

async function openCreate() {
  await loadBusinessContactAvailability();
  selectedFiles.value = [];
  shareUploadRef.value?.reset();
  createTitle.value = '';
  createPreset.value = 15;
  createExpiry.value = dayjs().add(15, 'day');
  createImmediate.value = true;
  createDownloadStart.value = dayjs();
  createUnlimited.value = true;
  createDownloadLimit.value = 10;
  createPasswordRequired.value = false;
  createPassword.value = '';
  createShowBusinessContact.value = false;
  createModalApi.open();
}

function handleFileSelected(files: SelectedStorageFile[]) {
  selectedFiles.value = files;
}

function initializeSettings(row: FileShareView) {
  editingShare.value = row;
  editingExpiry.value = dayjs.unix(Number(row.expires_at));
  policyImmediate.value = Number(row.download_start_at) === 0;
  policyStart.value = policyImmediate.value
    ? dayjs()
    : dayjs.unix(Number(row.download_start_at));
  policyUnlimited.value = Number(row.download_limit) === 0;
  policyLimit.value = policyUnlimited.value ? 10 : Number(row.download_limit);
  policyPasswordAction.value = 'keep';
  policyCustomPassword.value = '';
  addDownloadCount.value = 10;
  editShowBusinessContact.value = row.show_business_contact;
  editBusinessContact.value = {
    ...emptyBusinessContact(),
    ...row.business_contact,
  };
}

async function openDetail(row: FileShareView, tab = 'overview') {
  initializeSettings(row);
  detailTab.value = tab;
  detailOpen.value = true;
  accessRows.value = [];
  accessTotal.value = 0;
  if (tab === 'access') await loadAccess(1);
}

async function changeDetailTab(key: number | string) {
  detailTab.value = String(key);
  if (detailTab.value === 'access' && accessRows.value.length === 0) {
    await loadAccess(1);
  }
}

async function saveSettings() {
  const share = editingShare.value;
  const expiresAt = editingExpiry.value?.unix();
  if (!share || !expiresAt) {
    message.warning('请选择过期时间');
    return;
  }
  const expiryChanged = expiresAt !== Number(share.expires_at);
  if (expiryChanged && expiresAt <= dayjs().unix()) {
    message.warning('请选择未来的过期时间');
    return;
  }
  const startAt = policyImmediate.value ? 0 : policyStart.value?.unix();
  if (
    startAt === undefined ||
    startAt < 0 ||
    (startAt > 0 && startAt >= expiresAt)
  ) {
    message.warning('开始下载时间必须早于过期时间');
    return;
  }
  const limit = policyUnlimited.value ? 0 : policyLimit.value;
  if (limit > 0 && limit < Number(share.download_count)) {
    message.warning('总下载次数不能小于已下载次数');
    return;
  }
  const customPassword = policyCustomPassword.value.trim();
  if (
    policyPasswordAction.value === 'custom' &&
    !validDownloadPassword(customPassword)
  ) {
    message.warning('下载密码需要 6–32 个字符');
    return;
  }

  const policyChanged =
    startAt !== Number(share.download_start_at) ||
    limit !== Number(share.download_limit) ||
    policyPasswordAction.value !== 'keep';
  const businessContact = Object.fromEntries(
    Object.entries(editBusinessContact.value).map(([key, value]) => [
      key,
      value.trim(),
    ]),
  ) as unknown as BusinessContact;
  const contactChanged =
    editShowBusinessContact.value !== share.show_business_contact ||
    JSON.stringify(businessContact) !==
      JSON.stringify({
        ...emptyBusinessContact(),
        ...share.business_contact,
      });
  if (!expiryChanged && !policyChanged && !contactChanged) {
    message.info('没有需要保存的修改');
    return;
  }

  settingsSaving.value = true;
  let updated = share;
  let generatedPassword: string | undefined;
  const updateExpiry = async () => {
    updated = await StorageFileShareApi.setExpiry(share.id, expiresAt);
  };
  const updatePolicy = async () => {
    updated = await StorageFileShareApi.setDownloadPolicy(share.id, {
      clear_password: policyPasswordAction.value === 'clear',
      download_password:
        policyPasswordAction.value === 'custom' ? customPassword : undefined,
      download_limit: limit,
      download_start_at: startAt,
      reset_password: policyPasswordAction.value === 'reset',
    });
    generatedPassword = updated.download_password;
  };
  try {
    if (expiryChanged && policyChanged) {
      if (expiresAt >= Number(share.expires_at)) {
        await updateExpiry();
        await updatePolicy();
      } else {
        await updatePolicy();
        await updateExpiry();
      }
    } else if (expiryChanged) {
      await updateExpiry();
    } else if (policyChanged) {
      await updatePolicy();
    }
    if (contactChanged) {
      updated = await StorageFileShareApi.setBusinessContact(share.id, {
        business_contact: businessContact,
        show_business_contact: editShowBusinessContact.value,
      });
    }
    if (policyPasswordAction.value === 'clear') {
      generatedPasswords.delete(String(share.id));
    }
    initializeSettings(updated);
    message.success('分享设置已保存');
    await gridApi.query();
    showGeneratedPassword(share.id, generatedPassword);
  } finally {
    settingsSaving.value = false;
  }
}

async function addDownloads(row: FileShareView, count: number) {
  const updated = await StorageFileShareApi.addDownloads(row.id, count);
  if (editingShare.value?.id === row.id) {
    editingShare.value = updated;
    policyLimit.value = Number(updated.download_limit);
  }
  message.success(`已增加 ${count} 次下载额度`);
  await gridApi.query();
}

async function openAccess(row: FileShareView) {
  await openDetail(row, 'access');
}

async function loadAccess(page: number) {
  const share = editingShare.value;
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

function showGeneratedPassword(id: number | string, password?: string) {
  if (!password) return;
  generatedPasswords.set(String(id), password);
  void copyText(password).catch(() => undefined);
  Modal.info({
    content: password,
    okText: '关闭',
    title: '下载密码',
  });
}

async function currentSharePassword(row: FileShareView) {
  const cached = generatedPasswords.get(String(row.id));
  if (cached) return cached;
  const result = await StorageFileShareApi.revealPassword(row.id);
  generatedPasswords.set(String(row.id), result.download_password);
  return result.download_password;
}

async function showSharePassword(row: FileShareView) {
  try {
    const password = await currentSharePassword(row);
    Modal.info({
      content: password,
      okText: '复制密码',
      async onOk() {
        await copyPasswordText(password, '下载密码已复制');
      },
      title: '当前下载密码',
    });
  } catch {
    message.error('当前密码无法揭秘，请在分享设置中指定一次新密码');
  }
}

function configureBusinessContact() {
  window.open('/user-overview', '_blank', 'noopener,noreferrer');
}

async function loadBusinessContactAvailability() {
  try {
    const current = await AuthApi.currentUser();
    businessContactAvailable.value = Object.values(
      current.business_contact,
    ).some((value) => value.trim().length > 0);
  } catch {
    businessContactAvailable.value = false;
  }
}

onMounted(() => {
  void loadBusinessContactAvailability();
});

async function copyShareText(row: FileShareView, password?: string) {
  const url = absoluteUrl(row.share_url);
  if (!url) {
    message.warning('分享链接为空');
    return;
  }
  try {
    await copyText(password ? `分享链接：${url}\n下载密码：${password}` : url);
    message.success(password ? '分享链接和下载密码已复制' : '分享链接已复制');
  } catch {
    message.error('复制失败，请在分享详情中手动复制');
  }
}

async function copyShareInfo(row: FileShareView) {
  if (!row.password_required) {
    await copyShareText(row);
    return;
  }
  try {
    const password = await currentSharePassword(row);
    await copyShareText(row, password);
  } catch {
    message.error('当前密码无法揭秘，请在分享设置中指定一次新密码');
  }
}

async function copySharePassword(row: FileShareView) {
  try {
    const password = await currentSharePassword(row);
    await copyPasswordText(password, '下载密码已复制');
  } catch {
    message.error('当前密码无法揭秘，请在分享设置中指定一次新密码');
  }
}

function resetSharePassword(row: FileShareView) {
  Modal.confirm({
    content: '重置后旧密码立即失效，公开下载必须使用新密码。',
    okText: '重置随机密码',
    async onOk() {
      const updated = await StorageFileShareApi.setDownloadPolicy(row.id, {
        clear_password: false,
        download_limit: row.download_limit,
        download_start_at: row.download_start_at,
        reset_password: true,
      });
      const password = updated.download_password;
      if (!password) throw new Error('下载密码生成失败');
      generatedPasswords.set(String(row.id), password);
      if (editingShare.value?.id === row.id) {
        editingShare.value = updated;
        policyPasswordAction.value = 'keep';
        policyCustomPassword.value = '';
      }
      await gridApi.query();
      showGeneratedPassword(row.id, password);
    },
    title: '确认重置下载密码',
  });
}

async function downloadSharedFile(file: FileShareFileView) {
  const share = editingShare.value;
  if (!share) return;
  const blob = await StorageFileShareApi.downloadFile(share.id, file.file_id);
  downloadFileFromBlob({ fileName: displayFileName(file), source: blob });
}

async function previewSharedFile(file: FileShareFileView) {
  const share = editingShare.value;
  if (!share) return;
  const blob = await StorageFileShareApi.downloadFile(share.id, file.file_id);
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener,noreferrer');
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
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

function emptyBusinessContact(): BusinessContact {
  return {
    company: '',
    contact_name: '',
    email: '',
    phone: '',
    title: '',
    website: '',
    wechat: '',
  };
}

function validDownloadPassword(value: string) {
  const length = [...value].length;
  return (
    length >= 6 &&
    length <= 32 &&
    new TextEncoder().encode(value).length <= 72 &&
    !/\p{Cc}/u.test(value)
  );
}

async function copyPasswordText(password: string, successMessage: string) {
  try {
    await copyText(password);
    message.success(successMessage);
  } catch {
    message.error('复制失败，请在分享详情中手动复制');
  }
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
          <span class="field-label">分享文件</span>
          <ShareUploadField ref="shareUploadRef" @change="handleFileSelected" />
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
          <div class="form-field">
            <span class="field-label">下载密码</span>
            <Switch v-model:checked="createPasswordRequired" />
          </div>
          <div class="form-field">
            <span class="field-label">商务联系卡片</span>
            <div class="inline-control">
              <Switch
                v-model:checked="createShowBusinessContact"
                :disabled="!businessContactAvailable"
              />
              <Button
                v-if="!businessContactAvailable"
                size="small"
                type="link"
                @click="configureBusinessContact"
              >
                配置
              </Button>
            </div>
          </div>
        </div>
        <div v-if="createPasswordRequired" class="form-field">
          <span class="field-label">指定下载密码</span>
          <Input
            v-model:value="createPassword"
            :maxlength="32"
            placeholder="留空则自动生成 6 位随机密码"
          />
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

    <Drawer
      v-model:open="detailOpen"
      size="min(920px, calc(100vw - 16px))"
      :title="`分享详情 · ${editingShare?.file_name || ''}`"
    >
      <Tabs :active-key="detailTab" @change="changeDetailTab">
        <TabPane key="overview" tab="概览">
          <Descriptions
            v-if="editingShare"
            bordered
            :column="{ xs: 1, sm: 2 }"
            size="small"
          >
            <DescriptionsItem label="状态">
              <Tag :color="shareStatus(editingShare).color">
                {{ shareStatus(editingShare).label }}
              </Tag>
            </DescriptionsItem>
            <DescriptionsItem label="分享人">
              {{ editingShare.sharer }}
            </DescriptionsItem>
            <DescriptionsItem label="文件数量">
              {{ editingShare.file_count }} 个
            </DescriptionsItem>
            <DescriptionsItem label="总大小">
              {{ formatBytes(editingShare.total_size) }}
            </DescriptionsItem>
            <DescriptionsItem label="查看 / 下载">
              {{ editingShare.view_count }} / {{ editingShare.download_count }}
            </DescriptionsItem>
            <DescriptionsItem label="剩余下载">
              {{ editingShare.remaining_download_count ?? '不限' }}
            </DescriptionsItem>
            <DescriptionsItem label="开始下载">
              {{
                Number(editingShare.download_start_at) === 0
                  ? '立即'
                  : Times.formatUnix(editingShare.download_start_at)
              }}
            </DescriptionsItem>
            <DescriptionsItem label="过期时间">
              {{ Times.formatUnix(editingShare.expires_at) }}
            </DescriptionsItem>
            <DescriptionsItem label="下载密码">
              <Space size="small">
                <span>
                  {{ editingShare.password_required ? '已启用' : '未启用' }}
                </span>
                <Button
                  v-if="editingShare.password_required"
                  size="small"
                  type="link"
                  @click="showSharePassword(editingShare)"
                >
                  <Eye class="size-4" />
                  查看密码
                </Button>
                <Button
                  v-if="editingShare.password_required"
                  danger
                  size="small"
                  type="link"
                  @click="resetSharePassword(editingShare)"
                >
                  重置随机密码
                </Button>
              </Space>
            </DescriptionsItem>
            <DescriptionsItem label="创建时间">
              {{ Times.formatUnix(editingShare.created_at) }}
            </DescriptionsItem>
            <DescriptionsItem :span="2" label="分享链接">
              <div class="detail-link">
                <span>{{ absoluteUrl(editingShare.share_url) }}</span>
                <Space size="small">
                  <Button size="small" @click="copyShareInfo(editingShare)">
                    <Copy class="size-4" />
                    复制分享信息
                  </Button>
                  <Popover placement="bottomRight" trigger="click">
                    <template #content>
                      <div class="share-qrcode">
                        <QRCode
                          :size="220"
                          :value="absoluteUrl(editingShare.share_url)"
                        />
                        <span>手机扫码查看分享</span>
                      </div>
                    </template>
                    <Button size="small">
                      <IconifyIcon class="size-4" icon="lucide:qr-code" />
                      二维码
                    </Button>
                  </Popover>
                  <Button
                    :href="editingShare.share_url"
                    rel="noopener noreferrer"
                    size="small"
                    target="_blank"
                  >
                    <ExternalLink class="size-4" />
                    打开
                  </Button>
                </Space>
              </div>
            </DescriptionsItem>
          </Descriptions>

          <Descriptions
            v-if="editingShare?.business_contact"
            class="mt-5"
            bordered
            :column="{ xs: 1, sm: 2 }"
            size="small"
            title="商务联系卡片"
          >
            <DescriptionsItem label="公司">
              {{ editingShare.business_contact.company || '-' }}
            </DescriptionsItem>
            <DescriptionsItem label="联系人">
              {{ editingShare.business_contact.contact_name || '-' }}
            </DescriptionsItem>
            <DescriptionsItem label="职位">
              {{ editingShare.business_contact.title || '-' }}
            </DescriptionsItem>
            <DescriptionsItem label="电话">
              {{ editingShare.business_contact.phone || '-' }}
            </DescriptionsItem>
            <DescriptionsItem label="邮箱">
              {{ editingShare.business_contact.email || '-' }}
            </DescriptionsItem>
            <DescriptionsItem label="微信">
              {{ editingShare.business_contact.wechat || '-' }}
            </DescriptionsItem>
            <DescriptionsItem :span="2" label="网站">
              {{ editingShare.business_contact.website || '-' }}
            </DescriptionsItem>
          </Descriptions>
        </TabPane>

        <TabPane key="files" :tab="`文件 (${editingShare?.file_count || 0})`">
          <Table
            :columns="[
              { title: '文件名', dataIndex: 'file_name' },
              { title: '存储', dataIndex: 'storage_code', width: 150 },
              { title: '大小', dataIndex: 'size', width: 110 },
              { title: '操作', dataIndex: 'actions', width: 180 },
            ]"
            :data-source="editingShare?.files || []"
            :pagination="false"
            row-key="file_id"
            size="small"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'file_name'">
                <span class="file-name-full">{{
                  displayFileName(record)
                }}</span>
              </template>
              <template v-else-if="column.dataIndex === 'size'">
                {{ formatBytes(record.size) }}
              </template>
              <template v-else-if="column.dataIndex === 'actions'">
                <Space size="small">
                  <Button size="small" @click="previewSharedFile(record)">
                    <Eye class="size-4" />
                    查看
                  </Button>
                  <Button size="small" @click="downloadSharedFile(record)">
                    <Download class="size-4" />
                    下载
                  </Button>
                </Space>
              </template>
            </template>
          </Table>
        </TabPane>

        <TabPane key="settings" tab="分享设置">
          <div class="share-settings">
            <section>
              <h3>有效期</h3>
              <div class="setting-row">
                <DatePicker
                  v-model:value="editingExpiry"
                  class="min-w-0 flex-1"
                  :disabled-date="disablePastDate"
                  format="YYYY-MM-DD HH:mm"
                  show-time
                />
              </div>
            </section>

            <section>
              <h3>下载策略</h3>
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
              <div v-if="!policyImmediate" class="form-field mt-4">
                <span class="field-label">开始下载时间</span>
                <DatePicker
                  v-model:value="policyStart"
                  class="w-full"
                  format="YYYY-MM-DD HH:mm"
                  show-time
                />
              </div>
              <div v-if="!policyUnlimited" class="two-fields mt-4">
                <div class="form-field">
                  <span class="field-label">总下载次数</span>
                  <InputNumber
                    v-model:value="policyLimit"
                    class="w-full"
                    :min="Number(editingShare?.download_count || 1)"
                  />
                </div>
                <div class="form-field">
                  <span class="field-label">追加下载次数</span>
                  <div class="setting-row">
                    <InputNumber
                      v-model:value="addDownloadCount"
                      class="min-w-0 flex-1"
                      :min="1"
                      :max="1000000"
                    />
                    <Button
                      :disabled="!editingShare"
                      @click="
                        editingShare &&
                        addDownloads(editingShare, addDownloadCount)
                      "
                    >
                      增加
                    </Button>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h3>下载密码</h3>
              <Segmented
                v-model:value="policyPasswordAction"
                :options="[
                  { label: '保持不变', value: 'keep' },
                  { label: '重新生成', value: 'reset' },
                  { label: '指定密码', value: 'custom' },
                  { label: '清除密码', value: 'clear' },
                ]"
              />
              <div
                v-if="policyPasswordAction === 'custom'"
                class="form-field mt-4"
              >
                <span class="field-label">新下载密码</span>
                <Input
                  v-model:value="policyCustomPassword"
                  :maxlength="32"
                  placeholder="输入 6–32 个字符"
                />
              </div>
            </section>

            <section>
              <div class="section-heading">
                <h3>商务联系卡片</h3>
                <div class="inline-control">
                  <span class="field-label">公开展示</span>
                  <Switch v-model:checked="editShowBusinessContact" />
                </div>
              </div>
              <div class="two-fields">
                <div class="form-field">
                  <span class="field-label">公司</span>
                  <Input v-model:value="editBusinessContact.company" />
                </div>
                <div class="form-field">
                  <span class="field-label">联系人</span>
                  <Input v-model:value="editBusinessContact.contact_name" />
                </div>
                <div class="form-field">
                  <span class="field-label">职位</span>
                  <Input v-model:value="editBusinessContact.title" />
                </div>
                <div class="form-field">
                  <span class="field-label">电话</span>
                  <Input v-model:value="editBusinessContact.phone" />
                </div>
                <div class="form-field">
                  <span class="field-label">邮箱</span>
                  <Input v-model:value="editBusinessContact.email" />
                </div>
                <div class="form-field">
                  <span class="field-label">微信</span>
                  <Input v-model:value="editBusinessContact.wechat" />
                </div>
              </div>
              <div class="form-field mt-4">
                <span class="field-label">网站</span>
                <Input
                  v-model:value="editBusinessContact.website"
                  placeholder="https://example.com"
                />
              </div>
            </section>

            <div class="settings-actions">
              <Button
                type="primary"
                :loading="settingsSaving"
                @click="saveSettings"
              >
                保存设置
              </Button>
            </div>
          </div>
        </TabPane>

        <TabPane key="access" tab="访问记录">
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
        </TabPane>
      </Tabs>
    </Drawer>

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
        <Button
          class="share-name-button"
          type="link"
          @click.stop="openDetail(row)"
        >
          <span>{{ row.file_name }}</span>
          <small>{{ row.file_count }} 个文件</small>
        </Button>
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
          <Button
            class="usage-summary"
            type="link"
            @click.stop="openDetail(row, 'settings')"
          >
            {{ row.download_count }} 下载 · 剩余
            {{ row.remaining_download_count ?? '不限' }}
          </Button>
          <Tooltip v-if="row.password_required" title="复制下载密码">
            <Button
              class="password-copy"
              size="small"
              @click.stop="copySharePassword(row)"
            >
              <Copy class="size-3.5" />
              有密码
            </Button>
          </Tooltip>
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

      <template #expiryCell="{ row }">
        <div class="expiry-cell">
          <Button
            class="min-w-0 px-0"
            type="link"
            @click.stop="openDetail(row, 'settings')"
          >
            {{ Times.formatUnix(row.expires_at) }}
          </Button>
          <Button
            class="expiry-remaining"
            size="small"
            type="link"
            @click.stop="openDetail(row, 'settings')"
          >
            {{ remaining(row.expires_at) }}
          </Button>
        </div>
      </template>

      <template #shareUrlCell="{ row }">
        <div class="url-cell">
          <a
            class="url-value"
            :href="row.share_url"
            rel="noopener noreferrer"
            target="_blank"
            :title="absoluteUrl(row.share_url)"
          >
            {{ absoluteUrl(row.share_url) }}
          </a>
          <Tooltip title="复制分享信息">
            <Button
              aria-label="复制分享信息"
              size="small"
              type="text"
              @click.stop="copyShareInfo(row)"
            >
              <Copy class="size-4" />
            </Button>
          </Tooltip>
          <Popover placement="bottomRight" trigger="click">
            <template #content>
              <div class="share-qrcode">
                <QRCode :size="200" :value="absoluteUrl(row.share_url)" />
                <span>手机扫码查看分享</span>
              </div>
            </template>
            <Button
              aria-label="查看分享二维码"
              size="small"
              title="查看分享二维码"
              type="text"
              @click.stop
            >
              <IconifyIcon class="size-4" icon="lucide:qr-code" />
            </Button>
          </Popover>
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

.two-fields :deep(.ant-switch) {
  width: fit-content;
  min-width: 44px;
}

.usage-cell {
  flex-wrap: wrap;
}

.usage-summary {
  height: auto;
  padding: 0;
}

.expiry-remaining {
  padding-inline: 2px;
}

.inline-control {
  display: flex;
  gap: 6px;
  align-items: center;
}

.share-name-button {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  width: 100%;
  height: auto;
  padding: 2px 0;
  text-align: left;
  white-space: normal;
}

.share-name-button > span,
.file-name-full {
  max-width: 100%;
  overflow-wrap: anywhere;
}

.detail-link,
.setting-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}

.detail-link > span {
  flex: 1;
  min-width: 240px;
  font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 12px;
  overflow-wrap: anywhere;
}

.share-qrcode {
  display: grid;
  gap: 10px;
  justify-items: center;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.share-settings {
  display: grid;
  gap: 24px;
}

.share-settings section {
  padding-bottom: 24px;
  border-bottom: 1px solid hsl(var(--border));
}

.share-settings h3 {
  margin: 0 0 16px;
  font-size: 15px;
  font-weight: 600;
}

.section-heading {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.section-heading h3 {
  margin: 0;
}

.settings-actions {
  display: flex;
  justify-content: flex-end;
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
  color: inherit;
}

@media (max-width: 640px) {
  .two-fields {
    grid-template-columns: 1fr;
  }

  .detail-link > span {
    min-width: 100%;
  }

  .setting-row > * {
    width: 100%;
  }
}
</style>
