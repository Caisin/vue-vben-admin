<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { EnabledStatus, WmxtProfileEntry, WmxtRole } from '#/api/wmxt';

import { nextTick, onUnmounted, ref } from 'vue';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { useSortable } from '@vben/hooks';
import { GripVertical, IconifyIcon, Plus } from '@vben/icons';

import {
  Button,
  Image,
  message,
  Popconfirm,
  Space,
  TabPane,
  Tabs,
} from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { WmxtAdminApi } from '#/api/wmxt';

import {
  builtinIconifyName,
  profileTargetOptions,
  targetLabel,
  useColumns,
  useFormSchema,
} from './data';
import ProfileEntryForm from './modules/form.vue';

const activeTarget = ref<WmxtRole>('personal');
let sortable: null | { destroy: () => void } = null;

const [FormDrawer, formDrawerApi] = useVbenDrawer({
  connectedComponent: ProfileEntryForm,
  destroyOnClose: true,
});

const [Grid, gridApi] = useVbenVxeGrid<WmxtProfileEntry>({
  formOptions: { schema: useFormSchema(), submitOnChange: true },
  gridOptions: {
    columns: useColumns(onStatusChange),
    height: 'auto',
    pagerConfig: { pageSize: 100, pageSizes: [20, 50, 100] },
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) => {
          const result = await WmxtAdminApi.profile_entries({
            ...(formValues as Record<string, boolean | number | string>),
            page: page.currentPage,
            size: page.pageSize,
            target: activeTarget.value,
          });
          void nextTick(initSortable);
          return result;
        },
      },
    },
    rowConfig: { keyField: 'id' },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<WmxtProfileEntry>,
});

function onRefresh() {
  gridApi.query();
}

function openCreate() {
  formDrawerApi.setData({ target: activeTarget.value }).open();
}

function openEdit(row: WmxtProfileEntry) {
  formDrawerApi.setData({ row, target: activeTarget.value }).open();
}

async function onRemove(row: WmxtProfileEntry) {
  await WmxtAdminApi.remove_profile_entry(row.id);
  message.success('我的功能已删除');
  onRefresh();
}

async function onStatusChange(status: EnabledStatus, row: WmxtProfileEntry) {
  await WmxtAdminApi.update_profile_entry(row.id, {
    code: row.code,
    group_name: row.group_name,
    icon_file_id: row.icon_file_id || 0,
    icon_name: row.icon_name,
    page_id: row.page_id,
    sort_order: row.sort_order,
    status,
    subtitle: row.subtitle,
    target: row.target,
    title: row.title,
  });
  onRefresh();
  return true;
}

async function saveVisibleOrder(rows: WmxtProfileEntry[]) {
  await WmxtAdminApi.order_profile_entries({
    items: rows.map((row, index) => ({ id: row.id, sort_order: index })),
    target: activeTarget.value,
  });
  message.success('排序已保存');
  onRefresh();
}

async function initSortable() {
  await nextTick();
  sortable?.destroy();
  sortable = null;
  const body = gridApi.grid.$el?.querySelector(
    '.vxe-table--body tbody',
  ) as HTMLElement | null;
  if (!body) return;
  const { initializeSortable } = useSortable(body, {
    handle: '.profile-entry-drag-handle',
    async onEnd(event) {
      if (
        event.oldIndex === undefined ||
        event.newIndex === undefined ||
        event.oldIndex === event.newIndex
      )
        return;
      const rows = gridApi.grid.getTableData()
        .visibleData as WmxtProfileEntry[];
      await saveVisibleOrder(rows);
    },
  });
  sortable = await initializeSortable();
}

function onTargetChange() {
  onRefresh();
}

onUnmounted(() => sortable?.destroy());
</script>

<template>
  <Page
    auto-content-height
    class="management-page"
    content-class="management-content"
  >
    <FormDrawer @success="onRefresh" />
    <header class="page-heading"><h1>我的功能配置</h1></header>
    <Tabs
      v-model:active-key="activeTarget"
      class="profile-entry-tabs"
      @change="onTargetChange"
    >
      <TabPane
        v-for="item in profileTargetOptions"
        :key="item.value"
        :tab="item.label"
      />
    </Tabs>
    <Grid
      class="management-grid"
      :table-title="`${targetLabel(activeTarget)}我的功能（拖动排序）`"
    >
      <template #toolbar-tools>
        <Button
          type="primary"
          v-access:code="['wmxt:profile-entry:write']"
          @click="openCreate"
        >
          <Plus class="size-4" />
          新增功能
        </Button>
      </template>
      <template #drag>
        <GripVertical
          class="profile-entry-drag-handle size-4 cursor-move text-gray-400"
        />
      </template>
      <template #title="{ row }">
        <Button
          v-access:code="['wmxt:profile-entry:write']"
          type="link"
          class="px-0"
          @click="openEdit(row)"
        >
          {{ row.title }}
        </Button>
      </template>
      <template #icon="{ row }">
        <Image
          v-if="row.icon_url"
          :preview="false"
          :src="row.icon_url"
          :width="30"
          :height="30"
        />
        <IconifyIcon
          v-else
          :icon="builtinIconifyName(row.icon_name)"
          class="size-5"
        />
      </template>
      <template #actions="{ row }">
        <Space>
          <Button
            type="link"
            size="small"
            v-access:code="['wmxt:profile-entry:write']"
            @click="openEdit(row)"
          >
            编辑
          </Button>
          <Popconfirm title="确认删除该功能？" @confirm="onRemove(row)">
            <Button
              danger
              type="link"
              size="small"
              v-access:code="['wmxt:profile-entry:write']"
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      </template>
    </Grid>
  </Page>
</template>

<style scoped>
.profile-entry-tabs {
  margin-bottom: 12px;
}
</style>
