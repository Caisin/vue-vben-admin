<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { CredentialView } from '#/api/credential';
import type {
  TikTokMiniApp,
  TikTokMiniAppWhitelist,
  TikTokMiniAppWrite,
} from '#/api/developer-account';

import { nextTick, onBeforeUnmount, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { List, Plus, RotateCw } from '@vben/icons';

import {
  Button,
  Drawer,
  Form,
  FormItem,
  Input,
  message,
  Modal,
  Select,
  Space,
} from 'antdv-next';

import { useVbenVxeGrid, VbenTableAction } from '#/adapter/vxe-table';
import { CredentialApi } from '#/api/credential';
import { DeveloperAccountApi } from '#/api/developer-account';
import BusinessExport from '#/components/business-export';
import BusinessImport from '#/components/business-import';

import {
  miniAppColumns,
  miniAppSearchSchema,
  whitelistColumns,
  whitelistSearchSchema,
} from './tiktok-mini-apps.data';

const editing = ref<TikTokMiniApp>();
const formOpen = ref(false);
const saving = ref(false);
const syncOpen = ref(false);
const syncing = ref(false);
const loadingCredentials = ref(false);
const syncCredentialCode = ref<string>();
const activeSyncTaskId = ref<number | string>();
const ttWebCredentials = ref<CredentialView[]>([]);
const whitelistOpen = ref(false);
const whitelistMiniApp = ref<TikTokMiniApp>();
const form = reactive<TikTokMiniAppWrite>({
  client_key: '',
  name: '',
  remark: '',
});
let syncTaskPollTimer: number | undefined;
const whitelistExportDefaults = {
  customer_group: '长沙古言网络科技有限公司',
  include_completed: false,
};

const [Grid, gridApi] = useVbenVxeGrid<TikTokMiniApp>({
  formOptions: {
    schema: miniAppSearchSchema(),
    submitOnChange: true,
  },
  gridOptions: {
    columns: miniAppColumns(),
    height: 'auto',
    pagerConfig: { pageSize: 20, pageSizes: [10, 20, 50, 100] },
    proxyConfig: {
      ajax: {
        query: async ({ page }, values) =>
          DeveloperAccountApi.tiktokMiniApps({
            ...values,
            page: page.currentPage,
            size: page.pageSize,
          }),
      },
    },
    rowConfig: { keyField: 'client_key' },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<TikTokMiniApp>,
});

const [WhitelistGrid, whitelistGridApi] =
  useVbenVxeGrid<TikTokMiniAppWhitelist>({
    formOptions: {
      schema: whitelistSearchSchema(),
      submitOnChange: true,
    },
    gridOptions: {
      columns: whitelistColumns(),
      height: 560,
      pagerConfig: { pageSize: 20, pageSizes: [10, 20, 50, 100] },
      proxyConfig: {
        ajax: {
          query: async ({ page }, values) =>
            DeveloperAccountApi.tiktokMiniAppWhitelists({
              ...values,
              mini_app_client_key: whitelistMiniApp.value?.client_key,
              page: page.currentPage,
              size: page.pageSize,
            }),
        },
      },
      rowConfig: { keyField: 'row_key' },
      toolbarConfig: {
        custom: true,
        export: false,
        refresh: true,
        search: true,
        zoom: true,
      },
    } as VxeTableGridOptions<TikTokMiniAppWhitelist>,
  });

function edit(row?: TikTokMiniApp) {
  editing.value = row;
  Object.assign(form, {
    client_key: row?.client_key ?? '',
    name: row?.name ?? '',
    remark: row?.remark ?? '',
  });
  formOpen.value = true;
}

async function save() {
  if (!form.name.trim() || !form.client_key.trim()) {
    message.warning('请填写小程序名称和 Client Key');
    return;
  }
  saving.value = true;
  try {
    const data = {
      client_key: form.client_key.trim(),
      name: form.name.trim(),
      remark: form.remark.trim(),
    };
    await (editing.value
      ? DeveloperAccountApi.updateTiktokMiniApp(editing.value.client_key, data)
      : DeveloperAccountApi.createTiktokMiniApp(data));
    formOpen.value = false;
    message.success('TT 小程序已保存');
    await gridApi.query();
  } finally {
    saving.value = false;
  }
}

function remove(row: TikTokMiniApp) {
  Modal.confirm({
    content: `将同时删除 ${row.whitelist_count} 条加白关系。`,
    okButtonProps: { danger: true },
    title: `删除 ${row.name}`,
    onOk: async () => {
      await DeveloperAccountApi.deleteTiktokMiniApp(row.client_key);
      message.success('TT 小程序已删除');
      await gridApi.query();
    },
  });
}

async function showWhitelists(row?: TikTokMiniApp) {
  whitelistMiniApp.value = row;
  whitelistOpen.value = true;
  await nextTick();
  await whitelistGridApi.query();
}

async function onWhitelistImportCompleted() {
  await gridApi.query();
  if (whitelistOpen.value) await whitelistGridApi.query();
}

async function loadTtWebCredentials() {
  const firstPage = await CredentialApi.list({
    kind: 'tt_web',
    page: 1,
    profile: 'tt_web',
    size: 100,
    state: 'active',
  });
  const remainingPages = await Promise.all(
    Array.from({ length: Math.max(0, firstPage.total_pages - 1) }, (_, index) =>
      CredentialApi.list({
        kind: 'tt_web',
        page: index + 2,
        profile: 'tt_web',
        size: 100,
        state: 'active',
      }),
    ),
  );
  return [firstPage, ...remainingPages].flatMap((page) => page.items);
}

async function openSync() {
  syncOpen.value = true;
  syncCredentialCode.value = undefined;
  loadingCredentials.value = true;
  try {
    ttWebCredentials.value = await loadTtWebCredentials();
    if (ttWebCredentials.value.length === 1) {
      syncCredentialCode.value = ttWebCredentials.value[0]?.code;
    }
  } finally {
    loadingCredentials.value = false;
  }
}

async function syncMiniApps() {
  if (!syncCredentialCode.value) {
    message.warning('请选择 TT Web 凭证');
    return;
  }
  syncing.value = true;
  try {
    const task = await DeveloperAccountApi.syncTiktokMiniApps(
      syncCredentialCode.value,
    );
    syncOpen.value = false;
    message.success(`同步任务已提交：#${task.id}`);
    pollSyncTask(task.id);
  } finally {
    syncing.value = false;
  }
}

function clearSyncTaskPoll() {
  if (syncTaskPollTimer) {
    window.clearInterval(syncTaskPollTimer);
    syncTaskPollTimer = undefined;
  }
}

async function refreshSyncTask() {
  const taskId = activeSyncTaskId.value;
  if (!taskId) return;
  try {
    const task = await DeveloperAccountApi.tiktokMiniAppSyncTask(taskId);
    if (['queued', 'retrying', 'running'].includes(task.status)) return;
    clearSyncTaskPoll();
    activeSyncTaskId.value = undefined;
    if (task.status === 'succeeded') {
      message.success(task.message || `同步任务 #${task.id} 已完成`);
      await gridApi.query();
    } else {
      message.error(
        task.error_message || task.message || `同步任务 #${task.id} 未完成`,
      );
    }
  } catch {
    clearSyncTaskPoll();
    activeSyncTaskId.value = undefined;
    message.error(`无法查询同步任务 #${taskId} 的状态`);
  }
}

function pollSyncTask(taskId: number | string) {
  clearSyncTaskPoll();
  activeSyncTaskId.value = taskId;
  void refreshSyncTask();
  syncTaskPollTimer = window.setInterval(() => {
    void refreshSyncTask();
  }, 3000);
}

onBeforeUnmount(clearSyncTaskPoll);
</script>

<template>
  <Page
    auto-content-height
    class="management-page"
    content-class="management-content"
  >
    <Grid class="management-grid" table-title="TT 小程序">
      <template #toolbar-tools>
        <Space>
          <Button
            v-access:code="'developer-account:tiktok-mini-app-sync'"
            :loading="Boolean(activeSyncTaskId)"
            @click="openSync"
          >
            <RotateCw class="size-4" />同步小程序
          </Button>
          <span
            v-access:code="'developer-account:tiktok-mini-app-whitelist-import'"
          >
            <BusinessImport
              button-text="导入加白表格"
              definition-code="developer_account.tiktok_whitelist.import"
              @completed="onWhitelistImportCompleted"
            />
          </span>
          <span
            v-access:code="'developer-account:tiktok-mini-app-whitelist-export'"
          >
            <BusinessExport
              button-text="导出加白表格"
              :default-options="whitelistExportDefaults"
              definition-code="developer_account.tiktok_whitelist.export"
            />
          </span>
          <Button @click="showWhitelists()">
            <List class="size-4" />全部加白明细
          </Button>
          <Button
            v-access:code="'developer-account:tiktok-mini-app-create'"
            type="primary"
            @click="edit()"
          >
            <Plus class="size-4" />新增小程序
          </Button>
        </Space>
      </template>
      <template #whitelistCount="{ row }">
        <Button type="link" @click="showWhitelists(row)">
          {{ row.whitelist_count }}
        </Button>
      </template>
      <template #operation="{ row }">
        <VbenTableAction
          :actions="[
            {
              auth: ['developer-account:tiktok-mini-app-update'],
              icon: 'lucide:edit',
              onClick: () => edit(row),
              tooltip: '编辑',
            },
          ]"
          :dropdown-actions="[
            {
              auth: ['developer-account:tiktok-mini-app-delete'],
              danger: true,
              icon: 'lucide:trash-2',
              onClick: () => remove(row),
              text: '删除',
            },
          ]"
          align="center"
        />
      </template>
    </Grid>

    <Modal
      v-model:open="formOpen"
      :confirm-loading="saving"
      :title="editing ? '编辑 TT 小程序' : '新增 TT 小程序'"
      @ok="save"
    >
      <Form layout="vertical">
        <FormItem label="小程序名称" required>
          <Input v-model:value="form.name" :maxlength="128" />
        </FormItem>
        <FormItem label="Client Key" required>
          <Input
            v-model:value="form.client_key"
            :disabled="Boolean(editing)"
            :maxlength="128"
          />
        </FormItem>
        <FormItem label="备注">
          <Input v-model:value="form.remark" :maxlength="500" />
        </FormItem>
      </Form>
    </Modal>

    <Modal
      v-model:open="syncOpen"
      :confirm-loading="syncing"
      title="同步 TT 小程序"
      @ok="syncMiniApps"
    >
      <Form layout="vertical">
        <FormItem label="TT Web 凭证" required>
          <Select
            v-model:value="syncCredentialCode"
            :loading="loadingCredentials"
            :not-found-content="
              loadingCredentials ? '正在加载' : '暂无可用的 TT Web 凭证'
            "
            :options="
              ttWebCredentials.map((item) => ({
                label: `${item.name} (${item.code})`,
                value: item.code,
              }))
            "
            placeholder="选择凭证"
            show-search
          />
        </FormItem>
      </Form>
    </Modal>

    <Drawer
      v-model:open="whitelistOpen"
      :title="
        whitelistMiniApp
          ? `${whitelistMiniApp.name} · 加白明细`
          : '全部加白明细'
      "
      :size="1200"
    >
      <WhitelistGrid table-title="TT 小程序加白明细" />
    </Drawer>
  </Page>
</template>
