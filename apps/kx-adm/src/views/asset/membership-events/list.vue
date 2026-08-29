<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { MembershipEvent } from '#/api/asset/membership';

import { Page } from '@vben/common-ui';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { MembershipApi } from '#/api/asset/membership';
import { localPageResult, optionalString } from '#/views/_shared/crud-page';

import { useColumns, useGridFormSchema } from './data';

const [Grid] = useVbenVxeGrid<MembershipEvent>({
  formOptions: { schema: useGridFormSchema(), submitOnChange: true },
  gridOptions: {
    columns: useColumns(),
    height: 'auto',
    keepSource: true,
    pagerConfig: { pageSize: 20, pageSizes: [10, 20, 50, 100] },
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) => {
          const acctId = optionalString(formValues.acct_id);
          if (!acctId) return { items: [], total: 0 };
          return localPageResult(await MembershipApi.events(acctId), {
            page: page.currentPage,
            size: page.pageSize,
          });
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
  } as VxeTableGridOptions<MembershipEvent>,
});
</script>

<template>
  <Page
    auto-content-height
    class="management-page"
    content-class="management-content"
  >
    <Grid class="management-grid" table-title="会员事件" />
  </Page>
</template>
