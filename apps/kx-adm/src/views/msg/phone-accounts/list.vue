<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type {
  PhoneAccount,
  PhoneAccountFilterOptions,
  PhoneAccountStatus,
  PhoneAccountType,
} from '#/api/msg';

import { onMounted, ref } from 'vue';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { Plus, X } from '@vben/icons';

import { Button, Popconfirm, Tag } from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { PhoneAccountApi } from '#/api/msg';
import { DicLabel } from '#/components/dictionary';
import { displayValue } from '#/management';
import { Times } from '#/times';
import { vxeSortParams } from '#/vxe-sort';

import { useColumns, useFormSchema } from './data';
import Form from './modules/form.vue';

const filterOptions = ref<PhoneAccountFilterOptions>({
  platforms: [],
  purposes: [],
  statuses: [],
  types: [],
});
const accountSortFields = [
  'account_type',
  'phone_number',
  'platform',
  'status',
  'updated_at',
];

const [FormDrawer, formDrawerApi] = useVbenDrawer({
  connectedComponent: Form,
  destroyOnClose: true,
});

const [Grid, gridApi] = useVbenVxeGrid<PhoneAccount>({
  formOptions: {
    schema: useFormSchema(filterOptions.value),
    submitOnChange: true,
  },
  gridOptions: {
    columns: useColumns(onStatusChange),
    height: 'auto',
    pagerConfig: { pageSize: 20, pageSizes: [10, 20, 50, 100] },
    proxyConfig: {
      ajax: {
        query: async (params, formValues) => {
          const { page } = params;
          const result = await PhoneAccountApi.list({
            account_type: formValues.account_type as
              | PhoneAccountType
              | undefined,
            page: page.currentPage,
            phone_number: String(formValues.phone_number ?? '') || undefined,
            platform: String(formValues.platform ?? '').trim() || undefined,
            size: page.pageSize,
            ...vxeSortParams(params, accountSortFields),
            status: formValues.status as PhoneAccountStatus | undefined,
          });
          return { items: result.items, total: result.total };
        },
      },
    },
    rowConfig: { keyField: 'account_key' },
    sortConfig: { remote: true },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<PhoneAccount>,
});

async function loadFilterOptions() {
  const options = await PhoneAccountApi.filterOptions();
  filterOptions.value = {
    platforms: options.platforms ?? [],
    purposes: options.purposes ?? [],
    statuses: options.statuses ?? [],
    types: options.types ?? [],
  };
  await gridApi.formApi.updateSchema(useFormSchema(filterOptions.value));
}

async function onStatusChange(status: PhoneAccountStatus, row: PhoneAccount) {
  await PhoneAccountApi.update(row.account_key, {
    account_name: row.account_name,
    account_type: row.account_type,
    clear_password: false,
    login_url: row.login_url,
    note: row.note,
    phone_number: row.phone_number,
    platform: row.platform,
    purpose: row.purpose,
    status,
  });
  return true;
}

function openCreate() {
  formDrawerApi.setData({ filterOptions: filterOptions.value }).open();
}

function openEdit(row: PhoneAccount) {
  formDrawerApi.setData({ filterOptions: filterOptions.value, row }).open();
}

async function remove(account: PhoneAccount) {
  await PhoneAccountApi.remove(account.account_key);
  await gridApi.query();
}

function onRefresh() {
  gridApi.query();
}

onMounted(loadFilterOptions);
</script>

<template>
  <Page
    auto-content-height
    class="management-page"
    content-class="management-content"
  >
    <FormDrawer @success="onRefresh" />
    <header class="page-heading">
      <div>
        <h1>号码账号</h1>
        <p>记录电话号码注册的邮箱、第三方平台和对应业务用途</p>
      </div>
    </header>

    <Grid class="management-grid" table-title="号码账号">
      <template #toolbar-tools>
        <Button
          v-access:code="'phone_accounts:manage'"
          type="primary"
          @click="openCreate"
        >
          <template #icon><Plus /></template>新增账号
        </Button>
      </template>
      <template #accountName="{ row }">
        <Button
          v-access:code="'phone_accounts:manage'"
          class="min-w-0 truncate px-0 text-left"
          size="small"
          type="link"
          @click.stop="openEdit(row)"
        >
          {{ row.account_name || '-' }}
        </Button>
      </template>
      <template #accountType="{ row }">
        <Tag :color="row.account_type === 'email' ? 'blue' : 'cyan'">
          <DicLabel code="msg_phone_account_type" :value="row.account_type" />
        </Tag>
      </template>
      <template #platform="{ row }">
        <DicLabel code="msg_phone_account_platform" :value="row.platform" />
      </template>
      <template #loginUrl="{ row }">
        <a
          v-if="row.login_url"
          :href="row.login_url"
          rel="noopener noreferrer"
          target="_blank"
        >
          {{ row.login_url }}
        </a>
        <span v-else>{{ displayValue(row.login_url) }}</span>
      </template>
      <template #password="{ row }">
        <Tag>{{ row.password_set ? '已配置' : '未配置' }}</Tag>
      </template>
      <template #updatedAt="{ row }">
        {{ Times.formatUnix(row.updated_at) }}
      </template>
      <template #actions="{ row }">
        <Popconfirm
          :title="`确认删除 ${row.platform} 的账号记录？`"
          cancel-text="取消"
          ok-text="删除"
          @confirm="remove(row)"
        >
          <Button
            v-access:code="'phone_accounts:manage'"
            danger
            size="small"
            type="link"
          >
            <template #icon><X /></template>删除
          </Button>
        </Popconfirm>
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
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
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
  grid-template-columns:
    minmax(240px, 1.4fr) 150px minmax(150px, 1fr)
    140px auto;
  gap: 12px;
  padding: 12px;
  margin-bottom: 12px;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

@media (max-width: 900px) {
  .filter-bar {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 760px) {
  .page-heading {
    flex-direction: column;
    align-items: flex-start;
  }

  .filter-bar {
    grid-template-columns: 1fr;
  }
}
</style>
