<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { PayOrderSummary } from '#/api/res/seas/global/order';
import type { RuntimeUser } from '#/api/res/seas/global/user';

import { computed, ref } from 'vue';

import { Page } from '@vben/common-ui';

import { Alert, Button, message, Tag } from 'antdv-next';

import { useVbenVxeGrid, VbenTableAction } from '#/adapter/vxe-table';
import {
  getList,
  getTotal,
  recovery,
  refund,
} from '#/api/res/seas/global/order';
import { vxeSortParams } from '#/vxe-sort';

import UserDetailModal from '../user/Modal.vue';
import { orderStateOptions, useColumns, useGridFormSchema } from './data';

const summaryLoading = ref(false);
const summary = ref<PayOrderSummary>({});
const detailOpen = ref(false);
const selectedUser = ref<null | RuntimeUser>(null);

const paidAmountText = computed(() => {
  const amounts = summary.value.amounts ?? [];
  if (amounts.length === 0) return '0.00';
  return amounts
    .map(
      (item) =>
        `${item.currency || 'USD'} ${formatMoneyMinor(item.paid_amount_minor)}`,
    )
    .join(' / ');
});

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

function clean(params: Record<string, any>) {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== '' && value !== null,
    ),
  );
}

function encodeQuery(formValues: Record<string, any>) {
  return clean({
    ...formValues,
    country_code: formValues.country_code?.trim(),
    created_end: dayEnd(formValues.created_end_date),
    created_start: dayStart(formValues.created_start_date),
    created_end_date: undefined,
    created_start_date: undefined,
    idempotency_key: formValues.idempotency_key?.trim(),
    provider: formValues.provider?.trim(),
    provider_order_id: formValues.provider_order_id?.trim(),
  });
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    schema: useGridFormSchema(),
    submitOnChange: true,
  },
  gridOptions: {
    columns: useColumns(),
    height: 'auto',
    pagerConfig: { pageSize: 20, pageSizes: [10, 20, 50, 100] },
    proxyConfig: {
      ajax: {
        query: async (params, formValues) => {
          const query = encodeQuery(formValues);
          const sort = vxeSortParams(params, ['created_at']);
          summaryLoading.value = true;
          try {
            const [page, total] = await Promise.all([
              getList({
                ...query,
                ...sort,
                page: params.page.currentPage,
                pageSize: params.page.pageSize,
              }),
              getTotal({ ...query, ...sort }),
            ]);
            summary.value = total;
            return page;
          } finally {
            summaryLoading.value = false;
          }
        },
      },
    },
    rowConfig: { keyField: 'id' },
    sortConfig: {
      defaultSort: { field: 'created_at', order: 'desc' },
      remote: true,
    },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions,
});

function openUser(acctId: number | string) {
  selectedUser.value = { id: Number(acctId) } as RuntimeUser;
  detailOpen.value = true;
}

async function refundOrder(id: number | string) {
  await refund(id);
  message.success('退款处理完成');
  await gridApi.query();
}

async function recoverOrder(id: number | string) {
  await recovery(id);
  message.success('恢复处理完成');
  await gridApi.query();
}

function formatTime(value?: number | string) {
  if (!value) return '-';
  const numeric = Number(value);
  if (Number.isFinite(numeric))
    return new Date(numeric * 1000).toLocaleString();
  return String(value);
}

function formatMoneyMinor(value?: number | string) {
  const amount = Number(value ?? 0) / 100;
  return amount
    ? amount.toLocaleString(undefined, {
        maximumFractionDigits: 2,
        minimumFractionDigits: 2,
      })
    : '0.00';
}

function product(row: any) {
  return row.product_snapshot ?? row.pay_item_info ?? {};
}

function orderAmount(row: any) {
  return row.pay_amount ?? row.amount_minor ?? product(row).amount_minor;
}

function itemType(row: any) {
  return row.item_type ?? product(row).item_type ?? '-';
}

function orderBenefit(row: any) {
  const snapshot = product(row);
  if (snapshot.unlock_episode_count)
    return `${snapshot.unlock_episode_count}章`;
  if (
    Array.isArray(snapshot.balance_grants) &&
    snapshot.balance_grants.length > 0
  )
    return snapshot.balance_grants
      .map((item: any) => `${item.quantity ?? 0}金币`)
      .join(' / ');
  if (
    Array.isArray(snapshot.membership_grants) &&
    snapshot.membership_grants.length > 0
  )
    return '会员';
  return '-';
}

function orderStateText(value: string) {
  return (
    orderStateOptions.find((item) => item.value === value)?.label ??
    value ??
    '-'
  );
}
</script>

<template>
  <Page
    auto-content-height
    class="management-page"
    content-class="management-content"
    title="订单管理"
  >
    <Alert class="mb-3" type="info" :show-icon="false">
      <template #message>
        <div class="flex flex-wrap items-center gap-x-6 gap-y-2">
          <span><strong class="mr-1">总金额:</strong>{{ paidAmountText }}</span>
          <span><strong class="mr-1">支付笔数:</strong>{{ summary.paid_count ?? 0 }}</span>
          <span><strong class="mr-1">订单笔数:</strong>{{ summary.order_count ?? 0 }}</span>
          <span><strong class="mr-1">退款笔数:</strong>{{ summary.refunded_count ?? 0 }}</span>
          <span><strong class="mr-1">支付人数:</strong>{{ summary.paid_user_count ?? 0 }}</span>
          <span><strong class="mr-1">iOS 支付:</strong>{{ summary.ios_paid_count ?? 0 }}</span>
          <span><strong class="mr-1">Android 支付:</strong>{{ summary.android_paid_count ?? 0 }}</span>
          <span v-if="summaryLoading">汇总刷新中...</span>
        </div>
      </template>
    </Alert>

    <Grid class="management-grid" table-title="订单管理">
      <template #account="{ row }">
        <Button class="px-0" type="link" @click="openUser(row.acct_id)">
          {{ row.acct_id }}
        </Button>
      </template>
      <template #amount="{ row }">
        {{ formatMoneyMinor(orderAmount(row)) }}
      </template>
      <template #itemType="{ row }">
        <Tag color="blue">{{ itemType(row) }}</Tag>
      </template>
      <template #benefit="{ row }">{{ orderBenefit(row) }}</template>
      <template #state="{ row }">
        <Tag
          :color="
            row.state === 'paid'
              ? 'success'
              : row.state === 'refunded'
                ? 'warning'
                : 'default'
          "
        >
          {{ orderStateText(row.state) }}
        </Tag>
      </template>
      <template #createdAt="{ row }">
        {{ formatTime(row.created_at) }}
      </template>
      <template #operation="{ row }">
        <VbenTableAction
          :actions="[
            {
              disabled: row.state !== 'paid',
              icon: 'lucide:undo-2',
              popConfirm: {
                confirm: () => refundOrder(row.id),
                title: '确认将订单标记为退款并回滚权益？',
              },
              text: '退款',
            },
          ]"
          :dropdown-actions="[
            {
              disabled: row.state !== 'refunded',
              icon: 'lucide:rotate-ccw',
              popConfirm: {
                confirm: () => recoverOrder(row.id),
                title: '确认恢复订单权益？',
              },
              text: '恢复',
            },
          ]"
          align="center"
        />
      </template>
    </Grid>

    <UserDetailModal v-model:open="detailOpen" :user="selectedUser" />
  </Page>
</template>
