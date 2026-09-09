<script setup lang="ts">
import type { Id, Job } from '#/api/payment-monitor';

import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';

import { Page } from '@vben/common-ui';

import { Alert, Button, Select, Space, Table, Tag } from 'antdv-next';

import { PaymentApi } from '#/api/payment-monitor';
import { requestErrorMessage } from '#/request-errors';
import { useTaskPolling } from '#/task-polling';
import { Times } from '#/times';

import AccountSelect from './modules/account-select.vue';
import { states } from './modules/format';
const route = useRoute();
const accountId = ref<Id | undefined>(
  typeof route.query.account_id === 'string'
    ? route.query.account_id
    : undefined,
);
const rows = ref<Job[]>([]);
const status = ref<string>();
const current = ref(1);
const size = ref(20);
const total = ref(0);
const loading = ref(false);
const loadError = ref('');
const phases: Record<string, string> = {
  charge: '支付订单',
  dispute: '争议',
  efw: '欺诈预警',
  events: '变更核对',
  refresh: '状态核对',
  done: '完成',
};
const columns = [
  { title: '采集编号', dataIndex: 'id', width: 100 },
  { title: '账户', dataIndex: 'account_id', width: 90 },
  { title: '状态', dataIndex: 'status', width: 110 },
  { title: '阶段', dataIndex: 'phase', width: 110 },
  { title: '已写入对象', dataIndex: 'processed', width: 120 },
  { title: '窗口起始', dataIndex: 'from_at', width: 180 },
  { title: '窗口结束（不含）', dataIndex: 'to_at', width: 180 },
  { title: '提交时间', dataIndex: 'created_at', width: 180 },
  { title: '失败原因', dataIndex: 'error_message', width: 350 },
];
const poll = useTaskPolling({
  load: () =>
    PaymentApi.jobs({
      account_id: accountId.value,
      status: status.value,
      page: current.value,
      size: size.value,
    }),
  accept: (r) => {
    rows.value = r.items;
    total.value = Number(r.total);
    loading.value = false;
    loadError.value = '';
  },
  done: (r) => !r.items.some((i) => ['queued', 'running'].includes(i.status)),
  onError: (e) => {
    loadError.value = requestErrorMessage(e, '读取采集进度失败');
    loading.value = false;
    poll.stop();
  },
});
function load() {
  loading.value = true;
  poll.start();
}
onMounted(load);
</script>
<template>
  <Page>
    <h1 class="mb-4 text-xl font-semibold">历史采集任务</h1>
    <Alert
      type="info"
      message="采集通过持久化任务执行，失败保留分页断点并由后续巡检重试。未完整成功的窗口不会标记为已覆盖。"
      class="mb-4"
    /><Space wrap class="mb-4">
      <AccountSelect v-model="accountId" /><Select
        v-model:value="status"
        allow-clear
        class="!w-40"
        placeholder="全部状态"
        :options="
          ['queued', 'running', 'succeeded', 'failed'].map((value) => ({
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
      :scroll="{ x: 1520 }"
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
          v-if="column.dataIndex === 'status'"
          :color="
            record.status === 'failed'
              ? 'error'
              : record.status === 'succeeded'
                ? 'success'
                : 'processing'
          "
        >
          {{ states[record.status] || record.status }}
</Tag><template v-else-if="column.dataIndex === 'phase'">
          {{ phases[record.phase] || record.phase }}
</template><template
          v-else-if="
            ['from_at', 'to_at', 'created_at'].includes(
              String(column.dataIndex),
            )
          "
        >
          {{
            Times.formatOptionalUnix(
              record[column.dataIndex as 'created_at' | 'from_at' | 'to_at'],
            )
          }}
        </template>
        <div
          v-else-if="column.dataIndex === 'error_message'"
          class="whitespace-pre-wrap break-words text-red-500"
        >
          {{ record.error_message || '—' }}
        </div>
      </template>
    </Table>
  </Page>
</template>
