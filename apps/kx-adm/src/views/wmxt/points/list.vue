<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { WmxtPointHistoryItem, WmxtPointYearOverview } from '#/api/wmxt';

import { onMounted, ref } from 'vue';

import { Page, useVbenDrawer, useVbenModal } from '@vben/common-ui';

import { Alert, Button, Card, Space, Statistic } from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { WmxtAdminApi } from '#/api/wmxt';

import { useColumns, useFormSchema } from './data';
import CheckinConfigForm from './modules/checkin-config-form.vue';
import PointConfigForm from './modules/point-config-form.vue';

const overview = ref<WmxtPointYearOverview>();
const [PointConfigModal, pointConfigModalApi] = useVbenModal({
  connectedComponent: PointConfigForm,
  destroyOnClose: true,
});
const [CheckinConfigDrawer, checkinConfigDrawerApi] = useVbenDrawer({
  connectedComponent: CheckinConfigForm,
  destroyOnClose: true,
});

const [Grid, gridApi] = useVbenVxeGrid<WmxtPointHistoryItem>({
  formOptions: { schema: useFormSchema(), submitOnChange: true },
  gridOptions: {
    columns: useColumns(),
    height: 'auto',
    pagerConfig: { pageSize: 20, pageSizes: [10, 20, 50, 100] },
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) =>
          WmxtAdminApi.point_history({
            ...(formValues as Record<string, number | string>),
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
  } as VxeTableGridOptions<WmxtPointHistoryItem>,
});

async function refreshOverview() {
  overview.value = await WmxtAdminApi.point_overview();
}

function onRefresh() {
  refreshOverview();
  gridApi.query();
}

function openPointConfig() {
  pointConfigModalApi.setData(overview.value).open();
}

function openCheckinConfig() {
  checkinConfigDrawerApi.setData(overview.value).open();
}

onMounted(refreshOverview);
</script>

<template>
  <Page
    auto-content-height
    class="management-page"
    content-class="management-content"
  >
    <PointConfigModal @success="onRefresh" />
    <CheckinConfigDrawer @success="onRefresh" />
    <Alert
      class="mb-4"
      message="年度可发积分 = 总投入金额（元）× 积分换算比例（积分/元）"
      show-icon
      type="info"
    />
    <div class="mb-4 grid grid-cols-1 gap-4 md:grid-cols-5">
      <Card size="small">
        <Statistic title="年度" :value="overview?.year ?? '-'" />
      </Card>
      <Card size="small">
        <Statistic
          suffix="元"
          title="总投入金额"
          :value="Number(overview?.budget_amount ?? 0)"
        />
      </Card>
      <Card size="small">
        <Statistic
          suffix="积分/元"
          title="积分换算比例"
          :value="Number(overview?.point_ratio ?? 0)"
        />
      </Card>
      <Card size="small">
        <Statistic
          title="已用积分"
          :value="Number(overview?.used_points ?? 0)"
        />
      </Card>
      <Card size="small">
        <Statistic
          title="剩余积分"
          :value="Number(overview?.remaining_points ?? 0)"
        />
      </Card>
    </div>
    <Grid class="management-grid" table-title="积分历史">
      <template #toolbar-tools>
        <Space size="small">
          <Button
            v-access:code="'wmxt:point:manage'"
            type="primary"
            @click="openPointConfig"
          >
            年度配置
          </Button>
          <Button
            v-access:code="'wmxt:point:manage'"
            :disabled="!overview?.has_config"
            @click="openCheckinConfig"
          >
            签到配置
          </Button>
        </Space>
      </template>
    </Grid>
  </Page>
</template>
