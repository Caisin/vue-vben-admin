<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { EnabledStatus, WmxtAdminUser, WmxtRole } from '#/api/wmxt';

import { onMounted, ref } from 'vue';

import { Page, useVbenDrawer } from '@vben/common-ui';

import { Button } from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { WmxtAdminApi } from '#/api/wmxt';

import { familyOptions, organizationOptions } from '../utils';
import { useColumns, useFormSchema } from './data';
import RoleForm from './modules/role-form.vue';

const orgOptionList = ref<ReturnType<typeof organizationOptions>>([]);
const familyOptionList = ref<ReturnType<typeof familyOptions>>([]);

const [RoleDrawer, roleDrawerApi] = useVbenDrawer({
  connectedComponent: RoleForm,
  destroyOnClose: true,
});
const [Grid, gridApi] = useVbenVxeGrid<WmxtAdminUser>({
  formOptions: { schema: useFormSchema(), submitOnChange: true },
  gridOptions: {
    columns: useColumns(onStatusChange),
    height: 'auto',
    pagerConfig: { pageSize: 20, pageSizes: [10, 20, 50, 100] },
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) => {
          const { role, ...filters } = formValues as Record<
            string,
            boolean | number | string
          >;
          const params = {
            ...filters,
            page: page.currentPage,
            size: page.pageSize,
          };
          return role
            ? WmxtAdminApi.users_by_role(role as WmxtRole, params)
            : WmxtAdminApi.users(params);
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
  } as VxeTableGridOptions<WmxtAdminUser>,
});

function onRefresh() {
  gridApi.query();
}

function openRole(row: WmxtAdminUser) {
  roleDrawerApi.setData(row).open();
}

async function loadRelationOptions() {
  const [organizations, families] = await Promise.all([
    WmxtAdminApi.organizations({ page: 1, size: 100 }),
    WmxtAdminApi.families({ page: 1, size: 100 }),
  ]);
  orgOptionList.value = organizationOptions(organizations.items);
  familyOptionList.value = familyOptions(families.items);
  await gridApi.formApi.updateSchema([
    {
      componentProps: {
        allowClear: true,
        class: 'w-full',
        optionFilterProp: 'label',
        options: orgOptionList.value,
        showSearch: true,
      },
      fieldName: 'org_id',
    },
    {
      componentProps: {
        allowClear: true,
        class: 'w-full',
        optionFilterProp: 'label',
        options: familyOptionList.value,
        showSearch: true,
      },
      fieldName: 'family_id',
    },
  ]);
}

onMounted(loadRelationOptions);

async function onStatusChange(status: EnabledStatus, row: WmxtAdminUser) {
  await WmxtAdminApi.update_user_status(row.user_id, status);
  onRefresh();
  return true;
}
</script>

<template>
  <Page
    auto-content-height
    class="management-page"
    content-class="management-content"
  >
    <RoleDrawer @success="onRefresh" />
    <Grid class="management-grid" table-title="用户与小程序权限">
      <template #actions="{ row }">
        <Button
          v-access:code="'wmxt:user:manage'"
          size="small"
          type="link"
          @click.stop="openRole(row)"
        >
          角色
        </Button>
      </template>
    </Grid>
  </Page>
</template>
