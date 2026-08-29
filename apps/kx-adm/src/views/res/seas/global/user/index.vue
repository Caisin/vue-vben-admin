<script lang="ts" setup>
import type { VbenFormSchema } from '#/adapter/form';
import type {
  VxeTableGridColumns,
  VxeTableGridOptions,
} from '#/adapter/vxe-table';
import type { RuntimeUser } from '#/api/res/seas/global/user';

import { ref } from 'vue';

import { Page } from '@vben/common-ui';

import { Button, Tag } from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { getList } from '#/api/res/seas/global/user';

import UserDetailModal from './Modal.vue';

const detailOpen = ref(false);
const selectedUser = ref<null | RuntimeUser>(null);

const platformOptions = [
  { label: 'iOS', value: 'ios' },
  { label: 'Android', value: 'android' },
  { label: 'Web', value: 'web' },
];

const enabledOptions: any[] = [
  { label: '正常', value: true },
  { label: '禁用', value: false },
];

function useGridFormSchema(): VbenFormSchema[] {
  return [
    { component: 'Input', fieldName: 'id', label: '用户 ID' },
    { component: 'Input', fieldName: 'name', label: '用户名称' },
    {
      component: 'Select',
      componentProps: { allowClear: true, options: platformOptions },
      fieldName: 'platform',
      label: '平台',
    },
    {
      component: 'Select',
      componentProps: { allowClear: true, options: enabledOptions },
      fieldName: 'enabled',
      label: '状态',
    },
    {
      component: 'Input',
      componentProps: { type: 'date' },
      fieldName: 'created_start_date',
      label: '注册开始',
    },
    {
      component: 'Input',
      componentProps: { type: 'date' },
      fieldName: 'created_end_date',
      label: '注册结束',
    },
  ];
}

function useColumns(): VxeTableGridColumns<RuntimeUser> {
  return [
    { field: 'id', fixed: 'left', title: 'ID', width: 90 },
    {
      field: 'name',
      minWidth: 180,
      slots: { default: 'name' },
      title: '用户名（点击查看详情）',
    },
    { field: 'platform', title: '平台', width: 100 },
    {
      field: 'is_guest',
      slots: { default: 'isGuest' },
      title: '游客',
      width: 90,
    },
    {
      field: 'enabled',
      slots: { default: 'enabled' },
      title: '状态',
      width: 90,
    },
    { field: 'reg_ip', title: '注册 IP', width: 140 },
    { field: 'os', title: '操作系统', width: 120 },
    { field: 'email', title: '邮箱', width: 180 },
    { field: 'tel', title: '手机号', width: 140 },
    {
      field: 'created_at',
      slots: { default: 'createdAt' },
      title: '创建时间',
      width: 180,
    },
    { field: 'remark', minWidth: 160, showOverflow: 'tooltip', title: '备注' },
  ];
}

function dayStart(day?: string) {
  return day
    ? Math.floor(new Date(`${day}T00:00:00`).getTime() / 1000)
    : undefined;
}

function dayEnd(day?: string) {
  return day
    ? Math.floor(new Date(`${day}T23:59:59`).getTime() / 1000)
    : undefined;
}

function cleanQuery(formValues: Record<string, any>) {
  return Object.fromEntries(
    Object.entries({
      created_end: dayEnd(formValues.created_end_date),
      created_start: dayStart(formValues.created_start_date),
      enabled: formValues.enabled,
      id: formValues.id,
      name: formValues.name?.trim(),
      platform: formValues.platform,
    }).filter(
      ([, value]) => value !== undefined && value !== '' && value !== null,
    ),
  );
}

const [Grid] = useVbenVxeGrid<RuntimeUser>({
  formOptions: { schema: useGridFormSchema(), submitOnChange: true },
  gridOptions: {
    columns: useColumns(),
    height: 'auto',
    pagerConfig: { pageSize: 20, pageSizes: [10, 20, 50, 100] },
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) =>
          getList({
            ...cleanQuery(formValues),
            page: page.currentPage,
            pageSize: page.pageSize,
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
  } as VxeTableGridOptions<RuntimeUser>,
});

function openDetail(record: RuntimeUser) {
  selectedUser.value = record;
  detailOpen.value = true;
}

function formatTime(value?: number | string) {
  if (!value) return '-';
  const numeric = Number(value);
  if (Number.isFinite(numeric))
    return new Date(numeric * 1000).toLocaleString();
  return String(value);
}
</script>

<template>
  <Page
    auto-content-height
    class="management-page"
    content-class="management-content"
    title="用户管理"
  >
    <Grid class="management-grid" table-title="用户管理">
      <template #name="{ row }">
        <Button type="link" @click="openDetail(row)">
          {{ row.name || row.user_name || row.id }}
        </Button>
      </template>
      <template #isGuest="{ row }">
        <Tag :color="row.is_guest || row.guest === 1 ? 'red' : 'green'">
          {{ row.is_guest || row.guest === 1 ? '是' : '否' }}
        </Tag>
      </template>
      <template #enabled="{ row }">
        <Tag :color="row.enabled === false ? 'red' : 'green'">
          {{ row.enabled === false ? '禁用' : '正常' }}
        </Tag>
      </template>
      <template #createdAt="{ row }">{{ formatTime(row.created_at) }}</template>
    </Grid>

    <UserDetailModal v-model:open="detailOpen" :user="selectedUser" />
  </Page>
</template>
