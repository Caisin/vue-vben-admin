<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { DouyinAppConfig, DouyinAppWrite } from '#/api/param';

import { nextTick, ref } from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, message, Modal, Space, Tag } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { DouyinAppApi } from '#/api/param';

const editing = ref<DouyinAppConfig>();
const boundCredentialCodes = ref<string[]>([]);

const [Form, formApi] = useVbenForm({
  layout: 'vertical',
  schema: [
    {
      component: 'Input',
      fieldName: 'app_name',
      label: '应用名称',
      rules: 'required',
    },
    {
      component: 'CredentialSelect',
      componentProps: () => ({
        createKind: 'douyin',
        excludeCodes: boundCredentialCodes.value,
        kind: 'douyin',
        profile: 'app',
        placeholder: '选择未绑定的 AppID / AppSecret 凭证',
      }),
      fieldName: 'credential_code',
      label: '抖音应用凭证',
      rules: 'required',
    },
    {
      component: 'CredentialSelect',
      componentProps: {
        createKind: 'douyin',
        kind: 'douyin',
        profile: 'callback_token',
        placeholder: '可选，选择回调 Token 凭证',
      },
      fieldName: 'token_credential_code',
      label: '回调 Token',
    },
    {
      component: 'CredentialSelect',
      componentProps: {
        createKind: 'douyin',
        kind: 'douyin',
        profile: 'sign_salt',
        placeholder: '可选，选择签名 Salt 凭证',
      },
      fieldName: 'salt_credential_code',
      label: '签名 Salt',
    },
    { component: 'Input', fieldName: 'company', label: '公司名称' },
    {
      component: 'InputNumber',
      componentProps: { class: 'w-full', min: 0 },
      fieldName: 'acc_id',
      label: '账户 ID',
    },
    { component: 'Input', fieldName: 'icon_url', label: '图标地址' },
    {
      component: 'Switch',
      defaultValue: false,
      fieldName: 'is_online',
      label: '线上环境',
    },
    {
      component: 'Switch',
      defaultValue: true,
      fieldName: 'enabled',
      label: '启用',
    },
  ],
  showDefaultActions: false,
  wrapperClass: 'grid-cols-1 md:grid-cols-2 gap-x-4',
});

const [EditModal, editModalApi] = useVbenModal({
  centered: true,
  class: 'w-[min(760px,calc(100vw-20px))]',
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;
    editModalApi.lock();
    try {
      const values = (await formApi.getValues()) as DouyinAppWrite;
      await (editing.value
        ? DouyinAppApi.update(editing.value.app_id, values)
        : DouyinAppApi.create(values));
      message.success('抖音应用已保存');
      editModalApi.close();
      await gridApi.query();
    } finally {
      editModalApi.unlock();
    }
  },
});

const [Grid, gridApi] = useVbenVxeGrid<DouyinAppConfig>({
  formOptions: {
    schema: [
      { component: 'Input', fieldName: 'app_id_prefix', label: 'AppID' },
      { component: 'Input', fieldName: 'app_name_prefix', label: '应用名称' },
      {
        component: 'Select',
        componentProps: {
          allowClear: true,
          options: [
            { label: '启用', value: true },
            { label: '停用', value: false },
          ],
        },
        fieldName: 'enabled',
        label: '状态',
      },
    ],
    submitOnChange: true,
  },
  gridOptions: {
    columns: [
      { field: 'app_id', minWidth: 190, title: 'AppID' },
      {
        field: 'app_name',
        minWidth: 220,
        slots: { default: 'name' },
        title: '应用名称',
      },
      { field: 'company', minWidth: 180, title: '公司' },
      {
        field: 'is_online',
        slots: { default: 'online' },
        title: '环境',
        width: 90,
      },
      {
        field: 'enabled',
        slots: { default: 'status' },
        title: '状态',
        width: 90,
      },
      {
        field: 'operation',
        fixed: 'right',
        slots: { default: 'operation' },
        title: '操作',
        width: 100,
      },
    ],
    height: 'auto',
    proxyConfig: {
      ajax: {
        query: ({ page }, values) =>
          DouyinAppApi.list({
            ...values,
            page: page.currentPage,
            size: page.pageSize,
          }),
      },
    },
    rowConfig: { keyField: 'app_id' },
    toolbarConfig: { custom: true, refresh: true, search: true, zoom: true },
  } as VxeTableGridOptions<DouyinAppConfig>,
});

async function loadBoundCredentials() {
  const result = await DouyinAppApi.list({ page: 1, size: 500 });
  boundCredentialCodes.value = result.items.map((item) => item.credential_code);
}
async function openCreate() {
  editing.value = undefined;
  editModalApi.open();
  await nextTick();
  await loadBoundCredentials();
  await formApi.reset();
}
async function openEdit(row: DouyinAppConfig) {
  editing.value = row;
  editModalApi.open();
  await nextTick();
  await loadBoundCredentials();
  const detail = await DouyinAppApi.detail(row.app_id);
  await formApi.reset();
  await formApi.setValues(detail);
}
function remove(row: DouyinAppConfig) {
  Modal.confirm({
    title: `确认删除抖音应用「${row.app_name}」？`,
    okType: 'danger',
    async onOk() {
      await DouyinAppApi.remove(row.app_id);
      await gridApi.query();
    },
  });
}
</script>

<template>
  <Page
    auto-content-height
    class="management-page"
    content-class="management-content"
    title="抖音应用"
  >
    <EditModal :title="editing ? '编辑抖音应用' : '新建抖音应用'">
      <Form class="mx-1" />
    </EditModal>
    <Grid class="management-grid" table-title="抖音应用">
      <template #toolbar-tools>
        <Button type="primary" @click="openCreate">
          <Plus class="size-4" />新建
        </Button>
      </template>
      <template #name="{ row }">
        <Button class="px-0" type="link" @click="openEdit(row)">
          {{ row.app_name }}
        </Button>
      </template>
      <template #online="{ row }">
        <Tag :color="row.is_online ? 'success' : 'default'">
          {{ row.is_online ? '线上' : '测试' }}
        </Tag>
      </template>
      <template #status="{ row }">
        <Tag :color="row.enabled ? 'success' : 'default'">
          {{ row.enabled ? '启用' : '停用' }}
        </Tag>
      </template>
      <template #operation="{ row }">
        <Space>
          <Button danger type="link" @click="remove(row)">删除</Button>
        </Space>
      </template>
    </Grid>
  </Page>
</template>
