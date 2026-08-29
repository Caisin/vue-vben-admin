<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';

import { ref } from 'vue';

import { Page } from '@vben/common-ui';

import { Badge, Button, message, Modal } from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  getList,
  getSignList,
  postSave,
  postSign,
} from '#/api/res/seas/set/task';

import { useColumns, useGridFormSchema } from './data';
import TaskModal from './Modal.vue';
import SignModal from './SignModal.vue';

const taskOpen = ref(false);
const signOpen = ref(false);
const activeRecord = ref<any>({});
const signRecord = ref<any>({});

function normalizeRows(payload: any) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.records)) return payload.records;
  if (payload && typeof payload === 'object') return [payload];
  return [];
}

function normalizeTotal(payload: any, list: any[]) {
  return Number(payload?.total ?? payload?.count ?? list.length);
}

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
        query: async ({ page }, formValues) => {
          const payload = await getList({
            ...formValues,
            page: page.currentPage,
            size: page.pageSize,
          });
          const items = normalizeRows(payload);
          return { items, total: normalizeTotal(payload, items) };
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
  } as VxeTableGridOptions,
});

function addTask() {
  activeRecord.value = {};
  taskOpen.value = true;
}
function editTask(record: any) {
  activeRecord.value = record;
  taskOpen.value = true;
}
async function saveTask(payload: any) {
  await postSave(payload);
  message.success('保存成功');
  taskOpen.value = false;
  await gridApi.query();
}
async function openSign() {
  signRecord.value = await getSignList();
  signOpen.value = true;
}
async function saveSign(payload: any) {
  await postSign(payload);
  message.success('签到配置已保存');
  signOpen.value = false;
}
function taskType(value: any) {
  return Number(value) === 1 ? '新手任务' : '日常任务';
}
function langText(lang: any) {
  if (!lang || typeof lang !== 'object') return '';
  return ['zh', 'zh_hk', 'en', 'ja', 'ko', 'vi']
    .map((key) => `${key}:${lang[key] ?? ''}`)
    .join(' / ');
}
</script>

<template>
  <Page
    auto-content-height
    class="management-page"
    content-class="management-content"
    title="任务配置"
  >
    <Grid class="management-grid" table-title="任务配置">
      <template #toolbar-tools>
        <Button @click="openSign">签到任务配置</Button>
        <Button type="primary" @click="addTask">新增任务配置</Button>
      </template>
      <template #taskType="{ row }">
        {{ taskType(row.cfg?.task_type) }}
      </template>
      <template #state="{ row }">
        <Badge
          :status="row.cfg?.state === 1 ? 'success' : 'error'"
          :text="row.cfg?.state === 1 ? '正常' : '停用'"
        />
      </template>
      <template #lang="{ row }">{{ langText(row.cfg?.lang) }}</template>
      <template #operation="{ row }">
        <Button size="small" type="link" @click="editTask(row)">编辑</Button>
      </template>
    </Grid>
    <TaskModal
      v-model:open="taskOpen"
      :record="activeRecord"
      @submit="saveTask"
    />
    <SignModal
      v-model:open="signOpen"
      :record="signRecord"
      @submit="saveSign"
    />
    <Modal class="hidden" />
  </Page>
</template>
