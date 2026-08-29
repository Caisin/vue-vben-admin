<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { EnabledStatus, WmxtHomeEntry, WmxtRole } from '#/api/wmxt';

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
  homeTargetOptions,
  targetLabel,
  useColumns,
  useFormSchema,
} from './data';
import HomeEntryForm from './modules/form.vue';

const activeTarget = ref<WmxtRole>('personal');
let sortable: null | { destroy: () => void } = null;

const [FormDrawer, formDrawerApi] = useVbenDrawer({
  connectedComponent: HomeEntryForm,
  destroyOnClose: true,
});

const [Grid, gridApi] = useVbenVxeGrid<WmxtHomeEntry>({
  formOptions: { schema: useFormSchema(), submitOnChange: true },
  gridOptions: {
    columns: useColumns(onStatusChange),
    height: 'auto',
    pagerConfig: { pageSize: 20, pageSizes: [10, 20, 50, 100] },
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) => {
          const result = await WmxtAdminApi.home_entries({
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
  } as VxeTableGridOptions<WmxtHomeEntry>,
});

function onRefresh() {
  gridApi.query();
}

function openCreate() {
  formDrawerApi.setData({ target: activeTarget.value }).open();
}

function openEdit(row: WmxtHomeEntry) {
  formDrawerApi.setData({ row, target: activeTarget.value }).open();
}

async function onRemove(row: WmxtHomeEntry) {
  await WmxtAdminApi.remove_home_entry(row.id);
  message.success('首页入口已删除');
  onRefresh();
}

async function onStatusChange(status: EnabledStatus, row: WmxtHomeEntry) {
  await WmxtAdminApi.update_home_entry(row.id, {
    code: row.code,
    icon_file_id: row.icon_file_id || 0,
    icon_name: row.icon_name,
    page_id: row.page_id,
    sort_order: row.sort_order,
    status,
    target: row.target,
    title: row.title,
  });
  onRefresh();
  return true;
}

async function saveVisibleOrder(rows: WmxtHomeEntry[]) {
  await WmxtAdminApi.order_home_entries({
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
    handle: '.home-entry-drag-handle',
    async onEnd(event) {
      if (
        event.oldIndex === undefined ||
        event.newIndex === undefined ||
        event.oldIndex === event.newIndex
      ) {
        return;
      }
      const rows = gridApi.grid.getTableData().visibleData as WmxtHomeEntry[];
      await saveVisibleOrder(rows);
    },
  });
  sortable = await initializeSortable();
}

function onTargetChange() {
  onRefresh();
}

onUnmounted(() => {
  sortable?.destroy();
});
</script>

<template>
  <Page
    auto-content-height
    class="management-page"
    content-class="management-content"
  >
    <FormDrawer @success="onRefresh" />
    <header class="page-heading"><h1>首页入口配置</h1></header>
    <Tabs
      v-model:active-key="activeTarget"
      class="home-grid-tabs"
      @change="onTargetChange"
    >
      <TabPane
        v-for="item in homeTargetOptions"
        :key="item.value"
        :tab="item.label"
      />
    </Tabs>
    <Grid
      class="management-grid"
      :table-title="`${targetLabel(activeTarget)}首页入口（拖动排序）`"
    >
      <template #toolbar-tools>
        <Button
          v-access:code="'wmxt:home-entry:write'"
          type="primary"
          @click="openCreate"
        >
          <Plus class="size-4" />
          新增入口
        </Button>
      </template>
      <template #drag>
        <GripVertical
          class="home-entry-drag-handle size-4 cursor-grab text-muted-foreground active:cursor-grabbing"
        />
      </template>
      <template #title="{ row }">
        <Button
          v-access:code="'wmxt:home-entry:write'"
          class="min-w-0 px-0 text-left"
          size="small"
          type="link"
          @click="openEdit(row)"
        >
          {{ row.title || '-' }}
        </Button>
      </template>
      <template #icon="{ row }">
        <Image
          v-if="row.icon_url"
          :src="row.icon_url"
          :width="36"
          :height="36"
          class="rounded-md object-cover"
          :preview="false"
        />
        <span
          v-else
          class="inline-flex size-9 items-center justify-center rounded-md bg-muted text-muted-foreground"
          :title="row.icon_name"
        >
          <IconifyIcon
            :icon="builtinIconifyName(row.icon_name)"
            class="size-5"
          />
        </span>
      </template>
      <template #actions="{ row }">
        <Space>
          <Button
            v-access:code="'wmxt:home-entry:write'"
            size="small"
            type="link"
            @click="openEdit(row)"
          >
            编辑
          </Button>
          <Popconfirm title="确认删除该首页入口？" @confirm="onRemove(row)">
            <Button
              v-access:code="'wmxt:home-entry:write'"
              danger
              size="small"
              type="link"
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      </template>
    </Grid>
  </Page>
</template>
