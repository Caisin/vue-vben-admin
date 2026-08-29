<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { WmxtOrganizationView } from '#/api/wmxt';

import { onMounted, ref } from 'vue';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import { Button, Popconfirm, Space } from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { WmxtAdminApi } from '#/api/wmxt';

import { userLabel, userOptions } from '../utils';
import { useColumns, useFormSchema } from './data';
import OrganizationForm from './modules/form.vue';

const userOptionList = ref<ReturnType<typeof userOptions>>([]);
const userLabelMap = ref(new Map<string, string>());

const [FormDrawer, formDrawerApi] = useVbenDrawer({
  connectedComponent: OrganizationForm,
  destroyOnClose: true,
});

const [Grid, gridApi] = useVbenVxeGrid<WmxtOrganizationView>({
  formOptions: { schema: useFormSchema(), submitOnChange: true },
  gridOptions: {
    columns: useColumns(
      (uid) => userLabelMap.value.get(String(uid)) ?? String(uid || '-'),
    ),
    height: 'auto',
    pagerConfig: { pageSize: 20, pageSizes: [10, 20, 50, 100] },
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) =>
          WmxtAdminApi.organizations({
            ...(formValues as Record<string, boolean | number | string>),
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
  } as VxeTableGridOptions<WmxtOrganizationView>,
});

function onRefresh() {
  gridApi.query();
}

function openCreate() {
  formDrawerApi.setData({ userOptions: userOptionList.value }).open();
}

function openEdit(row: WmxtOrganizationView) {
  formDrawerApi.setData({ row, userOptions: userOptionList.value }).open();
}

async function loadUserOptions() {
  const users = await WmxtAdminApi.users({ page: 1, size: 100 });
  userOptionList.value = userOptions(users.items);
  userLabelMap.value = new Map(
    users.items.map((user) => [String(user.user_id), userLabel(user)]),
  );
  await gridApi.formApi.updateSchema([
    {
      componentProps: {
        allowClear: true,
        class: 'w-full',
        optionFilterProp: 'label',
        options: userOptionList.value,
        showSearch: true,
      },
      fieldName: 'admin_user_id',
    },
  ]);
}

onMounted(loadUserOptions);

async function onRemove(row: WmxtOrganizationView) {
  if (row.id === undefined) return;
  await WmxtAdminApi.remove_organization(row.id);
  onRefresh();
}
</script>

<template>
  <Page
    auto-content-height
    class="management-page"
    content-class="management-content"
  >
    <FormDrawer @success="onRefresh" />
    <Grid class="management-grid" table-title="单位管理">
      <template #toolbar-tools>
        <Button
          v-access:code="'wmxt:organization:write'"
          type="primary"
          @click="openCreate"
        >
          <Plus class="size-5" />新建单位
        </Button>
      </template>
      <template #actions="{ row }">
        <Space size="small">
          <Button
            v-access:code="'wmxt:organization:write'"
            size="small"
            type="link"
            @click.stop="openEdit(row)"
          >
            编辑
          </Button>
          <Popconfirm title="确定删除该记录？" @confirm="onRemove(row)">
            <Button
              v-access:code="'wmxt:organization:write'"
              danger
              size="small"
              type="link"
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      </template>
    </Grid>
  </Page>
</template>
