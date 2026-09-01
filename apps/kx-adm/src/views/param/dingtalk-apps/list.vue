<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type {
  DingtalkAppConfig,
  DingtalkAppCreate,
  DingtalkAppUpdate,
} from '#/api';

import { computed, nextTick, ref } from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';
import { Plus, Settings } from '@vben/icons';

import { Alert, Button, message, Modal, Space, Tag } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { DingtalkAppApi } from '#/api';

import { hasDingtalkCallbackBase } from '../login-apps/modules/dingtalk-callback-base';
import DingtalkCallbackModal from '../login-apps/modules/dingtalk-callback.vue';
import ContentModal from '../login-apps/modules/modal.vue';

const editing = ref<DingtalkAppConfig>();
const callbackBase = ref('');
const callbackConfigured = computed(() =>
  hasDingtalkCallbackBase(callbackBase.value),
);
const [CallbackModal, callbackModalApi] = useVbenModal({
  connectedComponent: DingtalkCallbackModal,
  onOpenChange(open) {
    if (!open) void loadCallback();
  },
});
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
        createKind: 'dingtalk',
        kind: 'dingtalk',
        profile: 'app',
        placeholder: '选择未绑定的 AppKey / AppSecret 凭证',
      },
      fieldName: 'credential_code',
      label: '钉钉应用凭证',
      rules: 'required',
    },
    {
      component: 'Switch',
      defaultValue: false,
      fieldName: 'is_def',
      label: '默认应用',
    },
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
      await (editing.value
        ? DingtalkAppApi.update(
            editing.value.app_key,
            values as DingtalkAppUpdate,
          )
        : DingtalkAppApi.create(values as DingtalkAppCreate));
      message.success('钉钉应用已保存');
      editModalApi.close();
      await gridApi.query();
    } finally {
      editModalApi.unlock();
    }
  },
});
const [Grid, gridApi] = useVbenVxeGrid<DingtalkAppConfig>({
  formOptions: {
    schema: [
      { component: 'Input', fieldName: 'app_key_prefix', label: 'AppKey' },
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
      { field: 'app_key', minWidth: 190, title: 'AppKey' },
      {
        field: 'app_name',
        minWidth: 220,
        slots: { default: 'name' },
        title: '应用名称',
      },
      {
        field: 'is_def',
        slots: { default: 'default' },
        title: '默认',
        width: 80,
      },
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
          DingtalkAppApi.list({
            ...values,
            page: page.currentPage,
            size: page.pageSize,
          }),
      },
    },
    rowConfig: { keyField: 'app_key' },
    toolbarConfig: { custom: true, refresh: true, search: true, zoom: true },
  } as VxeTableGridOptions<DingtalkAppConfig>,
});
async function loadCallback() {
  const config = await DingtalkAppApi.callbackBase();
  callbackBase.value = config.callback_base_url;
}
async function loadBound() {
  const result = await DingtalkAppApi.list({ page: 1, size: 500 });
  const codes = result.items.map((item) => item.credential_code);
  await formApi.updateSchema([
    {
      componentProps: {
        createKind: 'dingtalk',
        excludeCodes: codes,
        kind: 'dingtalk',
        profile: 'app',
        placeholder: '选择未绑定的 AppKey / AppSecret 凭证',
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
async function openEdit(row: DingtalkAppConfig) {
  editing.value = row;
  editModalApi.open();
  await nextTick();
  await loadBound();
  await formApi.reset();
  await formApi.setValues(await DingtalkAppApi.detail(row.app_key));
}
function remove(row: DingtalkAppConfig) {
  Modal.confirm({
    title: `确认删除钉钉应用「${row.app_name}」？`,
    okType: 'danger',
    async onOk() {
      await DingtalkAppApi.remove(row.app_key);
      await gridApi.query();
    },
  });
}
void loadCallback();
</script>
<template>
  <Page
    auto-content-height
    class="management-page"
    content-class="management-content"
    title="钉钉应用"
  >
    <CallbackModal /><EditModal
      :title="editing ? '编辑钉钉应用' : '新建钉钉应用'"
    >
      <Alert
        class="mb-3"
        message="应用主键从凭证 AppKey 派生；已绑定凭证不会出现在新增候选中。"
        show-icon
      /><Form class="mx-1" />
</EditModal><Alert
      v-if="!callbackConfigured"
      class="mb-3"
      message="钉钉登录回调地址尚未配置"
      show-icon
      type="warning"
    >
      <template #action>
        <Button @click="callbackModalApi.open()">
          <Settings class="size-4" />配置回调
        </Button>
      </template>
</Alert><Grid class="management-grid" table-title="钉钉应用">
      <template #toolbar-tools>
        <Space>
          <Button @click="callbackModalApi.open()">
            <Settings class="size-4" />登录回调配置
</Button><Button type="primary" @click="openCreate">
            <Plus class="size-4" />新建
          </Button>
        </Space>
</template><template #name="{ row }">
        <Button class="px-0" type="link" @click="openEdit(row)">
          {{ row.app_name }}
        </Button>
</template><template #default="{ row }">
        <Tag>{{ row.is_def ? '是' : '否' }}</Tag>
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
