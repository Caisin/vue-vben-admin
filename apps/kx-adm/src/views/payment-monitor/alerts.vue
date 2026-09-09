<script setup lang="ts">
import type { AlertRow, Id } from '#/api/payment-monitor';

import { onMounted, ref } from 'vue';

import { useAccess } from '@vben/access';
import { Page } from '@vben/common-ui';

import {
  Alert,
  Button,
  Descriptions,
  DescriptionsItem,
  Input,
  message,
  Modal,
  Select,
  Space,
  Table,
  Tag,
} from 'antdv-next';

import { PaymentApi } from '#/api/payment-monitor';
import { requestErrorMessage } from '#/request-errors';
import { Times } from '#/times';

import AccountSelect from './modules/account-select.vue';
import { severity, states } from './modules/format';
const { hasAccessByCodes } = useAccess();
const accountId = ref<Id>();
const rows = ref<AlertRow[]>([]);
const status = ref<string>();
const current = ref(1);
const size = ref(20);
const total = ref(0);
const loading = ref(false);
const loadError = ref('');
const active = ref<AlertRow>();
const detailOpen = ref(false);
const action = ref('acknowledged');
const note = ref('');
const saving = ref(false);
const delivery = ref('');
const canRetry = ref(false);
const columns = [
  { title: '级别', dataIndex: 'severity', width: 110 },
  { title: '账户', dataIndex: 'account_id', width: 90 },
  { title: '预警', dataIndex: 'title', width: 330 },
  { title: '处理状态', dataIndex: 'state', width: 120 },
  { title: '发生时间', dataIndex: 'created_at', width: 180 },
  { title: '投递异常', dataIndex: 'notify_error', width: 250 },
  { title: '操作', dataIndex: 'operation', width: 100 },
];
const labels: Record<string, string> = {
  rate_bps: '比例（bp）',
  payments: '成功卡支付数',
  disputes: '争议数',
  action: '建议措施',
  error: '采集错误',
  last_success_at: '最近成功时间',
  seven_day_bps: '7天发生率（bp）',
  thirty_day_bps: '30天发生率（bp）',
  efw_count: '早期欺诈件数',
  actionable: '可行动件数',
  numerator: '事件数',
  denominator: '卡支付数',
  ratio_bps: '估算比例（bp）',
  formula: '估算口径',
  source: '规则来源',
  official_identification: '官方认定',
  count: '涉及数量',
  reason: '原因',
  currency: '币种',
  amount_minor: '金额（最小单位）',
  balance_type: '余额类型',
  efw: '欺诈信号错误',
  missing: '缺失信号',
  from: '窗口起始',
  to: '窗口结束',
  charges_enabled: '收款可用',
  payouts_enabled: '提现可用',
};
function display(value: unknown) {
  if (value === false) return '否';
  if (value === true) return '是';
  if (Array.isArray(value))
    return value
      .map((v) =>
        typeof v === 'object' ? Object.values(v).join(' · ') : String(v),
      )
      .join('；');
  return typeof value === 'object'
    ? Object.entries(value as Record<string, unknown>)
        .map(([k, v]) => `${k}: ${v}`)
        .join('；')
    : String(value ?? '—');
}
async function load() {
  loading.value = true;
  try {
    const r = await PaymentApi.alerts({
      account_id: accountId.value,
      status: status.value,
      page: current.value,
      size: size.value,
    });
    rows.value = r.items;
    total.value = Number(r.total);
    loadError.value = '';
  } catch (error) {
    loadError.value = requestErrorMessage(error, '读取告警失败');
  } finally {
    loading.value = false;
  }
}
async function detail(row: AlertRow) {
  active.value = row;
  note.value = row.note;
  action.value = row.state === 'open' ? 'acknowledged' : row.state;
  detailOpen.value = true;
  delivery.value = '加载中';
  canRetry.value = false;
  try {
    const d = await PaymentApi.delivery(row.id);
    canRetry.value =
      d.status === 'failed' || (d.status === 'pending' && !!d.last_error);
    delivery.value = `${states[d.status] || d.status}${d.last_error ? `：${d.last_error}` : ''}${d.attempt_count ? `（尝试 ${d.attempt_count} 次）` : ''}`;
  } catch (error) {
    delivery.value = requestErrorMessage(error, '读取投递结果失败');
  }
}
async function handle() {
  if (!active.value) return;
  saving.value = true;
  try {
    await PaymentApi.handle(active.value.id, {
      state: action.value,
      note: note.value,
      expected_version: active.value.version,
    });
    message.success('预警处理记录已保存');
    detailOpen.value = false;
    await load();
  } finally {
    saving.value = false;
  }
}
async function retry() {
  if (!active.value) return;
  await PaymentApi.retryDelivery(active.value.id);
  message.success('已安排重试，请稍后刷新投递结果');
  await detail(active.value);
}
onMounted(load);
</script>
<template>
  <Page>
    <h1 class="mb-4 text-xl font-semibold">资金与争议风险告警</h1>
    <Alert
      type="info"
      show-icon
      message="确认表示已阅，处理表示已记录处置。风险持续存在时，系统仍会按冷却周期再次提醒；不会自动退款、提交举证或改变资金。"
      class="mb-4"
    /><Space wrap class="mb-4">
      <AccountSelect v-model="accountId" /><Select
        v-model:value="status"
        allow-clear
        placeholder="全部处理状态"
        class="!w-44"
        :options="
          ['open', 'acknowledged', 'resolved'].map((value) => ({
            value,
            label: states[value],
          }))
        "
      /><Button
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
      row-key="id"
      :scroll="{ x: 1180 }"
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
        <Tag
          v-if="column.dataIndex === 'severity'"
          :color="severity[record.severity]?.color"
        >
          {{ severity[record.severity]?.label || record.severity }}
</Tag><Tag v-else-if="column.dataIndex === 'state'">
          {{ states[record.state] || record.state }}
</Tag><template v-else-if="column.dataIndex === 'created_at'">
          {{ Times.formatOptionalUnix(record.created_at) }}
</template><Button
          v-else-if="column.dataIndex === 'operation'"
          type="link"
          @click="detail(record as AlertRow)"
        >
          详情
        </Button>
      </template>
    </Table>
    <Modal
      v-model:open="detailOpen"
      :title="active?.title"
      :width="860"
      :footer="null"
    >
      <template v-if="active">
        <Descriptions :column="1" bordered>
          <DescriptionsItem
            v-for="(value, key) in active.detail"
            :key="key"
            :label="labels[key] || key"
          >
            {{ display(value) }}
</DescriptionsItem><DescriptionsItem label="通知状态">
            {{ delivery
            }}<Button
              v-if="canRetry && hasAccessByCodes(['payment-monitor:handle'])"
              type="link"
              @click="retry"
            >
              重试投递
            </Button>
          </DescriptionsItem>
        </Descriptions>
        <div
          v-if="hasAccessByCodes(['payment-monitor:handle'])"
          class="mt-4 flex flex-col gap-3"
        >
          <Select
            v-model:value="action"
            :options="
              ['acknowledged', 'resolved', 'open'].map((value) => ({
                value,
                label: states[value],
              }))
            "
          /><Input.TextArea
            v-model:value="note"
            :rows="4"
            placeholder="记录调查结论和处置措施；标记已处理时必填"
          /><Button type="primary" :loading="saving" @click="handle">
            保存处理记录
          </Button>
        </div>
        <p v-else class="mt-3">处理备注：{{ active.note || '—' }}</p>
      </template>
    </Modal>
  </Page>
</template>
