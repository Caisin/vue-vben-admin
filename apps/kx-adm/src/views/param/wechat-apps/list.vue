<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { WechatAppConfig, WechatAppCreate, WechatAppUpdate } from '#/api';

import { nextTick, ref } from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Alert, Button, message, Modal, Tag } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { WechatAppApi } from '#/api';

import ContentModal from '../login-apps/modules/modal.vue';

const editing = ref<WechatAppConfig>();
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
      componentProps: {
        createKind: 'wechat',
        kind: 'wechat',
        profile: 'app',
        placeholder: '选择未绑定的微信小程序凭证',
      },
      fieldName: 'credential_code',
      label: '微信小程序凭证',
      rules: 'required',
    },
    { component: 'Input', fieldName: 'offer_id', label: 'Offer ID' },
    {
      component: 'InputNumber',
      componentProps: { class: 'w-full', min: 0 },
      defaultValue: 0,
      fieldName: 'mch_id',
      label: '商户配置 ID',
    },
    { component: 'Input', fieldName: 'company', label: '公司名称' },
    {
      component: 'Switch',
      defaultValue: true,
      fieldName: 'enabled',
      label: '启用',
    },
    { component: 'Textarea', fieldName: 'remark', label: '备注' },
  ],
  showDefaultActions: false,
  wrapperClass: 'grid-cols-1 md:grid-cols-2 gap-x-4',
});
const [EditModal, editModalApi] = useVbenModal({
  centered: true,
  class: 'w-[min(700px,calc(100vw-20px))]',
  connectedComponent: ContentModal,
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;
    editModalApi.lock();
    try {
      const values = await formApi.getValues();
      values.mch_id = Number(values.mch_id ?? 0);
      await (editing.value
        ? WechatAppApi.update(editing.value.app_id, values as WechatAppUpdate)
        : WechatAppApi.create(values as WechatAppCreate));
      message.success('微信小程序已保存');
      editModalApi.close();
      await gridApi.query();
    } finally {
      editModalApi.unlock();
    }
  },
});
const [Grid, gridApi] = useVbenVxeGrid<WechatAppConfig>({
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
        field: 'credentials_configured',
        slots: { default: 'credential' },
        title: '凭证',
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
        width: 90,
      },
    ],
    height: 'auto',
    proxyConfig: {
      ajax: {
        query: ({ page }, values) =>
          WechatAppApi.list({
            ...values,
            page: page.currentPage,
            size: page.pageSize,
          }),
      },
    },
    rowConfig: { keyField: 'app_id' },
    toolbarConfig: { custom: true, refresh: true, search: true, zoom: true },
  } as VxeTableGridOptions<WechatAppConfig>,
});
async function loadBound() {
  const result = await WechatAppApi.list({ page: 1, size: 500 });
  const codes = result.items.map((item) => item.credential_code);
  await formApi.updateSchema([
    {
      componentProps: {
        createKind: 'wechat',
        excludeCodes: codes,
        kind: 'wechat',
        profile: 'app',
        placeholder: '选择未绑定的微信小程序凭证',
      },
      fieldName: 'credential_code',
    },
  ]);
}
async function openCreate() {
  editing.value = undefined;
  editModalApi.open();
  await nextTick();
  await loadBound();
  await formApi.reset();
}
async function openEdit(row: WechatAppConfig) {
  editing.value = row;
  editModalApi.open();
  await nextTick();
  await loadBound();
  await formApi.reset();
  await formApi.setValues(await WechatAppApi.detail(row.app_id));
}
function remove(row: WechatAppConfig) {
  Modal.confirm({
    title: `确认删除微信小程序「${row.app_name}」？`,
    okType: 'danger',
    async onOk() {
      await WechatAppApi.remove(row.app_id);
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
    title="微信小程序"
  >
    <EditModal :title="editing ? '编辑微信小程序' : '新建微信小程序'">
      <Alert
        class="mb-3"
        message="AppID、AppSecret、回调 Token 和消息 AES Key 由一份凭证统一保存；已绑定凭证不会出现在新增候选中。"
        show-icon
      /><Form class="mx-1" />
</EditModal><Grid class="management-grid" table-title="微信小程序">
      <template #toolbar-tools>
        <Button type="primary" @click="openCreate">
          <Plus class="size-4" />新建
        </Button>
</template><template #name="{ row }">
        <Button class="px-0" type="link" @click="openEdit(row)">
          {{ row.app_name }}
        </Button>
</template><template #credential="{ row }">
        <Tag :color="row.credentials_configured ? 'success' : 'error'">
          {{ row.credentials_configured ? '已配置' : '缺失' }}
        </Tag>
</template><template #status="{ row }">
        <Tag :color="row.enabled ? 'success' : 'default'">
          {{ row.enabled ? '启用' : '停用' }}
        </Tag>
</template><template #operation="{ row }">
        <Button danger type="link" @click="remove(row)">删除</Button>
      </template>
    </Grid>
  </Page>
</template>
