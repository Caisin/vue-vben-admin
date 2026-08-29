<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';

import { ref } from 'vue';

import { Page } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, message, Space, Tag } from 'antdv-next';

import { useVbenVxeGrid, VbenTableAction } from '#/adapter/vxe-table';
import { defHttp } from '#/api/res/legacy-http';
import {
  getCateSourceList,
  getList,
  postDelete,
  refreshAllCateList,
  refreshSourceCateList,
} from '#/api/res/seas/set/category';

import { useColumns, useGridFormSchema } from './data';
import LanguageModal from './LanguageModal.vue';
import CategoryModal from './Modal.vue';
import SourceSelectModal from './SourceSelectModal.vue';

defineOptions({ name: 'CategoryManage' });

const editOpen = ref(false);
const langOpen = ref(false);
const sourceOpen = ref(false);
const activeRecord = ref<null | Record<string, any>>(null);
const selectedSourceIds = ref<Array<number | string>>([]);

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    schema: useGridFormSchema(),
    submitOnChange: true,
  },
  gridOptions: {
    columns: useColumns(),
    height: 'auto',
    pagerConfig: { pageSize: 20, pageSizes: [10, 20, 50, 100] },
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) =>
          getList({
            ...formValues,
            name: formValues.name?.trim() || undefined,
            page: page.currentPage,
            size: page.pageSize,
          }),
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
  } as VxeTableGridOptions,
});

function formatTime(value?: number | string) {
  if (!value) return '-';
  const numeric = Number(value);
  if (Number.isFinite(numeric))
    return new Date(numeric * 1000).toLocaleString();
  return String(value);
}

function openCreate() {
  activeRecord.value = null;
  editOpen.value = true;
}

function openEdit(record: Record<string, any>) {
  activeRecord.value = record;
  editOpen.value = true;
}

function openLanguage(record: Record<string, any>) {
  activeRecord.value = record;
  langOpen.value = true;
}

async function openSources(record: Record<string, any>) {
  activeRecord.value = record;
  const payload = await getCateSourceList(record.id);
  selectedSourceIds.value = Array.isArray(payload)
    ? payload.map((item: any) => item.res_id ?? item.id ?? item)
    : [];
  sourceOpen.value = true;
}

async function saveSources(ids: Array<number | string>) {
  if (!activeRecord.value) return;
  await defHttp.post({
    data: { res_ids: ids.map(Number) },
    url: `/adm/category/set_res/${activeRecord.value.id}`,
  });
  message.success('分类资源已保存');
  await gridApi.query();
}

async function remove(record: Record<string, any>) {
  await postDelete(record.id);
  message.success('分类已删除');
  await gridApi.query();
}

async function refreshCategorySources(record: Record<string, any>) {
  const payload = await getCateSourceList(record.id);
  const ids = Array.isArray(payload)
    ? payload.map((item: any) => item.res_id ?? item.id ?? item)
    : [];
  for (const id of ids) {
    await refreshSourceCateList(id);
  }
  message.success(ids.length > 0 ? '关联资源标签已刷新' : '该分类暂无关联资源');
}

async function refreshAll() {
  await refreshAllCateList();
  message.success('所有资源标签已刷新');
}
</script>

<template>
  <Page
    auto-content-height
    class="management-page"
    content-class="management-content"
    title="分类管理"
  >
    <Grid class="management-grid" table-title="分类管理">
      <template #toolbar-tools>
        <Space>
          <Button @click="refreshAll">刷新全部标签</Button>
          <Button type="primary" @click="openCreate">
            <Plus class="size-5" />
            新增分类
          </Button>
        </Space>
      </template>
      <template #state="{ row }">
        <Tag :color="row.state === 1 ? 'success' : 'error'">
          {{ row.state === 1 ? '正常' : '禁用' }}
        </Tag>
      </template>
      <template #time="{ row, column }">
        {{ formatTime(row[column.field]) }}
      </template>
      <template #operation="{ row }">
        <VbenTableAction
          :actions="[
            {
              icon: 'lucide:edit',
              onClick: () => openEdit(row),
              text: '编辑',
            },
            {
              icon: 'lucide:list-plus',
              onClick: () => openSources(row),
              text: '选择资源',
            },
          ]"
          :dropdown-actions="[
            {
              icon: 'lucide:languages',
              onClick: () => openLanguage(row),
              text: '多语言',
            },
            {
              icon: 'lucide:refresh-cw',
              onClick: () => refreshCategorySources(row),
              text: '刷新关联标签',
            },
            {
              danger: true,
              icon: 'lucide:trash-2',
              popConfirm: {
                confirm: () => remove(row),
                title: '是否确认删除？',
              },
              text: '删除',
            },
          ]"
          align="center"
        />
      </template>
    </Grid>

    <CategoryModal
      v-model:open="editOpen"
      :record="activeRecord"
      @saved="gridApi.query"
    />
    <LanguageModal
      v-model:open="langOpen"
      :record="activeRecord"
      @saved="gridApi.query"
    />
    <SourceSelectModal
      v-model:open="sourceOpen"
      :selected-ids="selectedSourceIds"
      @save="saveSources"
    />
  </Page>
</template>
