<script setup lang="ts">
import type { Dayjs } from 'dayjs';

import type { Id, RecordRow } from '#/api/payment-monitor';

import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';

import { Page } from '@vben/common-ui';

import {
  Alert,
  Button,
  DatePicker,
  Input,
  Select,
  Space,
  Table,
  Tag,
} from 'antdv-next';

import { PaymentApi } from '#/api/payment-monitor';
import { requestErrorMessage } from '#/request-errors';
import { Times } from '#/times';

import AccountSelect from './modules/account-select.vue';
import { money, states } from './modules/format';
const route = useRoute();
const accountId = ref<Id | undefined>(
  typeof route.query.account_id === 'string'
    ? route.query.account_id
    : undefined,
);
const rows = ref<RecordRow[]>([]);
const kind = ref('dispute');
const keyword = ref('');
const status = ref<string>();
const brand = ref<string>();
const range = ref<[Dayjs, Dayjs]>();
const current = ref(1);
const size = ref(20);
const total = ref(0);
const loading = ref(false);
const loadError = ref('');
const columns = [
  { title: '账户', dataIndex: 'account_id', width: 90 },
  { title: '账单/事件编号', dataIndex: 'object_id', width: 230 },
  { title: '关联支付', dataIndex: 'charge_id', width: 230 },
  { title: '卡组', dataIndex: 'brand', width: 110 },
  { title: '金额', dataIndex: 'amount', width: 190 },
  { title: '状态', dataIndex: 'status', width: 140 },
  { title: '原因', dataIndex: 'reason', width: 190 },
  { title: '发生时间', dataIndex: 'created_at', width: 180 },
  { title: '原支付时间', dataIndex: 'charge_created_at', width: 180 },
  { title: '举证截止', dataIndex: 'due_by', width: 180 },
];
async function load() {
  loading.value = true;
  try {
    const r = await PaymentApi.records({
      account_id: accountId.value,
      kind: kind.value,
      keyword: keyword.value,
      status: status.value,
      brand: brand.value,
      from: range.value?.[0].unix(),
      to: range.value?.[1].unix(),
      page: current.value,
      size: size.value,
    });
    rows.value = r.items;
    total.value = Number(r.total);
    loadError.value = '';
  } catch (error) {
    loadError.value = requestErrorMessage(error, '账单加载失败');
  } finally {
    loading.value = false;
  }
}
onMounted(load);
</script>
<template>
  <Page>
    <h1 class="mb-4 text-xl font-semibold">支付与争议账单</h1>
    <Space wrap class="mb-4">
      <AccountSelect v-model="accountId" /><Select
        v-model:value="kind"
        class="!w-40"
        :options="[
          { label: '争议账单', value: 'dispute' },
          { label: '支付订单', value: 'charge' },
          { label: '早期欺诈预警', value: 'efw' },
        ]"
        @change="status = undefined"
      /><Input
        v-model:value="keyword"
        placeholder="账单/事件编号搜索"
        class="!w-52"
      /><Select
        v-model:value="status"
        allow-clear
        placeholder="状态"
        class="!w-40"
        :options="
          Object.entries(states).map(([value, label]) => ({ value, label }))
        "
      /><Select
        v-model:value="brand"
        allow-clear
        placeholder="卡组织"
        class="!w-40"
        :options="
          ['visa', 'mastercard', 'amex', 'jcb', 'unknown'].map((value) => ({
            label: value,
            value,
          }))
        "
      /><DatePicker.RangePicker v-model:value="range" show-time /><Button
        type="primary"
        @click="
          current = 1;
          load();
        "
      >
        查询
</Button><Button @click="load">刷新</Button>
</Space><Alert v-if="loadError" type="error" :message="loadError" /><Table
      :columns="columns"
      :data-source="rows"
      :loading="loading"
      :row-key="(r) => `${r.account_id}:${r.kind}:${r.object_id}`"
      :scroll="{ x: 1820 }"
      :pagination="{ current, pageSize: size, total, showSizeChanger: true }"
      @change="
        (p) => {
          current = p.current || 1;
          size = p.pageSize || 20;
          load();
        }
      "
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'amount'">
          {{ money(record.amount, record.currency) }}
</template><Tag v-else-if="column.dataIndex === 'status'">
          {{ states[record.status] || record.status }}
</Tag><template
          v-else-if="
            ['created_at', 'charge_created_at', 'due_by'].includes(
              String(column.dataIndex),
            )
          "
        >
          {{
            Times.formatOptionalUnix(
              record[
                column.dataIndex as
                  'created_at' | 'charge_created_at' | 'due_by'
              ],
            )
          }}
        </template>
      </template>
    </Table>
  </Page>
</template>
