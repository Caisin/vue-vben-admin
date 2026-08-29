<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type {
  OrgSyncRun,
  OrgSyncSource,
  OrgSyncStatus,
  OrgUserLink,
} from '#/api/auth';

import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { RotateCw } from '@vben/icons';

import {
  Button,
  Descriptions,
  DescriptionsItem,
  message,
  Select,
  Space,
  TabPane,
  Tabs,
  Tag,
} from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { OrgSyncApi } from '#/api/auth';
import { TaskRunApi } from '#/api/task';
import { displayValue } from '#/management';
import { Times } from '#/times';
import { vxeSortParams } from '#/vxe-sort';

import {
  runColumns,
  syncStatusColor,
  syncStatusLabel,
  userColumns,
  useRunFormSchema,
  useUserFormSchema,
} from './data';
import History from './modules/history.vue';
import PopupModal from './modules/popup-modal.vue';

const runSortFields = ['id', 'started_at', 'finished_at'];
const userSortFields = [
  'id',
  'display_name',
  'active',
  'first_seen_at',
  'last_seen_at',
  'rejoin_count',
];

const activeTab = ref('runs');
const sources = ref<OrgSyncSource[]>([]);
const sourcesLoading = ref(false);
const selectedSourceKey = ref<string>();
const syncing = ref(false);
const contactOpen = ref(false);
const selectedContactUser = ref<OrgUserLink>();
let taskPollTimer: number | undefined;

const sourceOptions = computed(() =>
  sources.value.map((source) => ({
    label: source.name,
    value: source.code,
  })),
);
const selectedSource = computed(() => {
  const key = selectedSourceKey.value;
  return sources.value.find((source) => source.code === key);
});

const [HistoryDrawer, historyDrawerApi] = useVbenDrawer({
  connectedComponent: History,
  destroyOnClose: true,
});

const [RunGrid, runGridApi] = useVbenVxeGrid<OrgSyncRun>({
  formOptions: { schema: useRunFormSchema(), submitOnChange: true },
  gridOptions: {
    columns: runColumns(),
    height: 'auto',
    pagerConfig: { pageSize: 20, pageSizes: [10, 20, 50, 100] },
    proxyConfig: {
      ajax: {
        query: async (params, formValues) => {
          const { page } = params;
          const result = await OrgSyncApi.runs({
            page: page.currentPage,
            ...vxeSortParams(params, runSortFields),
            size: page.pageSize,
            source: selectedSource.value?.code,
            status: formValues.status as OrgSyncStatus | undefined,
          });
          return { items: result.items, total: result.total };
        },
      },
    },
    sortConfig: { remote: true },
    rowConfig: { keyField: 'id' },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<OrgSyncRun>,
});

const [UserGrid, userGridApi] = useVbenVxeGrid<OrgUserLink>({
  formOptions: { schema: useUserFormSchema(), submitOnChange: true },
  gridOptions: {
    columns: userColumns(),
    height: 'auto',
    pagerConfig: { pageSize: 20, pageSizes: [10, 20, 50, 100] },
    proxyConfig: {
      ajax: {
        query: async (params, formValues) => {
          const { page } = params;
          const result = await OrgSyncApi.users({
            active: formValues.active as boolean | undefined,
            display_name_prefix:
              String(formValues.display_name_prefix ?? '').trim() || undefined,
            page: page.currentPage,
            ...vxeSortParams(params, userSortFields),
            size: page.pageSize,
            source: selectedSource.value?.code,
          });
          return { items: result.items, total: result.total };
        },
      },
    },
    sortConfig: { remote: true },
    rowConfig: { keyField: 'id' },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<OrgUserLink>,
});

async function loadSources() {
  sourcesLoading.value = true;
  try {
    sources.value = await OrgSyncApi.sources();
    const preferred =
      sources.value.find((source) => source.code.endsWith(':default')) ??
      sources.value[0];
    selectedSourceKey.value = preferred?.code;
  } finally {
    sourcesLoading.value = false;
  }
}

async function reloadActiveGrid() {
  await nextTick();
  if (activeTab.value === 'users') {
    await userGridApi.reload();
    return;
  }
  await runGridApi.reload();
}

async function runSync() {
  const source = selectedSource.value;
  if (!source) {
    message.warning('请先选择组织数据源');
    return;
  }
  syncing.value = true;
  try {
    const task = await OrgSyncApi.run({ source: source.code });
    message.success(`组织同步执行已提交：#${task.id}`);
    pollTask(task.id);
    await reloadActiveGrid();
  } finally {
    syncing.value = false;
  }
}

function pollTask(taskId: number | string) {
  if (taskPollTimer) {
    window.clearInterval(taskPollTimer);
  }
  taskPollTimer = window.setInterval(async () => {
    try {
      const task = await TaskRunApi.detail(taskId);
      await runGridApi.reload();
      if (!['queued', 'retrying', 'running'].includes(task.status)) {
        if (task.status === 'succeeded') {
          message.success(`组织同步任务 #${task.id} 已完成`);
        } else if (task.status === 'failed') {
          message.error(
            task.error_message || `组织同步任务 #${task.id} 执行失败`,
          );
        }
        if (taskPollTimer) {
          window.clearInterval(taskPollTimer);
          taskPollTimer = undefined;
        }
      }
    } catch {
      if (taskPollTimer) {
        window.clearInterval(taskPollTimer);
        taskPollTimer = undefined;
      }
    }
  }, 3000);
}

function refreshForSource() {
  void reloadActiveGrid();
}

function openHistory(row: OrgUserLink) {
  historyDrawerApi.setData(row).open();
}

function openContact(row: OrgUserLink) {
  selectedContactUser.value = row;
  contactOpen.value = true;
}

onMounted(async () => {
  await loadSources();
  refreshForSource();
});

onBeforeUnmount(() => {
  if (taskPollTimer) {
    window.clearInterval(taskPollTimer);
  }
});
</script>

<template>
  <Page
    auto-content-height
    class="management-page"
    content-class="management-content"
  >
    <HistoryDrawer />
    <PopupModal
      v-model:open="contactOpen"
      :footer="null"
      title="人员号码详情"
      width="560px"
    >
      <Descriptions
        v-if="selectedContactUser"
        :column="1"
        bordered
        size="small"
      >
        <DescriptionsItem label="姓名">
          {{ selectedContactUser.display_name }}
        </DescriptionsItem>
        <DescriptionsItem label="手机号">
          {{ displayValue(selectedContactUser.mobile) }}
        </DescriptionsItem>
        <DescriptionsItem label="邮箱">
          {{ displayValue(selectedContactUser.email) }}
        </DescriptionsItem>
        <DescriptionsItem label="本地用户 ID">
          {{ selectedContactUser.uid }}
        </DescriptionsItem>
        <DescriptionsItem label="数据源">
          {{ selectedContactUser.provider }} /
          {{ selectedContactUser.source_id }}
        </DescriptionsItem>
        <DescriptionsItem label="最近同步">
          {{ Times.formatUnix(selectedContactUser.last_seen_at) }}
        </DescriptionsItem>
      </Descriptions>
    </PopupModal>

    <header class="page-heading">
      <h1>组织同步</h1>
      <Space wrap>
        <Select
          v-model:value="selectedSourceKey"
          :loading="sourcesLoading"
          :options="sourceOptions"
          placeholder="组织数据源"
          @change="refreshForSource"
        />
        <Button
          v-access:code="'org_sync:run'"
          :disabled="!selectedSource"
          :loading="syncing"
          type="primary"
          @click="runSync"
        >
          <template #icon><RotateCw /></template>
          立即同步
        </Button>
      </Space>
    </header>

    <Tabs
      v-model:active-key="activeTab"
      class="management-tabs"
      @change="reloadActiveGrid"
    >
      <TabPane key="runs" tab="同步任务">
        <RunGrid class="management-grid" table-title="同步任务">
          <template #runTime="{ row }">
            {{ Times.formatUnix(row.started_at) }}
          </template>
          <template #finishedAt="{ row }">
            {{ row.finished_at ? Times.formatUnix(row.finished_at) : '执行中' }}
          </template>
          <template #runStatus="{ row }">
            <Tag :color="syncStatusColor(row.status)">
              {{ syncStatusLabel(row.status) }}
            </Tag>
          </template>
          <template #departmentSummary="{ row }">
            {{ row.department_total }}
            <span class="muted-summary">
              +{{ row.department_created }} / ~{{ row.department_updated }} /
              -{{ row.department_left }}
            </span>
          </template>
          <template #userSummary="{ row }">
            {{ row.user_total }}
            <span class="muted-summary">
              +{{ row.user_created }} / ~{{ row.user_updated }} / -{{
                row.user_left
              }}
              / 再入职 {{ row.user_rejoined }}
            </span>
          </template>
          <template #runError="{ row }">
            {{ displayValue(row.error_message) }}
          </template>
        </RunGrid>
      </TabPane>

      <TabPane key="users" tab="人员状态">
        <UserGrid
          class="management-grid user-status-grid"
          table-title="人员状态"
        >
          <template #userName="{ row }">
            <Button
              v-access:code="'org_sync:history'"
              class="name-button"
              size="small"
              type="link"
              @click="openHistory(row)"
            >
              {{ row.display_name }}
            </Button>
          </template>
          <template #userStatus="{ row }">
            <Tag :color="row.active ? 'success' : 'default'">
              {{ row.active ? '在职' : '离职' }}
            </Tag>
          </template>
          <template #contactInfo="{ row }">
            <Button
              class="name-button"
              size="small"
              type="link"
              @click="openContact(row)"
            >
              {{ row.mobile || row.email || '查看详情' }}
            </Button>
          </template>
          <template #firstSeenAt="{ row }">
            {{ Times.formatUnix(row.first_seen_at) }}
          </template>
          <template #lastSeenAt="{ row }">
            {{ Times.formatUnix(row.last_seen_at) }}
          </template>
          <template #leftAt="{ row }">
            {{ row.left_at ? Times.formatUnix(row.left_at) : '-' }}
          </template>
        </UserGrid>
      </TabPane>
    </Tabs>
  </Page>
</template>

<style scoped>
.page-heading {
  display: flex;
  flex: 0 0 auto;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.page-heading h1 {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
  letter-spacing: 0;
}

.page-heading :deep(.ant-select) {
  width: min(300px, 48vw);
}

.management-tabs {
  flex: 1;
  min-height: 0;
}

.management-tabs :deep(.ant-tabs-content-holder),
.management-tabs :deep(.ant-tabs-content),
.management-tabs :deep(.ant-tabs-tabpane-active) {
  height: 100%;
  min-height: 0;
}

.management-tabs :deep(.ant-tabs-tabpane-active) {
  display: flex;
  flex-direction: column;
}

.management-grid {
  flex: 1;
  min-height: 0;
}

.user-status-grid {
  min-height: 480px;
}

.filter-bar {
  display: grid;
  gap: 12px;
  padding: 12px;
  margin-bottom: 12px;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

.run-filters {
  grid-template-columns: minmax(180px, 260px) auto;
}

.user-filters {
  grid-template-columns: minmax(180px, 1fr) minmax(140px, 220px) auto;
}

.muted-summary {
  margin-left: 6px;
  color: hsl(var(--muted-foreground));
  overflow-wrap: anywhere;
}

.name-button {
  max-width: 100%;
  padding-inline: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

@media (max-width: 720px) {
  .page-heading {
    flex-direction: column;
    align-items: stretch;
  }

  .page-heading :deep(.ant-select) {
    width: 100%;
  }

  .run-filters,
  .user-filters {
    grid-template-columns: 1fr;
  }
}
</style>
