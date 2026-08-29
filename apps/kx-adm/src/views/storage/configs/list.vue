<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { CredentialKind, CredentialView } from '#/api/credential';
import type {
  StorageConfigView,
  StorageConfigWrite,
  StorageCredentialSpec,
  StorageTypeSpec,
} from '#/api/storage/config';

import { computed, nextTick, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { Page, useVbenDrawer, useVbenModal } from '@vben/common-ui';
import { Copy, ExternalLink, Plus } from '@vben/icons';

import { Alert, Button, message, Modal, Space, Tag } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { CredentialApi } from '#/api/credential';
import { StorageConfigApi } from '#/api/storage/config';
import { vxeSortParams } from '#/vxe-sort';

import { useColumns, useFormSchema } from './data';
import CopyForm from './modules/copy-form.vue';
import ContentModal from './modules/modal.vue';

const storageConfigSortFields = ['order_no', 'code', 'create_time'];

interface StorageConfigFormValues extends StorageConfigWrite {
  code?: string;
}

interface SelectOption {
  label: string;
  value: string;
}

const router = useRouter();
const editingRow = ref<StorageConfigView>();
const storageTypes = ref<StorageTypeSpec[]>([]);
const credentials = ref<CredentialView[]>([]);
const currentStorageType = ref('fs');

const storageTypeOptions = computed(() =>
  storageTypes.value.map((item) => ({
    label: item.label,
    value: item.code,
  })),
);

function specKey(spec: StorageCredentialSpec) {
  return `${spec.kind}:${spec.profile}`;
}

function specOf(storage_type: unknown) {
  return storageTypes.value.find((item) => item.code === String(storage_type));
}

function credentialSpecLabel(spec: StorageCredentialSpec) {
  return `${spec.kind}/${spec.profile}`;
}

function credentialRequirementLabel(storage_type: unknown) {
  const spec = specOf(storage_type);
  if (!spec?.requires_credentials) return '本地存储无需凭证';
  const specs = spec.credential_specs ?? [];
  return specs.length > 0
    ? `需要 active 凭证：${specs.map((item) => credentialSpecLabel(item)).join('、')}`
    : '需要 active 兼容凭证';
}

function compatibleCredentials(storage_type: unknown) {
  const spec = specOf(storage_type);
  const expected = new Set(
    (spec?.credential_specs ?? []).map((item) => specKey(item)),
  );
  if (!spec?.requires_credentials || expected.size === 0) return [];
  return credentials.value.filter(
    (item) =>
      item.state === 'active' && expected.has(`${item.kind}:${item.profile}`),
  );
}

function credentialOptions(storage_type: unknown): SelectOption[] {
  return compatibleCredentials(storage_type).map((item) => ({
    label: `${item.name} (${item.code}) · ${item.kind}/${item.profile}`,
    value: item.code,
  }));
}

function selectedCredentialLabel(code?: null | string) {
  if (!code) return '';
  const item = credentials.value.find((credential) => credential.code === code);
  return item ? `${item.name} (${item.code})` : code;
}

function showRoot(values: Record<string, unknown>) {
  return Boolean(specOf(values.storage_type)?.requires_root);
}

function showEndpoint(values: Record<string, unknown>) {
  const spec = specOf(values.storage_type);
  return Boolean(spec?.requires_endpoint || spec?.requires_s3);
}

function showS3(values: Record<string, unknown>) {
  return Boolean(specOf(values.storage_type)?.requires_s3);
}

function showRegion(values: Record<string, unknown>) {
  return Boolean(specOf(values.storage_type)?.requires_region);
}

function showCredentials(values: Record<string, unknown>) {
  return Boolean(specOf(values.storage_type)?.requires_credentials);
}

async function applyStorageType(storageType: unknown, resetCredential = true) {
  currentStorageType.value = String(storageType ?? '');
  const options = credentialOptions(storageType);
  await formApi.updateSchema([
    {
      componentProps: {
        allowClear: true,
        class: 'w-full',
        notFoundContent: '没有 active 且 kind/profile 兼容的凭证',
        options,
        placeholder: '选择凭证中心的 active 凭证',
        showSearch: true,
      },
      fieldName: 'credential_code',
    },
  ]);
  if (resetCredential)
    await formApi.setFieldValue('credential_code', undefined);
}

const [Form, formApi] = useVbenForm<StorageConfigFormValues>({
  layout: 'vertical',
  schema: [
    {
      component: 'Input',
      fieldName: 'code',
      formItemClass: 'col-span-1',
      label: '配置编码',
      rules: 'required',
    },
    {
      component: 'Input',
      fieldName: 'storage_name',
      formItemClass: 'col-span-1',
      label: '配置名称',
      rules: 'required',
    },
    {
      component: 'Select',
      componentProps() {
        return {
          class: 'w-full',
          onChange: (value: string) => applyStorageType(value),
          options: storageTypeOptions.value,
        };
      },
      defaultValue: 'fs',
      fieldName: 'storage_type',
      formItemClass: 'col-span-1',
      label: '存储类型',
      rules: 'selectRequired',
    },
    {
      component: 'Switch',
      defaultValue: false,
      fieldName: 'is_public',
      formItemClass: 'col-span-1',
      label: '公开访问',
    },
    {
      component: 'Input',
      componentProps: { placeholder: '例如 uploads；为空表示根目录' },
      fieldName: 'upload_dir',
      formItemClass: 'col-span-1',
      label: '上传目录',
    },
    {
      component: 'InputNumber',
      componentProps: { class: 'w-full', min: 0 },
      defaultValue: 0,
      fieldName: 'order_no',
      formItemClass: 'col-span-1',
      label: '排序',
    },
    {
      component: 'Input',
      componentProps: { placeholder: '例如 /data/kx-adm/upload' },
      dependencies: { show: showRoot, triggerFields: ['storage_type'] },
      fieldName: 'root',
      formItemClass: 'col-span-2',
      label: '根目录',
      rules: 'required',
    },
    {
      component: 'Input',
      componentProps: {
        placeholder: '例如 https://s3.example.com 或 sftp://host:22',
      },
      dependencies: {
        rules: (values) =>
          specOf(values.storage_type)?.requires_endpoint ? 'required' : null,
        show: showEndpoint,
        triggerFields: ['storage_type'],
      },
      fieldName: 'endpoint',
      formItemClass: 'col-span-2',
      label: '访问端点',
    },
    {
      component: 'Input',
      dependencies: { show: showS3, triggerFields: ['storage_type'] },
      fieldName: 'bucket',
      formItemClass: 'col-span-1',
      label: 'Bucket',
      rules: 'required',
    },
    {
      component: 'Input',
      dependencies: { show: showRegion, triggerFields: ['storage_type'] },
      fieldName: 'region',
      formItemClass: 'col-span-1',
      label: 'Region',
      rules: 'required',
    },
    {
      component: 'Input',
      componentProps: { placeholder: '可选，例如 https://cdn.example.com' },
      dependencies: { show: showS3, triggerFields: ['storage_type'] },
      fieldName: 'cdn_domain',
      formItemClass: 'col-span-1',
      label: 'CDN 域名',
    },
    {
      component: 'Switch',
      dependencies: { show: showS3, triggerFields: ['storage_type'] },
      fieldName: 'enable_virtual_host',
      formItemClass: 'col-span-1',
      label: '虚拟主机寻址',
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        class: 'w-full',
        notFoundContent: '没有 active 且 kind/profile 兼容的凭证',
        options: [],
        placeholder: '选择凭证中心的 active 凭证',
        showSearch: true,
      },
      dependencies: { show: showCredentials, triggerFields: ['storage_type'] },
      fieldName: 'credential_code',
      formItemClass: 'col-span-2',
      help: '只保存凭证中心 code 并建立 storage owner binding；Storage 页面不再创建、查看或轮换明文。',
      label: '访问凭证',
      rules: 'selectRequired',
    },
  ],
  showDefaultActions: false,
  wrapperClass: 'grid-cols-1 md:grid-cols-2 gap-x-4',
});

const [ConfigModal, configModalApi] = useVbenModal({
  connectedComponent: ContentModal,
  destroyOnClose: false,
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;

    configModalApi.lock();
    try {
      const values = (await formApi.getValues()) as StorageConfigFormValues;
      const code = editingRow.value?.code ?? String(values.code ?? '').trim();
      const payload = buildPayload(values);
      if (!validateCredentialPayload(payload)) return;
      await StorageConfigApi.save(code, payload);
      message.success('保存成功');
      configModalApi.close();
      await gridApi.query();
    } finally {
      configModalApi.lock(false);
    }
  },
});

const [CopyDrawer, copyDrawerApi] = useVbenDrawer({
  connectedComponent: CopyForm,
  destroyOnClose: true,
});

const [Grid, gridApi] = useVbenVxeGrid<StorageConfigView>({
  formOptions: {
    schema: useFormSchema(() => storageTypeOptions.value),
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
          const result = await StorageConfigApi.list({
            ...formValues,
            ...vxeSortParams(params, storageConfigSortFields),
            page: page.currentPage,
            size: page.pageSize,
          });
          return { items: result.items, total: result.total };
        },
      },
    },
    sortConfig: { remote: true },
    rowConfig: { keyField: 'code' },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<StorageConfigView>,
});

function buildPayload(values: StorageConfigFormValues): StorageConfigWrite {
  const storage_type = String(values.storage_type ?? '').trim();
  const spec = specOf(storage_type);
  const payload: StorageConfigWrite = {
    bucket: String(values.bucket ?? '').trim(),
    cdn_domain: String(values.cdn_domain ?? '').trim(),
    credential_code: null,
    enable_virtual_host: Boolean(values.enable_virtual_host),
    endpoint: String(values.endpoint ?? '').trim(),
    is_public: Boolean(values.is_public),
    order_no: Number(values.order_no ?? 0),
    region: String(values.region ?? '').trim(),
    root: String(values.root ?? '').trim(),
    storage_name: String(values.storage_name ?? '').trim(),
    storage_type,
    upload_dir: String(values.upload_dir ?? '').trim(),
  };

  if (spec?.requires_credentials) {
    payload.credential_code =
      String(values.credential_code ?? '').trim() || null;
  }

  return payload;
}

function validateCredentialPayload(payload: StorageConfigWrite) {
  const spec = specOf(payload.storage_type);
  if (!spec?.requires_credentials) return true;
  if (!payload.credential_code) {
    message.warning('请选择凭证中心的 active 兼容凭证');
    return false;
  }
  return true;
}

function typeLabel(storage_type: string) {
  return specOf(storage_type)?.label ?? storage_type;
}

function typeDescription(storage_type: string) {
  return specOf(storage_type)?.description ?? '';
}

async function openCreate() {
  editingRow.value = undefined;
  configModalApi.open();
  await nextTick();
  await formApi.reset();
  await formApi.updateSchema([
    { componentProps: { disabled: false }, fieldName: 'code' },
  ]);
  await formApi.setValues({
    is_public: false,
    order_no: 0,
    storage_type: 'fs',
  });
  await applyStorageType('fs', false);
}

async function openEdit(row: StorageConfigView) {
  editingRow.value = row;
  configModalApi.open();
  await nextTick();
  await formApi.reset();
  await formApi.updateSchema([
    { componentProps: { disabled: true }, fieldName: 'code' },
  ]);
  const detail = await StorageConfigApi.detail(row.code);
  await formApi.setValues(detail);
  await applyStorageType(detail.storage_type, false);
}

function confirmDelete(row: StorageConfigView) {
  Modal.confirm({
    async onOk() {
      await StorageConfigApi.remove(row.code);
      message.success('删除成功');
      await gridApi.query();
    },
    okText: '删除',
    okType: 'danger',
    title: `确认删除存储配置「${row.storage_name}」？`,
  });
}

function openCopy(row: StorageConfigView) {
  copyDrawerApi.setData(row).open();
}

async function openCredentialCenter() {
  await router.push('/credential/credentials');
}

async function fetchAllActiveCredentials(specs: StorageCredentialSpec[]) {
  const uniqueSpecs = [
    ...new Map(specs.map((item) => [specKey(item), item])).values(),
  ];
  const pages = await Promise.all(
    uniqueSpecs.map((spec) =>
      CredentialApi.all({
        kind: spec.kind as CredentialKind,
        profile: spec.profile,
        state: 'active',
      }),
    ),
  );
  const dedup = new Map<string, CredentialView>();
  for (const item of pages.flat()) {
    dedup.set(item.code, item);
  }
  return [...dedup.values()];
}

onMounted(async () => {
  storageTypes.value = await StorageConfigApi.types();
  const specs = storageTypes.value.flatMap(
    (item) => item.credential_specs ?? [],
  );
  credentials.value = await fetchAllActiveCredentials(specs);
});
</script>

<template>
  <Page
    auto-content-height
    class="management-page"
    content-class="management-content"
    title="存储配置"
  >
    <CopyDrawer @success="gridApi.query" />
    <ConfigModal
      class="w-full max-w-180"
      :title="editingRow ? '编辑存储配置' : '新建存储配置'"
    >
      <Alert
        class="mb-3"
        description="访问密钥仅引用凭证中心 code，不在此表单展示或维护明文。"
        message="对象存储直传需在 Bucket 配置 CORS；服务端上传无需配置。"
        show-icon
        type="info"
      />
      <Form class="mx-1" />
      <div
        class="mx-1 mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500"
      >
        <span>{{ credentialRequirementLabel(currentStorageType) }}</span>
        <Button type="link" class="px-0" @click="openCredentialCenter">
          <ExternalLink class="size-4" />
          前往凭证中心创建或维护
        </Button>
      </div>
    </ConfigModal>

    <Grid class="management-grid" table-title="存储配置">
      <template #nameCell="{ row }">
        <Space wrap size="small">
          <Button class="px-0" type="link" @click.stop="openEdit(row)">
            {{ row.storage_name }}
          </Button>
          <Button
            v-access:code="'storage:config:copy'"
            type="text"
            title="复制存储配置"
            @click.stop="openCopy(row)"
          >
            <template #icon><Copy /></template>
          </Button>
          <Button danger type="link" @click.stop="confirmDelete(row)">
            删除
          </Button>
        </Space>
      </template>
      <template #typeCell="{ row }">
        <Tag color="processing">{{ typeLabel(row.storage_type) }}</Tag>
        <span
          class="ml-1 inline-block max-w-72 truncate align-middle text-xs text-gray-400"
          :title="typeDescription(row.storage_type)"
        >
          {{ typeDescription(row.storage_type) }}
        </span>
      </template>
      <template #publicCell="{ row }">
        <Tag :color="row.is_public ? 'success' : 'default'">
          {{ row.is_public ? '公开' : '私有' }}
        </Tag>
      </template>
      <template #credentialCell="{ row }">
        <Tag
          v-if="specOf(row.storage_type)?.requires_credentials"
          :color="row.credential_code ? 'success' : 'error'"
        >
          {{
            row.credential_code
              ? selectedCredentialLabel(row.credential_code)
              : '未绑定'
          }}
        </Tag>
        <Tag v-else color="default">不需要</Tag>
      </template>
      <template #toolbar-tools>
        <Space wrap size="small">
          <Button @click="openCredentialCenter">
            <ExternalLink class="size-4" />
            凭证中心
          </Button>
          <Button type="primary" @click="openCreate">
            <Plus class="size-4" />
            新建存储配置
          </Button>
        </Space>
      </template>
    </Grid>
  </Page>
</template>
