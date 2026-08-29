<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { DeviceEvent, DeviceEventFilterOptions } from '#/api/msg';

import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { Eye } from '@vben/icons';

import { Button, Tag } from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { DeviceEventApi } from '#/api/msg';
import StatusTag from '#/components/status-tag';
import { displayValue } from '#/management';
import { Times } from '#/times';
import { vxeSortParams } from '#/vxe-sort';

import {
  eventKindColor,
  eventKindLabel,
  useColumns,
  useFormSchema,
} from './data';
import Detail from './modules/detail.vue';

const route = useRoute();
const filterOptions = ref<DeviceEventFilterOptions>({
  event_kinds: [],
  process_statuses: [],
});

const eventSortFields = [
  'device_code',
  'event_kind',
  'process_status',
  'received_at',
];

const [DetailDrawer, detailDrawerApi] = useVbenDrawer({
  connectedComponent: Detail,
  destroyOnClose: true,
});

const [Grid, gridApi] = useVbenVxeGrid<DeviceEvent>({
  formOptions: {
    schema: useFormSchema(filterOptions.value),
    submitOnChange: true,
  },
  gridOptions: {
    columns: useColumns(),
    height: 'auto',
    pagerConfig: { pageSize: 20, pageSizes: [10, 20, 50, 100] },
    proxyConfig: {
      ajax: {
        query: async (params, formValues) => {
          const { page } = params;
          const result = await DeviceEventApi.list({
            device_code:
              String(formValues.device_code ?? '').trim() || undefined,
            event_kind: String(formValues.event_kind ?? '').trim() || undefined,
            page: page.currentPage,
            received_between:
              String(formValues.received_between ?? '') || undefined,
            size: page.pageSize,
            ...vxeSortParams(params, eventSortFields),
            process_status:
              String(formValues.process_status ?? '') || undefined,
          });
          return { items: result.items, total: result.total };
        },
      },
    },
    rowConfig: { keyField: 'id' },
    sortConfig: { remote: true },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<DeviceEvent>,
});

async function loadFilterOptions() {
  const options = await DeviceEventApi.filterOptions();
  filterOptions.value = {
    event_kinds: options.event_kinds ?? [],
    process_statuses: options.process_statuses ?? [],
  };
  await gridApi.formApi.updateSchema(useFormSchema(filterOptions.value));
}

function firstQueryValue(value: unknown) {
  return Array.isArray(value) ? value[0] : value;
}

function queryString(key: string) {
  const value = firstQueryValue(route.query[key]);
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function hydrateFiltersFromRoute() {
  return gridApi.formApi.setValues({
    device_code: queryString('device_code'),
    event_kind: queryString('event_kind'),
    process_status: queryString('process_status'),
    received_between: queryString('received_between'),
  });
}

function openEvent(eventId: number) {
  detailDrawerApi.setData({ eventId }).open();
}

onMounted(async () => {
  await Promise.all([loadFilterOptions(), hydrateFiltersFromRoute()]);
  await gridApi.query();
});
</script>

<template>
  <Page
    auto-content-height
    class="management-page"
    content-class="management-content"
  >
    <DetailDrawer />
    <header class="page-heading">
      <div>
        <h1>事件管理</h1>
        <p>查看设备协议消息、处理错误和命令审计记录</p>
      </div>
    </header>

    <Grid class="management-grid" table-title="设备事件">
      <template #eventKind="{ row }">
        <Tag :color="eventKindColor(row.event_kind)">
          {{ eventKindLabel(row.event_kind) }}
        </Tag>
      </template>
      <template #processStatus="{ row }">
        <StatusTag :status="row.process_status" />
      </template>
      <template #deviceCode="{ row }">
        {{ displayValue(row.device_code) }}
      </template>
      <template #receivedAt="{ row }">
        {{ Times.formatUnix(row.received_at) }}
      </template>
      <template #errorMessage="{ row }">
        {{ displayValue(row.error_message) }}
      </template>
      <template #actions="{ row }">
        <Button size="small" type="link" @click="openEvent(row.id)">
          <template #icon><Eye /></template>详情
        </Button>
      </template>
    </Grid>
  </Page>
</template>

<style scoped>
.management-page {
  min-height: 0;
}

.management-page :deep(.management-content) {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.management-grid {
  flex: 1;
  min-height: 0;
}

.page-heading,
.filter-bar {
  flex: 0 0 auto;
}

.page-heading {
  margin-bottom: 16px;
}

.page-heading h1 {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
  letter-spacing: 0;
}

.page-heading p {
  margin: 4px 0 0;
  color: hsl(var(--muted-foreground));
}

.filter-bar {
  display: grid;
  grid-template-columns: 160px minmax(240px, 1fr) 160px auto;
  gap: 12px;
  padding: 12px;
  margin-bottom: 12px;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

@media (max-width: 760px) {
  .filter-bar {
    grid-template-columns: 1fr;
  }
}
</style>
