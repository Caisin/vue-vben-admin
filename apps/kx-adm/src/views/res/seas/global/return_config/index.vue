<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';

import { ref } from 'vue';

import { Page } from '@vben/common-ui';

import { Badge, Button, message } from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { getPageList, savePage } from '#/api/res/seas/global/return_config';

import { useColumns, useGridFormSchema } from './data';
import Modal from './Modal.vue';

const editorOpen = ref(false);
const activeRecord = ref<Record<string, any>>({});

function normalizeRows(payload: any) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.records)) return payload.records;
  return payload ? [payload] : [];
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
          const payload = await getPageList({
            dimension: formValues.dimension || 'link',
            is_def: formValues.is_def,
            name: formValues.name?.trim() || undefined,
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

function centsToDollars(value: unknown) {
  return Math.round(Number(value || 0)) / 100;
}

function parseMoneyMap(value: any): Record<string, any> {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }
  return typeof value === 'object' ? value : {};
}

function moneyRows(value: any) {
  return Object.entries(parseMoneyMap(value)).map(([amount, cfg]) => ({
    amount: centsToDollars(amount),
    back_amount: centsToDollars((cfg as any)?.back_amount),
    back_percent: Number((cfg as any)?.back_percent ?? 0),
  }));
}

function openEditor(record?: Record<string, any>) {
  activeRecord.value = record ?? { dimension: 'link', is_def: 0 };
  editorOpen.value = true;
}

async function save(payload: any) {
  await savePage(payload);
  message.success('保存成功');
  editorOpen.value = false;
  await gridApi.query();
}
</script>

<template>
  <Page
    auto-content-height
    class="management-page"
    content-class="management-content"
    title="回传模板"
  >
    <Grid class="management-grid" table-title="回传模板">
      <template #toolbar-tools>
        <Button type="primary" @click="openEditor()">新增</Button>
      </template>
      <template #percent="{ row }">{{ row.percent }}%</template>
      <template #moneyMap="{ row }">
        <div
          v-for="(item, index) in moneyRows(row.money_map)"
          :key="index"
          class="mb-1"
        >
          <span class="font-bold">充值 {{ item.amount }} 美元 =&gt; </span>
          <span class="text-red-500">回传 {{ item.back_amount }} 美元 =&gt;
          </span>
          <span class="text-blue-500">回传比例 {{ item.back_percent }}%</span>
        </div>
        <span v-if="moneyRows(row.money_map).length === 0">-</span>
      </template>
      <template #isDef="{ row }">
        <Badge
          :status="row.is_def === 1 ? 'success' : 'default'"
          :text="row.is_def === 1 ? '是' : '否'"
        />
      </template>
      <template #operation="{ row }">
        <Button size="small" type="link" @click="openEditor(row)">编辑</Button>
      </template>
    </Grid>

    <Modal v-model:open="editorOpen" :record="activeRecord" @submit="save" />
  </Page>
</template>
