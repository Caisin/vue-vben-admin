<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type {
  PayOrder,
  PayOrderPageQuery,
  PayOrderSummary,
} from '#/api/asset/pay';

import { computed, ref } from 'vue';

import { Page } from '@vben/common-ui';

import { Button, message, Popconfirm, Space, Statistic } from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { PayApi } from '#/api/asset/pay';
import { vxeSortParams } from '#/vxe-sort';

import { useColumns, useGridFormSchema } from './data';

const payOrderSortFields = [
  'id',
  'acct_id',
  'pay_item_id',
  'content_purchase_seq',
  'user_purchase_seq',
  'created_at',
  'updated_at',
];

const summary = ref<PayOrderSummary>();
const currencySummaries = computed(
  () =>
    summary.value?.amounts?.map((item) => ({
      currency: item.currency,
      paid: `${item.paid_amount_minor} / ${item.order_amount_minor}`,
      refunded: String(item.refunded_amount_minor),
    })) ?? [],
);
const [Grid, gridApi] = useVbenVxeGrid<PayOrder>({
  formOptions: { schema: useGridFormSchema(), submitOnChange: true },
  gridOptions: {
    columns: useColumns(),
    height: 'auto',
    keepSource: true,
    pagerConfig: { pageSize: 20, pageSizes: [10, 20, 50, 100] },
    proxyConfig: {
      ajax: {
        query: async (params, formValues) => {
          const { page } = params;
          const query = {
            ...(formValues as PayOrderPageQuery),
            ...vxeSortParams(params, payOrderSortFields),
            page: page.currentPage,
            size: page.pageSize,
          };
          const [list, nextSummary] = await Promise.all([
            PayApi.orderList(query),
            PayApi.orderSummary(formValues as PayOrderPageQuery),
          ]);
          summary.value = nextSummary;
          return list;
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
  } as VxeTableGridOptions<PayOrder>,
});

async function submitRefund(row: PayOrder) {
  await PayApi.refundOrderTask(row.id, {
    message: '支付订单退款任务已提交',
    payload: { reason: 'admin_refund' },
  });
  message.success('退款任务已提交/已有任务执行中');
  await gridApi.query();
}

async function submitRecovery(row: PayOrder) {
  await PayApi.recoveryOrderTask(row.id, {
    message: '支付订单恢复任务已提交',
    payload: { reason: 'admin_recovery' },
  });
  message.success('恢复任务已提交/已有任务执行中');
  await gridApi.query();
}
</script>

<template>
  <Page
    auto-content-height
    class="management-page"
    content-class="management-content"
  >
    <div class="section-card grid gap-3 md:grid-cols-4">
      <Statistic title="订单数" :value="Number(summary?.order_count ?? 0)" />
      <Statistic title="已支付" :value="Number(summary?.paid_count ?? 0)" />
      <Statistic title="已退款" :value="Number(summary?.refunded_count ?? 0)" />
      <div class="min-w-0 text-sm">
        <div class="text-muted-foreground">币种汇总</div>
        <div v-if="currencySummaries.length" class="mt-1 grid gap-1">
          <div
            v-for="item in currencySummaries"
            :key="item.currency"
            class="flex min-w-0 flex-wrap gap-x-2"
          >
            <span class="font-medium">{{ item.currency }}</span>
            <span>已付/应收 {{ item.paid }}</span>
            <span class="text-muted-foreground">退款 {{ item.refunded }}</span>
          </div>
        </div>
        <div v-else class="mt-1">-</div>
      </div>
    </div>
    <Grid class="management-grid" table-title="支付订单">
      <template #actionCell="{ row }">
        <Space>
          <Popconfirm
            v-if="row.state === 'paid'"
            :title="`确认为订单 ${row.id} 提交退款任务？`"
            @confirm="submitRefund(row)"
          >
            <Button danger size="small">退款</Button>
          </Popconfirm>
          <Popconfirm
            v-if="row.state === 'refunded'"
            :title="`确认为订单 ${row.id} 提交恢复任务？`"
            @confirm="submitRecovery(row)"
          >
            <Button size="small">恢复</Button>
          </Popconfirm>
        </Space>
      </template>
    </Grid>
  </Page>
</template>
