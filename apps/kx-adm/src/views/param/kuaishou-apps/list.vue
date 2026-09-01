<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { KuaishouAppConfig, KuaishouAppWrite } from '#/api/param';

import { nextTick, ref } from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, message, Modal, Tag } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { KuaishouAppApi } from '#/api/param';

const editing = ref<KuaishouAppConfig>();
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
        createKind: 'kuaishou',
        excludeCodes: boundCredentialCodes.value,
        kind: 'kuaishou',
        profile: 'app',
        placeholder: '选择未绑定的 AppID / AppSecret 凭证',
      }),
      fieldName: 'credential_code',
      label: '快手应用凭证',
      rules: 'required',
    },
    {
      component: 'Switch',
      defaultValue: true,
      fieldName: 'enabled',
      label: '启用',
    },
  ],
  showDefaultActions: false,
});
const [EditModal, editModalApi] = useVbenModal({
  centered: true,
  class: 'w-[min(560px,calc(100vw-20px))]',
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;
    editModalApi.lock();
    try {
      const values = (await formApi.getValues()) as KuaishouAppWrite;
      await (editing.value
        ? KuaishouAppApi.update(editing.value.app_id, values)
        : KuaishouAppApi.create(values));
      message.success('快手应用已保存');
      editModalApi.close();
      await gridApi.query();
    } finally {
      editModalApi.unlock();
    }
  },
});
const [Grid, gridApi] = useVbenVxeGrid<KuaishouAppConfig>({
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
      { field: 'app_id', minWidth: 200, title: 'AppID' },
      {
        field: 'app_name',
        minWidth: 240,
        slots: { default: 'name' },
        title: '应用名称',
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
          KuaishouAppApi.list({
            ...values,
            page: page.currentPage,
            size: page.pageSize,
          }),
      },
    },
    rowConfig: { keyField: 'app_id' },
    toolbarConfig: { custom: true, refresh: true, search: true, zoom: true },
  } as VxeTableGridOptions<KuaishouAppConfig>,
});
async function loadBoundCredentials() {
  const result = await KuaishouAppApi.list({ page: 1, size: 500 });
  boundCredentialCodes.value = result.items.map((item) => item.credential_code);
}
async function openCreate() {
  editing.value = undefined;
  editModalApi.open();
  await nextTick();
  await loadBoundCredentials();
  await formApi.reset();
}
async function openEdit(row: KuaishouAppConfig) {
  editing.value = row;
  editModalApi.open();
  await nextTick();
  await loadBoundCredentials();
  await formApi.reset();
  await formApi.setValues(await KuaishouAppApi.detail(row.app_id));
}
function remove(row: KuaishouAppConfig) {
  Modal.confirm({
    title: `确认删除快手应用「${row.app_name}」？`,
    okType: 'danger',
    async onOk() {
      await KuaishouAppApi.remove(row.app_id);
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
    title="快手应用"
  >
    <EditModal :title="editing ? '编辑快手应用' : '新建快手应用'">
      <Form class="mx-1" />
    </EditModal>
    <Grid class="management-grid" table-title="快手应用">
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
      <template #status="{ row }">
        <Tag :color="row.enabled ? 'success' : 'default'">
          {{ row.enabled ? '启用' : '停用' }}
        </Tag>
      </template>
      <template #operation="{ row }">
        <Button danger type="link" @click="remove(row)">删除</Button>
      </template>
    </Grid>
  </Page>
</template>
