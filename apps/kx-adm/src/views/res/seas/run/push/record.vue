<script lang="ts" setup>
import type { VbenFormSchema } from '#/adapter/form';
import type {
  VxeTableGridColumns,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';

import { useRoute, useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';

import { Button, Tag } from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { getLogList } from '#/api/res/seas/run/push';

defineOptions({ name: 'PushRecord' });

const route = useRoute();
const router = useRouter();

const stateOptions = [
  { label: '待发送', value: 0 },
  { label: '已发送', value: 1 },
  { label: '发送失败', value: 2 },
];

const currentOptions = [
  { label: '历史', value: 0 },
  { label: '当前', value: 1 },
];

function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      component: 'InputNumber',
      defaultValue: route.query.id ? Number(route.query.id) : undefined,
      fieldName: 'app_push_id',
      label: '推送记录 ID',
    },
    { component: 'InputNumber', fieldName: 'uid', label: '用户 ID' },
    {
      component: 'Select',
      componentProps: { allowClear: true, options: stateOptions },
      fieldName: 'state',
      label: '状态',
    },
    {
      component: 'Select',
      componentProps: { allowClear: true, options: currentOptions },
      fieldName: 'current',
      label: '当前',
    },
  ];
}

function useColumns(): VxeTableGridColumns {
  return [
    { field: 'id', fixed: 'left', title: 'ID', width: 80 },
    { field: 'uid', title: '推送用户 ID', width: 120 },
    { field: 'app_push_uid', title: '创建推送用户', width: 130 },
    { field: 'app_push_id', title: '推送记录 ID', width: 120 },
    { field: 'title', minWidth: 180, title: '标题' },
    { field: 'click_times', title: '点击次数', width: 100 },
    { field: 'push_type', title: '推送类型', width: 100 },
    { field: 'state', slots: { default: 'state' }, title: '状态', width: 100 },
    {
      field: 'current',
      slots: { default: 'current' },
      title: '当前',
      width: 90,
    },
    {
      field: 'send_ret',
      minWidth: 260,
      slots: { default: 'sendRet' },
      title: '返回日志',
    },
    {
      field: 'first_click_time',
      slots: { default: 'firstClickTime' },
      title: '首次点击',
      width: 180,
    },
    {
      field: 'create_time',
      slots: { default: 'createTime' },
      title: '创建时间',
      width: 180,
    },
  ];
}

function clean(values: Record<string, any>) {
  return Object.fromEntries(
    Object.entries(values).filter(
      ([, value]) => value !== undefined && value !== null && value !== '',
    ),
  );
}

const [Grid] = useVbenVxeGrid({
  formOptions: { schema: useGridFormSchema(), submitOnChange: true },
  gridOptions: {
    columns: useColumns(),
    height: 'auto',
    pagerConfig: { pageSize: 20, pageSizes: [10, 20, 50, 100] },
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) =>
          getLogList(
            clean({
              ...formValues,
              page: page.currentPage,
              size: page.pageSize,
            }),
          ),
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

function jsonText(value: unknown) {
  if (value === undefined || value === null || value === '') return '-';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}
</script>

<template>
  <Page
    auto-content-height
    class="management-page"
    content-class="management-content"
    title="推送记录"
  >
    <Grid class="management-grid" table-title="推送记录">
      <template #toolbar-tools>
        <Button @click="router.back()">返回</Button>
      </template>
      <template #state="{ row }">
        <Tag
          :color="
            row.state === 1 ? 'green' : row.state === 2 ? 'red' : 'orange'
          "
        >
          {{
            row.state === 1 ? '已发送' : row.state === 2 ? '发送失败' : '待发送'
          }}
        </Tag>
      </template>
      <template #current="{ row }">
        <Tag :color="row.current === 1 ? 'green' : 'default'">
          {{ row.current === 1 ? '当前' : '历史' }}
        </Tag>
      </template>
      <template #sendRet="{ row }">{{ jsonText(row.send_ret) }}</template>
      <template #firstClickTime="{ row }">
        {{ formatTime(row.first_click_time) }}
      </template>
      <template #createTime="{ row }">
        {{ formatTime(row.create_time) }}
      </template>
    </Grid>
  </Page>
</template>
