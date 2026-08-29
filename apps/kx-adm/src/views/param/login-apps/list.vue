<script lang="ts" setup>
import type { MenuProps } from 'antdv-next';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type {
  DingtalkAppConfig,
  DingtalkAppCreate,
  DingtalkAppUpdate,
  WechatAppConfig,
  WechatAppCreate,
  WechatAppUpdate,
} from '#/api';

import { computed, nextTick, onMounted, ref, watch } from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';
import { Plus, Settings } from '@vben/icons';

import {
  Alert,
  Button,
  Dropdown,
  message,
  Modal,
  Space,
  TabPane,
  Tabs,
  Tag,
} from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { LoginAppApi } from '#/api';
import { useVxeRowContextMenu } from '#/views/_shared/use-vxe-row-context-menu';
import { vxeSortParams } from '#/vxe-sort';

import {
  useDingtalkColumns,
  useDingtalkFormSchema,
  useWechatColumns,
  useWechatFormSchema,
} from './data';
import { hasDingtalkCallbackBase } from './modules/dingtalk-callback-base';
import DingtalkCallbackModal from './modules/dingtalk-callback.vue';
import ContentModal from './modules/modal.vue';

const activeTab = ref('dingtalk');
const editingDingtalk = ref<DingtalkAppConfig>();
const editingWechat = ref<WechatAppConfig>();
const dingtalkCallbackBase = ref('');
const dingtalkCallbackLoading = ref(false);
const dingtalkCallbackConfigured = computed(() =>
  hasDingtalkCallbackBase(dingtalkCallbackBase.value),
);

async function loadDingtalkCallbackBase() {
  dingtalkCallbackLoading.value = true;
  try {
    const config = await LoginAppApi.dingtalk_callback_base();
    dingtalkCallbackBase.value = config.callback_base_url;
  } finally {
    dingtalkCallbackLoading.value = false;
  }
}

const [DingtalkCallback, dingtalkCallbackApi] = useVbenModal({
  connectedComponent: DingtalkCallbackModal,
  onOpenChange(open) {
    if (!open) void loadDingtalkCallbackBase();
  },
});
const appContextMenuItems: MenuProps['items'] = [
  { danger: true, key: 'delete', label: '删除' },
];
const dingtalkRowContextMenu = useVxeRowContextMenu<DingtalkAppConfig>(
  appContextMenuItems,
  (key, row) => {
    if (key === 'delete') confirmDeleteDingtalk(row);
  },
);
const wechatRowContextMenu = useVxeRowContextMenu<WechatAppConfig>(
  appContextMenuItems,
  (key, row) => {
    if (key === 'delete') confirmDeleteWechat(row);
  },
);

const dingtalkSortFields = [
  'app_key',
  'app_name',
  'enabled',
  'is_def',
  'created_at',
];
const wechatSortFields = ['app_id', 'app_name', 'enabled', 'created_at'];

const [DingtalkForm, dingtalkFormApi] = useVbenForm({
  layout: 'vertical',
  wrapperClass: 'grid-cols-1 md:grid-cols-2',
  schema: [
    {
      component: 'Input',
      fieldName: 'app_key',
      formItemClass: 'col-span-1',
      label: 'AppKey',
      rules: 'required',
    },
    {
      component: 'Input',
      fieldName: 'app_name',
      formItemClass: 'col-span-1',
      label: '应用名称',
      rules: 'required',
    },
    {
      component: 'InputPassword',
      componentProps: { autocomplete: 'new-password' },
      fieldName: 'app_secret',
      formItemClass: 'col-span-1',
      label: 'AppSecret',
    },
    {
      component: 'Switch',
      defaultValue: false,
      fieldName: 'is_def',
      formItemClass: 'col-span-1',
      label: '默认应用',
    },
    {
      component: 'Switch',
      defaultValue: true,
      fieldName: 'enabled',
      formItemClass: 'col-span-1',
      label: '启用',
    },
    {
      component: 'Textarea',
      componentProps: { autoSize: { maxRows: 6, minRows: 3 } },
      fieldName: 'remark',
      formItemClass: 'md:col-span-2 lg:col-span-3',
      label: '备注',
    },
  ],
  showDefaultActions: false,
});

const [WechatForm, wechatFormApi] = useVbenForm({
  layout: 'vertical',
  wrapperClass: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
  schema: [
    {
      component: 'Input',
      fieldName: 'app_id',
      formItemClass: 'col-span-1',
      label: 'AppID',
      rules: 'required',
    },
    {
      component: 'Input',
      fieldName: 'app_name',
      formItemClass: 'col-span-1',
      label: '应用名称',
      rules: 'required',
    },
    {
      component: 'Input',
      fieldName: 'app_key',
      formItemClass: 'col-span-1',
      label: '业务应用键',
      rules: 'required',
    },
    {
      component: 'InputPassword',
      componentProps: { autocomplete: 'new-password' },
      fieldName: 'app_secret',
      formItemClass: 'col-span-1',
      label: 'AppSecret',
    },
    {
      component: 'InputPassword',
      componentProps: { autocomplete: 'new-password' },
      fieldName: 'token',
      formItemClass: 'col-span-1',
      label: '回调 Token',
    },
    {
      component: 'InputPassword',
      componentProps: { autocomplete: 'new-password' },
      fieldName: 'msg_aes_key',
      formItemClass: 'col-span-1',
      label: '消息加解密密钥',
    },
    { component: 'Input', fieldName: 'offer_id', label: 'Offer ID' },
    {
      component: 'InputNumber',
      componentProps: { class: 'w-full', min: 0 },
      defaultValue: 0,
      fieldName: 'mch_id',
      formItemClass: 'col-span-1',
      label: '商户配置 ID',
    },
    { component: 'Input', fieldName: 'company', label: '公司名称' },
    {
      component: 'Switch',
      defaultValue: true,
      fieldName: 'enabled',
      formItemClass: 'col-span-1',
      label: '启用',
    },
    {
      component: 'Textarea',
      componentProps: { autoSize: { maxRows: 6, minRows: 3 } },
      fieldName: 'remark',
      formItemClass: 'md:col-span-2 lg:col-span-3',
      label: '备注',
    },
  ],
  showDefaultActions: false,
});

const dingtalkModalTitle = computed(() =>
  editingDingtalk.value ? '编辑钉钉应用' : '新建钉钉应用',
);
const wechatModalTitle = computed(() =>
  editingWechat.value ? '编辑微信应用' : '新建微信应用',
);

const [DingtalkModal, dingtalkModalApi] = useVbenModal({
  connectedComponent: ContentModal,
  destroyOnClose: true,
  async onConfirm() {
    const { valid } = await dingtalkFormApi.validate();
    if (!valid) return;

    dingtalkModalApi.lock();
    try {
      const values = await dingtalkFormApi.getValues();
      if (editingDingtalk.value) {
        const { app_key: _app_key, ...data } = values;
        await LoginAppApi.dingtalk_update(
          editingDingtalk.value.app_key,
          data as DingtalkAppUpdate,
        );
      } else {
        if (!String(values.app_secret ?? '').trim()) {
          message.error('新建钉钉应用时必须填写 AppSecret');
          return;
        }
        await LoginAppApi.dingtalk_create(values as DingtalkAppCreate);
      }
      message.success('保存成功');
      dingtalkModalApi.close();
      await dingtalkGridApi.query();
    } finally {
      dingtalkModalApi.lock(false);
    }
  },
});

const [WechatModal, wechatModalApi] = useVbenModal({
  connectedComponent: ContentModal,
  destroyOnClose: true,
  async onConfirm() {
    const { valid } = await wechatFormApi.validate();
    if (!valid) return;

    wechatModalApi.lock();
    try {
      const values = await wechatFormApi.getValues();
      values.mch_id = Number(values.mch_id ?? 0);
      if (editingWechat.value) {
        const { app_id: _app_id, ...data } = values;
        await LoginAppApi.wechat_update(
          editingWechat.value.app_id,
          data as WechatAppUpdate,
        );
      } else {
        if (!String(values.app_secret ?? '').trim()) {
          message.error('新建微信应用时必须填写 AppSecret');
          return;
        }
        await LoginAppApi.wechat_create(values as WechatAppCreate);
      }
      message.success('保存成功');
      wechatModalApi.close();
      await wechatGridApi.query();
    } finally {
      wechatModalApi.lock(false);
    }
  },
});

const [DingtalkGrid, dingtalkGridApi] = useVbenVxeGrid<DingtalkAppConfig>({
  formOptions: {
    schema: useDingtalkFormSchema(),
    submitOnChange: true,
  },
  gridOptions: {
    columns: useDingtalkColumns(onDingtalkEnabledChange),
    height: 'auto',
    pagerConfig: { pageSize: 20, pageSizes: [10, 20, 50, 100] },
    proxyConfig: {
      ajax: {
        query: async (params, formValues) => {
          const { page } = params;
          const result = await LoginAppApi.dingtalk_list({
            ...formValues,
            ...vxeSortParams(params, dingtalkSortFields),
            page: page.currentPage,
            size: page.pageSize,
          });
          return { items: result.items, total: result.total };
        },
      },
    },
    sortConfig: { remote: true },
    rowConfig: { keyField: 'app_key' },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<DingtalkAppConfig>,
});

const [WechatGrid, wechatGridApi] = useVbenVxeGrid<WechatAppConfig>({
  formOptions: {
    schema: useWechatFormSchema(),
    submitOnChange: true,
  },
  gridOptions: {
    columns: useWechatColumns(onWechatEnabledChange),
    height: 'auto',
    pagerConfig: { pageSize: 20, pageSizes: [10, 20, 50, 100] },
    proxyConfig: {
      ajax: {
        query: async (params, formValues) => {
          const { page } = params;
          const result = await LoginAppApi.wechat_list({
            ...formValues,
            ...vxeSortParams(params, wechatSortFields),
            page: page.currentPage,
            size: page.pageSize,
          });
          return { items: result.items, total: result.total };
        },
      },
    },
    sortConfig: { remote: true },
    rowConfig: { keyField: 'app_id' },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<WechatAppConfig>,
});

async function onDingtalkEnabledChange(
  enabled: boolean,
  row: DingtalkAppConfig,
) {
  await LoginAppApi.dingtalk_update(row.app_key, {
    app_name: row.app_name,
    app_secret: '',
    enabled,
    is_def: row.is_def,
    remark: row.remark,
  });
  return true;
}

async function onWechatEnabledChange(enabled: boolean, row: WechatAppConfig) {
  await LoginAppApi.wechat_update(row.app_id, {
    app_key: row.app_key,
    app_name: row.app_name,
    app_secret: '',
    company: row.company,
    enabled,
    mch_id: row.mch_id,
    msg_aes_key: '',
    offer_id: row.offer_id,
    remark: row.remark,
    token: '',
  });
  return true;
}

async function openDingtalkCreate() {
  editingDingtalk.value = undefined;
  dingtalkModalApi.open();
  await nextTick();
  await dingtalkFormApi.reset();
  await dingtalkFormApi.updateSchema([
    { componentProps: { disabled: false }, fieldName: 'app_key' },
  ]);
}

async function openDingtalkEdit(row: DingtalkAppConfig) {
  editingDingtalk.value = row;
  dingtalkModalApi.open();
  await nextTick();
  await dingtalkFormApi.reset();
  const detail = await LoginAppApi.dingtalk_detail(row.app_key);
  await dingtalkFormApi.setValues({ ...detail, app_secret: '' });
  await dingtalkFormApi.updateSchema([
    { componentProps: { disabled: true }, fieldName: 'app_key' },
  ]);
}

async function deleteDingtalk(row: DingtalkAppConfig) {
  await LoginAppApi.dingtalk_remove(row.app_key);
  message.success('删除成功');
  await dingtalkGridApi.query();
}

function confirmDeleteDingtalk(row: DingtalkAppConfig) {
  Modal.confirm({
    async onOk() {
      await deleteDingtalk(row);
    },
    okText: '删除',
    okType: 'danger',
    title: `确认删除钉钉应用「${row.app_name}」？`,
  });
}

async function openWechatCreate() {
  editingWechat.value = undefined;
  wechatModalApi.open();
  await nextTick();
  await wechatFormApi.reset();
  await wechatFormApi.updateSchema([
    { componentProps: { disabled: false }, fieldName: 'app_id' },
  ]);
}

async function openWechatEdit(row: WechatAppConfig) {
  editingWechat.value = row;
  wechatModalApi.open();
  await nextTick();
  await wechatFormApi.reset();
  const detail = await LoginAppApi.wechat_detail(row.app_id);
  await wechatFormApi.setValues({
    ...detail,
    app_secret: '',
    msg_aes_key: '',
    token: '',
  });
  await wechatFormApi.updateSchema([
    { componentProps: { disabled: true }, fieldName: 'app_id' },
  ]);
}

async function deleteWechat(row: WechatAppConfig) {
  await LoginAppApi.wechat_remove(row.app_id);
  message.success('删除成功');
  await wechatGridApi.query();
}

function confirmDeleteWechat(row: WechatAppConfig) {
  Modal.confirm({
    async onOk() {
      await deleteWechat(row);
    },
    okText: '删除',
    okType: 'danger',
    title: `确认删除微信应用「${row.app_name}」？`,
  });
}

function bindContextMenus() {
  void dingtalkRowContextMenu.bind(dingtalkGridApi.grid);
  void wechatRowContextMenu.bind(wechatGridApi.grid);
}

onMounted(() => {
  bindContextMenus();
  void loadDingtalkCallbackBase();
});
watch(activeTab, async () => {
  await nextTick();
  bindContextMenus();
});
</script>

<template>
  <Page
    auto-content-height
    class="management-page"
    content-class="management-content"
    title="第三方登录配置"
  >
    <DingtalkCallback />
    <DingtalkModal :title="dingtalkModalTitle">
      <Alert
        class="mb-3"
        message="AppSecret 属于隐私字段，编辑时不会回填明文；留空表示保持原凭据不变。"
        show-icon
        type="info"
      />
      <DingtalkForm class="mx-1" />
    </DingtalkModal>
    <WechatModal :title="wechatModalTitle">
      <Alert
        class="mb-3"
        message="AppSecret、Token 和消息加解密密钥不会回填明文；仅在需要替换时重新填写。"
        show-icon
        type="info"
      />
      <WechatForm class="mx-1" />
    </WechatModal>

    <header class="page-heading">
      <div>
        <h1>第三方登录配置</h1>
      </div>
      <div class="page-heading__status">
        <Tag :color="dingtalkCallbackConfigured ? 'success' : 'warning'">
          钉钉回调{{ dingtalkCallbackConfigured ? '已配置' : '待配置' }}
        </Tag>
        <Button size="small" type="link" @click="dingtalkCallbackApi.open()">
          <Settings class="size-4" />
          登录回调配置
        </Button>
      </div>
    </header>

    <Tabs v-model:active-key="activeTab" class="management-tabs">
      <TabPane key="dingtalk" tab="钉钉应用">
        <Alert
          v-if="!dingtalkCallbackLoading && !dingtalkCallbackConfigured"
          class="mb-3"
          message="钉钉登录回调地址尚未配置"
          show-icon
          type="warning"
        >
          <template #action>
            <Button size="small" @click="dingtalkCallbackApi.open()">
              <Settings class="size-4" />
              登录回调配置
            </Button>
          </template>
        </Alert>
        <DingtalkGrid table-title="钉钉应用">
          <Dropdown
            :menu="dingtalkRowContextMenu.menu.value"
            :open="dingtalkRowContextMenu.open.value"
            :trigger="['click']"
            @open-change="dingtalkRowContextMenu.onOpenChange"
          >
            <span
              class="fixed size-0 overflow-hidden"
              :style="dingtalkRowContextMenu.anchorStyle.value"
            ></span>
          </Dropdown>
          <template #dingtalkNameCell="{ row }">
            <div class="flex min-w-0 items-center gap-2">
              <Button
                class="min-w-0 truncate px-0 text-left"
                size="small"
                type="link"
                @click.stop="openDingtalkEdit(row)"
              >
                {{ row.app_name }}
              </Button>
            </div>
          </template>
          <template #toolbar-tools>
            <Space wrap size="small">
              <Button @click="dingtalkCallbackApi.open()">
                <Settings class="size-4" />
                登录回调配置
              </Button>
              <Button type="primary" @click="openDingtalkCreate">
                <Plus class="size-4" />
                新建
              </Button>
            </Space>
          </template>
        </DingtalkGrid>
      </TabPane>
      <TabPane key="wechat" tab="微信应用">
        <WechatGrid table-title="微信应用">
          <Dropdown
            :menu="wechatRowContextMenu.menu.value"
            :open="wechatRowContextMenu.open.value"
            :trigger="['click']"
            @open-change="wechatRowContextMenu.onOpenChange"
          >
            <span
              class="fixed size-0 overflow-hidden"
              :style="wechatRowContextMenu.anchorStyle.value"
            ></span>
          </Dropdown>
          <template #wechatNameCell="{ row }">
            <div class="flex min-w-0 items-center gap-2">
              <Button
                class="min-w-0 truncate px-0 text-left"
                size="small"
                type="link"
                @click.stop="openWechatEdit(row)"
              >
                {{ row.app_name }}
              </Button>
            </div>
          </template>
          <template #toolbar-tools>
            <Button type="primary" @click="openWechatCreate">
              <Plus class="size-4" />
              新建
            </Button>
          </template>
        </WechatGrid>
      </TabPane>
    </Tabs>
  </Page>
</template>

<style scoped>
.management-tabs {
  flex: 1;
  min-height: 0;
}

.management-tabs :deep(.ant-tabs-content),
.management-tabs :deep(.ant-tabs-tabpane) {
  height: 100%;
  min-height: 0;
}

.page-heading__status {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  justify-content: flex-end;
}

@media (max-width: 760px) {
  .page-heading__status {
    justify-content: flex-start;
  }
}
</style>
