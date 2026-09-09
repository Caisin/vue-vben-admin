<script setup lang="ts">
import type { Dayjs } from 'dayjs';

import type {
  Analysis,
  Id,
  NetworkEstimate,
  Ranking,
} from '#/api/payment-monitor';

import { computed, onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  Alert,
  Button,
  Card,
  DatePicker,
  Descriptions,
  DescriptionsItem,
  Modal,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
} from 'antdv-next';
import dayjs from 'dayjs';

import { PaymentApi } from '#/api/payment-monitor';
import { requestErrorMessage } from '#/request-errors';

import AccountSelect from './modules/account-select.vue';
import { money, percent } from './modules/format';
const accountId = ref<Id>();
const live = ref(1);
const brand = ref<string>();
const daily = ref(0);
const metric = ref('activity');
const range = ref<[Dayjs, Dayjs]>([
  dayjs().subtract(30, 'day').startOf('day'),
  dayjs(),
]);
const result = ref<Analysis>({ items: [], timezone: 'UTC', warning: '' });
const loading = ref(false);
const loadError = ref('');
const active = ref<Ranking>();
const detailOpen = ref(false);
const trend = ref<Ranking[]>([]);
const networks = ref<NetworkEstimate[]>([]);
const totals = computed(() => {
  const sum = { payments: 0, disputes: 0, efws: 0, incomplete: 0 };
  for (const row of result.value.items) {
    sum.payments += Number(row.metrics.card_payments);
    sum.disputes += Number(row.metrics.disputes);
    sum.efws += row.efw_available ? Number(row.metrics.efws) : 0;
    sum.incomplete += !row.complete || row.stale ? 1 : 0;
  }
  return sum;
});
const columns = [
  { title: '账户', dataIndex: 'name', width: 190 },
  { title: '统计区间（UTC）', dataIndex: 'window', width: 210 },
  { title: '成功卡支付', dataIndex: 'payments', width: 115 },
  { title: '争议件数', dataIndex: 'disputes', width: 110 },
  { title: '争议发生率', dataIndex: 'activity', width: 130 },
  { title: '批次争议率', dataIndex: 'cohort', width: 130 },
  { title: '欺诈预警', dataIndex: 'efws', width: 110 },
  { title: '数据状态', dataIndex: 'quality', width: 230 },
  { title: '分析', dataIndex: 'operation', width: 90 },
];
function utc(value: number) {
  return new Date(value * 1000).toISOString().slice(0, 16).replace('T', ' ');
}
async function load() {
  if (!range.value?.[0] || !range.value?.[1]) return;
  loading.value = true;
  try {
    result.value = await PaymentApi.analysis({
      from: range.value[0].unix(),
      to: range.value[1].unix(),
      account_id: accountId.value,
      livemode: live.value === 1,
      brand: brand.value,
      daily: daily.value === 1,
      metric: metric.value,
    });
    loadError.value = '';
  } catch (error) {
    loadError.value = requestErrorMessage(error, '读取排行失败');
  } finally {
    loading.value = false;
  }
}
async function detail(row: Ranking) {
  active.value = row;
  detailOpen.value = true;
  trend.value = [];
  networks.value = [];
  try {
    networks.value = await PaymentApi.network(row.account_id);
    const r = await PaymentApi.analysis({
      from: range.value[0].unix(),
      to: range.value[1].unix(),
      account_id: row.account_id,
      livemode: row.livemode,
      brand: brand.value,
      daily: true,
      metric: 'activity',
    });
    trend.value = r.items;
  } catch (error) {
    loadError.value = requestErrorMessage(error, '读取趋势失败');
  }
}
const points = computed(() => {
  const values = trend.value.map((r) => r.metrics.activity_bps);
  const max = Math.max(100, ...values.map((v) => v ?? 0));
  return values
    .map((v, i) =>
      v === null || v === undefined
        ? ''
        : `${30 + (i * 720) / Math.max(1, values.length - 1)},${150 - (v / max) * 125}`,
    )
    .filter(Boolean)
    .join(' ');
});
onMounted(load);
</script>
<template>
  <Page>
    <h1 class="mb-4 text-xl font-semibold">争议率排行与分析</h1>
    <Space wrap class="mb-4">
      <AccountSelect v-model="accountId" /><DatePicker.RangePicker
        v-model:value="range"
        show-time
      /><Select
        v-model:value="live"
        class="!w-32"
        :options="[
          { label: '生产账户', value: 1 },
          { label: '测试账户', value: 0 },
        ]"
      /><Select
        v-model:value="brand"
        allow-clear
        placeholder="全部卡组"
        class="!w-36"
        :options="
          ['visa', 'mastercard', 'amex', 'jcb'].map((value) => ({
            value,
            label: value,
          }))
        "
      /><Select
        v-model:value="daily"
        class="!w-36"
        :options="[
          { value: 0, label: '所选时段排行' },
          { value: 1, label: '每日排行' },
        ]"
      /><Select
        v-model:value="metric"
        class="!w-44"
        :options="[
          { value: 'activity', label: '按争议发生率排序' },
          { value: 'cohort', label: '按批次争议率排序' },
          { value: 'disputes', label: '按争议件数排序' },
        ]"
      /><Button type="primary" :loading="loading" @click="load">
        查询分析
      </Button>
    </Space>
    <p class="mb-3 text-sm text-muted-foreground">
      时间选择器使用本地时间输入，日排行按 UTC
      自然日分组，结束时刻不包含。生产与测试分开统计；金额不跨币种累加。
    </p>
    <Alert
      v-if="result.warning"
      show-icon
      type="info"
      :message="result.warning"
      class="mb-4"
    /><Alert v-if="loadError" type="error" :message="loadError" class="mb-4" />
    <div class="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
      <Card><Statistic title="成功卡支付" :value="totals.payments" /></Card><Card>
        <Statistic title="争议件数（含赢诉）" :value="totals.disputes" />
</Card><Card><Statistic title="早期欺诈预警" :value="totals.efws" /></Card><Card>
        <Statistic title="覆盖不足 / 数据陈旧行" :value="totals.incomplete" />
      </Card>
    </div>
    <Table
      :columns="columns"
      :data-source="result.items"
      :loading="loading"
      :row-key="(r) => `${r.account_id}:${r.from}`"
      :scroll="{ x: 1315 }"
      :pagination="{ pageSize: 20, showSizeChanger: true }"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'window'">
          {{ utc(record.from) }}<br />至 {{ utc(record.to) }}
</template><template v-else-if="column.dataIndex === 'payments'">
          {{ record.metrics.card_payments }}
</template><template v-else-if="column.dataIndex === 'disputes'">
          {{ record.metrics.disputes }}
</template><template v-else-if="column.dataIndex === 'activity'">
          {{ percent(record.metrics.activity_bps) }}
</template><template v-else-if="column.dataIndex === 'cohort'">
          {{ percent(record.metrics.cohort_bps) }}
</template><template v-else-if="column.dataIndex === 'efws'">
          {{ record.efw_available ? record.metrics.efws : '—' }}
        </template>
        <template v-else-if="column.dataIndex === 'quality'">
          <Tag :color="record.complete && !record.stale ? 'green' : 'orange'">
            {{ record.complete ? '覆盖完整' : '覆盖不足' }}
</Tag><Tag v-if="record.stale" color="error">数据陈旧</Tag><Tag v-if="!record.efw_available" color="warning">欺诈信号缺失</Tag><Tag v-if="!record.updates_available" color="warning">
            状态核对不足
</Tag><Tag v-if="record.provisional">批次未成熟</Tag><Tag v-if="record.metrics.unknown_brand" color="warning">
            卡组缺失
          </Tag>
</template><Button
          v-else-if="column.dataIndex === 'operation'"
          type="link"
          @click="detail(record as Ranking)"
        >
          分析
        </Button>
      </template>
    </Table>
    <Modal
      v-model:open="detailOpen"
      :title="`${active?.name || ''} · 风险分析`"
      :width="1000"
      :footer="null"
    >
      <template v-if="active">
        <Descriptions :column="2" bordered>
          <DescriptionsItem label="争议发生率">
            {{ percent(active.metrics.activity_bps) }}
</DescriptionsItem><DescriptionsItem label="交易批次争议率">
            {{ percent(active.metrics.cohort_bps) }}
</DescriptionsItem><DescriptionsItem label="关联争议支付数">
            {{ active.metrics.cohort_disputed }}
</DescriptionsItem><DescriptionsItem label="可行动欺诈预警">
            {{ active.metrics.actionable_efws }}
          </DescriptionsItem>
        </Descriptions>
        <h3 class="my-3 font-semibold">
          当前数据月卡组参考指标（独立于所选区间，仅估算）
        </h3>
        <div
          v-for="network in networks"
          :key="network.program"
          class="mb-3 rounded border p-3"
        >
          <strong>{{ network.program }}</strong>
          <p
            v-if="
              network.additional_events_at_fixed_denominator !== null &&
              network.additional_events_at_fixed_denominator !== undefined
            "
          >
            分母不变时，至少再增加
            {{ network.additional_events_at_fixed_denominator }}
            件事件可触及件数/比例参考线；实际分母和金额条件仍会变化。
          </p>
          <p v-if="network.volume_threshold_minor">
            美元事件金额：{{
              network.volume_minor === null
                ? '不可用'
                : money(network.volume_minor ?? 0, 'usd')
            }}；参考 {{ money(network.volume_threshold_minor, 'usd') }}
          </p>
          <Tag
            :color="
              network.meets_reference === true
                ? 'error'
                : network.meets_reference === false
                  ? 'blue'
                  : 'orange'
            "
          >
            {{
              network.meets_reference === true
                ? '达到参考线'
                : network.meets_reference === false
                  ? '未达参考线'
                  : '数据不足'
            }}
          </Tag>
          <p>{{ network.formula }}</p>
          <p>
            {{ network.numerator }} / {{ network.denominator }} =
            {{ percent(network.rate_bps) }}；参考：件数 ≥
            {{ network.count_threshold }} 且比例 ≥
            {{ percent(network.rate_threshold_bps) }}
          </p>
          <p class="text-sm text-muted-foreground">
            {{ network.missing.join('；') }}。{{ network.guidance }}
          </p>
        </div>
        <h3 class="my-3 font-semibold">每日争议发生率趋势</h3>
        <svg
          v-if="trend.length"
          viewBox="0 0 800 180"
          class="w-full"
          role="img"
          aria-label="每日争议发生率趋势，具体数值见下方表格"
        >
          <line
            x1="30"
            y1="150"
            x2="750"
            y2="150"
            stroke="currentColor"
            opacity="0.3"
          />
          <polyline
            :points="points"
            fill="none"
            stroke="#f59e0b"
            stroke-width="3"
          />
        </svg>
        <Table
          :data-source="trend"
          row-key="from"
          size="small"
          :pagination="{ pageSize: 7 }"
          :columns="[
            { title: '日期 UTC', dataIndex: 'from' },
            { title: '成功卡支付', dataIndex: 'payments' },
            { title: '争议', dataIndex: 'disputes' },
            { title: '发生率', dataIndex: 'rate' },
          ]"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.dataIndex === 'from'">
              {{ utc(record.from) }}
</template><template v-else-if="column.dataIndex === 'payments'">
              {{ record.metrics.card_payments }}
</template><template v-else-if="column.dataIndex === 'disputes'">
              {{ record.metrics.disputes }}
</template><template v-else-if="column.dataIndex === 'rate'">
              {{ percent(record.metrics.activity_bps) }}
            </template>
          </template>
        </Table>
        <div class="my-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <section>
            <h3 class="mb-2 font-semibold">争议原因</h3>
            <p v-for="(count, reason) in active.metrics.reasons" :key="reason">
              {{ reason }}：{{ count }}
            </p>
          </section>
          <section>
            <h3 class="mb-2 font-semibold">卡组支付构成</h3>
            <p v-for="(count, name) in active.metrics.brands" :key="name">
              {{ name }}：{{ count }}
            </p>
          </section>
          <section>
            <h3 class="mb-2 font-semibold">当前未决争议金额（所有日期）</h3>
            <p
              v-for="(amount, currency) in active.metrics.open_amounts"
              :key="currency"
            >
              {{ money(amount, currency) }}
            </p>
          </section>
          <section>
            <h3 class="mb-2 font-semibold">期间争议金额</h3>
            <p
              v-for="(amount, currency) in active.metrics.disputed_amounts"
              :key="currency"
            >
              {{ money(amount, currency) }}
            </p>
          </section>
        </div>
      </template>
    </Modal>
  </Page>
</template>
