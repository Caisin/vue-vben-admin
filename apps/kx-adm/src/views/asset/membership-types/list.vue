<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type {
  MembershipType,
  MembershipTypePageQuery,
} from '#/api/asset/membership';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button } from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { MembershipApi } from '#/api/asset/membership';
import { vxeSortParams } from '#/vxe-sort';

import { useColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';

const membershipTypeSortFields = ['id', 'code', 'created_at'];

const [FormDrawer, formDrawerApi] = useVbenDrawer({
  connectedComponent: Form,
  destroyOnClose: true,
});

const [Grid, gridApi] = useVbenVxeGrid<MembershipType>({
  formOptions: { schema: useGridFormSchema(), submitOnChange: true },
  gridOptions: {
    columns: useColumns(onEnabledChange),
    height: 'auto',
    keepSource: true,
    pagerConfig: { pageSize: 20, pageSizes: [10, 20, 50, 100] },
    proxyConfig: {
      ajax: {
        query: async (params, formValues) => {
          const { page } = params;
          return MembershipApi.typeList({
            ...(formValues as MembershipTypePageQuery),
            ...vxeSortParams(params, membershipTypeSortFields),
            page: page.currentPage,
            size: page.pageSize,
          });
        },
      },
    },
    sortConfig: { remote: true },
    rowConfig: { keyField: 'id' },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<MembershipType>,
});

function onRefresh() {
  gridApi.query();
}
function onCreate() {
  formDrawerApi.setData({}).open();
}
function onEdit(row: MembershipType) {
  formDrawerApi.setData(row).open();
}
async function onEnabledChange(enabled: boolean, row: MembershipType) {
  await MembershipApi.updateType(row.id, {
    code: row.code,
    enabled,
    intro: row.intro,
    name: row.name,
  });
  return true;
}
</script>

<template>
  <Page
    auto-content-height
    class="management-page"
    content-class="management-content"
  >
    <FormDrawer @success="onRefresh" />
    <Grid class="management-grid" table-title="会员类型">
      <template #toolbar-tools>
        <Button type="primary" @click="onCreate">
          <Plus class="size-5" />新建会员类型
        </Button>
      </template>
      <template #nameCell="{ row }">
        <Button
          class="min-w-0 truncate px-0 text-left"
          size="small"
          type="link"
          @click.stop="onEdit(row)"
        >
          {{ row.name || '-' }}
        </Button>
      </template>
    </Grid>
  </Page>
</template>
