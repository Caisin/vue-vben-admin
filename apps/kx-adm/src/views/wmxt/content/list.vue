<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type {
  EnabledStatus,
  WmxtContentPage,
  WmxtModule,
  WmxtModuleItem,
} from '#/api/wmxt';

import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { useSortable } from '@vben/hooks';
import {
  CircleX,
  GripVertical,
  MailCheck,
  Plus,
  UserRoundPen,
  X,
} from '@vben/icons';

import {
  Button,
  Empty,
  message,
  Popconfirm,
  Select,
  Space,
  Tooltip,
} from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { WmxtAdminApi } from '#/api/wmxt';

import { useItemManageColumns, useModuleManageColumns } from './data';
import ContentPageForm from './modules/content-page-form.vue';
import ModuleForm from './modules/module-form.vue';
import ModuleItemForm from './modules/module-item-form.vue';

const contentPages = ref<WmxtContentPage[]>([]);
const activePageCode = ref('personal_home');
const pageOptions = computed(() =>
  contentPages.value.map((page) => ({ label: page.name, value: page.code })),
);
const activePage = computed(() =>
  contentPages.value.find((page) => page.code === activePageCode.value),
);
const modules = ref<WmxtModule[]>([]);
const selectedModule = ref<WmxtModule>();
const selectedModuleId = ref<number | string>();
let moduleSortable: null | { destroy: () => void } = null;
let itemSortable: null | { destroy: () => void } = null;

const selectedModuleTitle = computed(() =>
  selectedModule.value
    ? `${selectedModule.value.module_name} · 内容`
    : '模块内容',
);
const moduleOptions = computed(() =>
  modules.value.map((item) => ({
    label: item.module_name,
    value: item.id,
  })),
);
const nextModuleOrder = computed(() => {
  let maximum = -1;
  for (const item of modules.value) {
    maximum = Math.max(maximum, item.sort_order);
  }
  return maximum + 1;
});

const [ModuleDrawer, moduleDrawerApi] = useVbenDrawer({
  connectedComponent: ModuleForm,
  destroyOnClose: true,
});
const [ContentPageDrawer, contentPageDrawerApi] = useVbenDrawer({
  connectedComponent: ContentPageForm,
  destroyOnClose: true,
});
const [ModuleItemDrawer, moduleItemDrawerApi] = useVbenDrawer({
  connectedComponent: ModuleItemForm,
  destroyOnClose: true,
});

const moduleGridEvents = {
  cellClick({ row }: { row: WmxtModule }) {
    void selectModule(row);
  },
};

const [ModuleGrid, moduleGridApi] = useVbenVxeGrid<WmxtModule>({
  gridEvents: moduleGridEvents,
  gridOptions: {
    columns: useModuleManageColumns(onModuleStatusChange),
    height: 'auto',
    pagerConfig: { enabled: false },
    proxyConfig: {
      ajax: {
        query: async () => {
          const result = await WmxtAdminApi.modules({
            page: 1,
            page_code: activePageCode.value,
            size: 100,
          });
          modules.value = result.items;
          const current = result.items.find(
            (item) => item.id === selectedModule.value?.id,
          );
          selectedModule.value = current ?? result.items[0];
          selectedModuleId.value = selectedModule.value?.id;
          void nextTick(async () => {
            await initModuleSortable();
            refreshItems();
          });
          return result.items;
        },
      },
    },
    rowConfig: { isCurrent: true, keyField: 'id' },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      search: false,
      zoom: true,
    },
  } as VxeTableGridOptions<WmxtModule>,
});

const [ItemGrid, itemGridApi] = useVbenVxeGrid<WmxtModuleItem>({
  gridOptions: {
    columns: useItemManageColumns(),
    height: 'auto',
    pagerConfig: { enabled: false },
    proxyConfig: {
      ajax: {
        query: async () => {
          if (!selectedModule.value?.id) {
            itemSortable?.destroy();
            itemSortable = null;
            return [];
          }
          const result = await WmxtAdminApi.module_items({
            module_id: selectedModule.value.id,
            page: 1,
            size: 100,
          });
          void nextTick(initItemSortable);
          return result.items;
        },
      },
    },
    rowConfig: { keyField: 'id' },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      search: false,
      zoom: true,
    },
  } as VxeTableGridOptions<WmxtModuleItem>,
});

function refreshModules() {
  void moduleGridApi.query();
}

function refreshItems() {
  void itemGridApi.query();
}

async function selectModule(row: WmxtModule) {
  selectedModule.value = row;
  selectedModuleId.value = row.id;
  await nextTick();
  refreshItems();
}

async function selectModuleById(id?: number | string) {
  const row = modules.value.find((item) => item.id === id);
  if (row) await selectModule(row);
}

function changePageCode() {
  selectedModule.value = undefined;
  selectedModuleId.value = undefined;
  refreshModules();
}

async function loadContentPages(preferredCode?: string) {
  const result = await WmxtAdminApi.content_pages({ page: 1, size: 100 });
  contentPages.value = result.items;
  const nextCode = preferredCode ?? activePageCode.value;
  activePageCode.value = result.items.some((page) => page.code === nextCode)
    ? nextCode
    : (result.items[0]?.code ?? '');
  changePageCode();
}

function openContentPage(page?: WmxtContentPage) {
  contentPageDrawerApi.setData(page).open();
}

async function removeContentPage() {
  if (!activePage.value) return;
  await WmxtAdminApi.remove_content_page(activePage.value.id);
  message.success('内容页面已删除');
  await loadContentPages();
}

async function onContentPageSaved(page: WmxtContentPage) {
  await loadContentPages(page.code);
}

function openModule(row?: WmxtModule) {
  moduleDrawerApi
    .setData({
      page_code: activePageCode.value,
      pageOptions: pageOptions.value,
      row,
      sort_order: nextModuleOrder.value,
    })
    .open();
}

function openItem(row?: WmxtModuleItem) {
  const rows = itemGridApi.grid.getTableData().visibleData as WmxtModuleItem[];
  let maximumSort = -1;
  for (const item of rows) {
    maximumSort = Math.max(maximumSort, item.sort_order);
  }
  const nextSort = maximumSort + 1;
  moduleItemDrawerApi
    .setData({
      module: selectedModule.value,
      modules: modules.value,
      row,
      sort_order: nextSort,
    })
    .open();
}

async function removeModule(row: WmxtModule) {
  await WmxtAdminApi.remove_module(row.id);
  if (selectedModule.value?.id === row.id) {
    selectedModule.value = undefined;
    selectedModuleId.value = undefined;
  }
  message.success('内容模块已删除');
  refreshModules();
}

async function removeItem(row: WmxtModuleItem) {
  await WmxtAdminApi.remove_module_item(row.id);
  message.success('模块内容已删除');
  refreshItems();
}

async function publishItem(row: WmxtModuleItem) {
  const status = row.status === 'published' ? 'archived' : 'published';
  await WmxtAdminApi.update_module_item_status(row.id, status);
  message.success(status === 'published' ? '内容已发布' : '内容已归档');
  refreshItems();
}

async function onModuleStatusChange(status: EnabledStatus, row: WmxtModule) {
  await WmxtAdminApi.update_module(row.id, {
    id: row.id,
    module_code: row.module_code,
    module_name: row.module_name,
    page_code: row.page_code,
    sort_order: row.sort_order,
    status,
    vote_enabled: row.vote_enabled,
  });
  refreshModules();
  return true;
}

async function saveModuleOrder(rows: WmxtModule[]) {
  try {
    await WmxtAdminApi.order_modules({
      items: rows.map((row, index) => ({ id: row.id, sort_order: index })),
      page_code: activePageCode.value,
    });
    message.success('模块顺序已保存');
  } catch {
    message.error('模块排序未保存');
  } finally {
    refreshModules();
  }
}

async function saveItemOrder(rows: WmxtModuleItem[]) {
  if (!selectedModule.value?.id) return;
  try {
    await WmxtAdminApi.order_module_items({
      items: rows.map((row, index) => ({ id: row.id, sort_order: index })),
      module_id: selectedModule.value.id,
    });
    message.success('内容顺序已保存');
  } catch {
    message.error('内容排序未保存');
  } finally {
    refreshItems();
  }
}

async function initModuleSortable() {
  await nextTick();
  moduleSortable?.destroy();
  moduleSortable = null;
  const body = moduleGridApi.grid.$el?.querySelector(
    '.vxe-table--body tbody',
  ) as HTMLElement | null;
  if (!body) return;
  const { initializeSortable } = useSortable(body, {
    handle: '.module-drag-handle',
    async onEnd(event) {
      if (
        event.oldIndex === undefined ||
        event.newIndex === undefined ||
        event.oldIndex === event.newIndex
      ) {
        return;
      }
      const rows = moduleGridApi.grid.getTableData()
        .visibleData as WmxtModule[];
      await saveModuleOrder(rows);
    },
  });
  moduleSortable = await initializeSortable();
}

async function initItemSortable() {
  await nextTick();
  itemSortable?.destroy();
  itemSortable = null;
  const body = itemGridApi.grid.$el?.querySelector(
    '.vxe-table--body tbody',
  ) as HTMLElement | null;
  if (!body) return;
  const { initializeSortable } = useSortable(body, {
    handle: '.item-drag-handle',
    async onEnd(event) {
      if (
        event.oldIndex === undefined ||
        event.newIndex === undefined ||
        event.oldIndex === event.newIndex
      ) {
        return;
      }
      const rows = itemGridApi.grid.getTableData()
        .visibleData as WmxtModuleItem[];
      await saveItemOrder(rows);
    },
  });
  itemSortable = await initializeSortable();
}

onUnmounted(() => {
  moduleSortable?.destroy();
  itemSortable?.destroy();
});

onMounted(() => loadContentPages());
</script>

<template>
  <Page
    auto-content-height
    class="management-page"
    content-class="management-content"
  >
    <ModuleDrawer @success="refreshModules" />
    <ModuleItemDrawer @success="refreshItems" />
    <ContentPageDrawer @success="onContentPageSaved" />
    <header class="page-heading"><h1>内容编排</h1></header>

    <div class="content-workspace">
      <section class="workspace-pane module-pane">
        <ModuleGrid class="management-grid" table-title="页面模块">
          <template #toolbar-tools>
            <Space size="small">
              <Select
                v-model:value="activePageCode"
                class="w-36"
                :options="pageOptions"
                @change="changePageCode"
              />
              <Tooltip title="新增内容页面">
                <Button
                  v-access:code="'wmxt:module:write'"
                  aria-label="新增内容页面"
                  shape="circle"
                  @click="openContentPage()"
                >
                  <Plus class="size-4" />
                </Button>
              </Tooltip>
              <Tooltip title="编辑当前页面">
                <Button
                  v-access:code="'wmxt:module:write'"
                  aria-label="编辑当前页面"
                  :disabled="!activePage"
                  shape="circle"
                  @click="openContentPage(activePage)"
                >
                  <UserRoundPen class="size-4" />
                </Button>
              </Tooltip>
              <Popconfirm
                title="页面没有模块时才可删除，确定继续？"
                @confirm="removeContentPage"
              >
                <Tooltip title="删除当前页面">
                  <Button
                    v-access:code="'wmxt:module:write'"
                    aria-label="删除当前页面"
                    danger
                    :disabled="!activePage"
                    shape="circle"
                  >
                    <X class="size-4" />
                  </Button>
                </Tooltip>
              </Popconfirm>
              <Button
                v-access:code="'wmxt:module:write'"
                type="primary"
                @click="openModule()"
              >
                <Plus class="size-4" />
                新建模块
              </Button>
            </Space>
          </template>
          <template #drag>
            <GripVertical
              class="module-drag-handle size-4 cursor-grab text-muted-foreground active:cursor-grabbing"
            />
          </template>
          <template #module_name="{ row }">
            <Button
              v-access:code="'wmxt:module:write'"
              class="min-w-0 px-0 text-left font-medium"
              size="small"
              type="link"
              @click.stop="openModule(row)"
            >
              {{ row.module_name || '-' }}
            </Button>
          </template>
          <template #actions="{ row }">
            <Popconfirm title="确定删除该模块？" @confirm="removeModule(row)">
              <Tooltip title="删除模块">
                <Button
                  v-access:code="'wmxt:module:write'"
                  aria-label="删除模块"
                  danger
                  shape="circle"
                  size="small"
                  type="text"
                  @click.stop
                >
                  <X class="size-4" />
                </Button>
              </Tooltip>
            </Popconfirm>
          </template>
        </ModuleGrid>
      </section>

      <section class="workspace-pane item-pane">
        <Empty
          v-if="!selectedModule"
          class="workspace-empty"
          description="选择左侧模块后管理内容"
        />
        <ItemGrid
          v-else
          class="management-grid"
          :table-title="selectedModuleTitle"
        >
          <template #toolbar-tools>
            <Space size="small">
              <Select
                v-model:value="selectedModuleId"
                class="w-44"
                :options="moduleOptions"
                @change="selectModuleById"
              />
              <Button
                v-access:code="'wmxt:module:write'"
                type="primary"
                @click="openItem()"
              >
                <Plus class="size-4" />
                新建内容
              </Button>
            </Space>
          </template>
          <template #drag>
            <GripVertical
              class="item-drag-handle size-4 cursor-grab text-muted-foreground active:cursor-grabbing"
            />
          </template>
          <template #title="{ row }">
            <Button
              v-access:code="'wmxt:module:write'"
              class="min-w-0 px-0 text-left font-medium"
              size="small"
              type="link"
              @click.stop="openItem(row)"
            >
              {{ row.title || '-' }}
            </Button>
          </template>
          <template #actions="{ row }">
            <Space :size="2">
              <Tooltip
                :title="row.status === 'published' ? '归档内容' : '发布内容'"
              >
                <Button
                  v-access:code="'wmxt:module:write'"
                  :aria-label="
                    row.status === 'published' ? '归档内容' : '发布内容'
                  "
                  shape="circle"
                  size="small"
                  type="text"
                  @click.stop="publishItem(row)"
                >
                  <CircleX v-if="row.status === 'published'" class="size-4" />
                  <MailCheck v-else class="size-4" />
                </Button>
              </Tooltip>
              <Popconfirm title="确定删除该内容？" @confirm="removeItem(row)">
                <Tooltip title="删除内容">
                  <Button
                    v-access:code="'wmxt:module:write'"
                    aria-label="删除内容"
                    danger
                    shape="circle"
                    size="small"
                    type="text"
                    @click.stop
                  >
                    <X class="size-4" />
                  </Button>
                </Tooltip>
              </Popconfirm>
            </Space>
          </template>
        </ItemGrid>
      </section>
    </div>
  </Page>
</template>

<style scoped>
.content-workspace {
  display: grid;
  flex: 1 1 auto;
  grid-template-columns: minmax(480px, 0.9fr) minmax(580px, 1.1fr);
  gap: 12px;
  height: auto;
  min-height: 0;
}

.workspace-pane {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

.workspace-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 320px;
}

@media (width < 1280px) {
  .content-workspace {
    grid-template-columns: minmax(0, 1fr);
    height: auto;
  }

  .workspace-pane {
    min-height: 420px;
  }
}
</style>
