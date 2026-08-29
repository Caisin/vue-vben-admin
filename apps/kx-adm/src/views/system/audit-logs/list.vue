<script lang="ts" setup>
import type { Dayjs } from 'dayjs';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { AuditLog } from '#/api/system/audit-log';

import { Page, useVbenDrawer } from '@vben/common-ui';

import { Button } from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { AuditLogApi } from '#/api/system/audit-log';
import { vxeSortParams } from '#/vxe-sort';

import { useColumns, useFormSchema } from './data';
import Detail from './modules/detail.vue';

const [DetailDrawer, detailDrawerApi] = useVbenDrawer({
  connectedComponent: Detail,
  destroyOnClose: true,
});

function openDetail(row: AuditLog) {
  detailDrawerApi.setData(row).open();
}

const sortFields = [
  'id',
  'uid',
  'api_path',
  'http_status',
  'duration_ms',
  'created_at',
];

const [Grid] = useVbenVxeGrid<AuditLog>({
  formOptions: { schema: useFormSchema(), submitOnChange: true },
  gridOptions: {
    columns: useColumns(),
    height: 'auto',
    pagerConfig: { pageSize: 20, pageSizes: [10, 20, 50, 100, 200] },
    proxyConfig: {
      ajax: {
        query: async (params, formValues) => {
          const { page } = params;
          const range = formValues.created_range as [Dayjs, Dayjs] | undefined;
          return AuditLogApi.list({
            api_path_prefix:
              String(formValues.api_path_prefix ?? '').trim() || undefined,
            created_range: range
              ? `${range[0].unix()},${range[1].unix()}`
              : undefined,
            http_status:
              formValues.http_status === undefined
                ? undefined
                : Number(formValues.http_status),
            method: String(formValues.method ?? '') || undefined,
            page: page.currentPage,
            size: page.pageSize,
            ...vxeSortParams(params, sortFields),
            uid:
              formValues.uid === undefined ? undefined : String(formValues.uid),
          });
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
  } as VxeTableGridOptions<AuditLog>,
});
</script>

<template>
  <Page
    auto-content-height
    class="management-page"
    content-class="management-content"
  >
    <Grid class="management-grid" table-title="操作审计">
      <template #apiPath="{ row }">
        <Button type="link" @click="openDetail(row)">
          {{ row.api_path }}
        </Button>
      </template>
    </Grid>
    <DetailDrawer />
  </Page>
</template>
