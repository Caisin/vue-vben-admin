<script setup lang="ts">
import type { Dayjs } from 'dayjs';

import type { Account } from '#/api/payment-monitor';

import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { useAccess } from '@vben/access';
import { Page } from '@vben/common-ui';

import {
  Alert,
  Button,
  DatePicker,
  Descriptions,
  DescriptionsItem,
  Input,
  message,
  Modal,
  Space,
  Table,
  Tag,
} from 'antdv-next';

import { PaymentApi } from '#/api/payment-monitor';
import { requestErrorMessage } from '#/request-errors';
import { Times } from '#/times';

import AccountModal from './modules/account-modal.vue';
import { money } from './modules/format';
const router = useRouter();
const { hasAccessByCodes } = useAccess();
const rows = ref<Account[]>([]);
const total = ref(0);
const current = ref(1);
const size = ref(20);
const keyword = ref('');
const busy = ref(false);
const loadError = ref('');
const editing = ref<Account>();
const editOpen = ref(false);
const health = ref<Account>();
const healthOpen = ref(false);
const syncing = ref<Account>();
const syncOpen = ref(false);
const syncBusy = ref(false);
const range = ref<[Dayjs, Dayjs]>();
const columns = [
  { title: '账户', dataIndex: 'name', width: 180 },
  { title: '支付商/环境', dataIndex: 'provider', width: 130 },
  { title: '远端账户', dataIndex: 'remote_account_id', width: 210 },
  { title: '定时采集', dataIndex: 'enabled', width: 110 },
  { title: '最近成功', dataIndex: 'last_success_at', width: 180 },
  { title: '异常', dataIndex: 'last_error', width: 260 },
  {
    title: '操作',
    dataIndex: 'operation',
    width: 250,
    fixed: 'right' as const,
  },
];
async function load() {
  busy.value = true;
  try {
    const r = await PaymentApi.accounts({
      page: current.value,
      size: size.value,
      keyword: keyword.value,
    });
    rows.value = r.items;
    total.value = Number(r.total);
    loadError.value = '';
  } catch (error) {
    loadError.value = requestErrorMessage(error, '读取账户失败');
  } finally {
    busy.value = false;
  }
}
function edit(a?: Account) {
  editing.value = a;
  editOpen.value = true;
}
function start(a: Account) {
  syncing.value = a;
  range.value = undefined;
  syncOpen.value = true;
}
async function submit() {
  if (!syncing.value) return;
  syncBusy.value = true;
  try {
    const job = await PaymentApi.sync(
      syncing.value.id,
      range.value
        ? { from: range.value[0].unix(), to: range.value[1].unix() }
        : {},
    );
    message.success('采集任务已提交，可在任务列表查看进度');
    syncOpen.value = false;
    await router.push({
      path: '/payment-monitor/jobs',
      query: { account_id: String(syncing.value.id), job_id: String(job.id) },
    });
  } finally {
    syncBusy.value = false;
  }
}
onMounted(load);
</script>
<template>
  <Page>
    <h1 class="mb-4 text-xl font-semibold">支付账户</h1>
    <Space wrap class="mb-4">
      <Input
        v-model:value="keyword"
        placeholder="搜索账户名称"
        @press-enter="
          current = 1;
          load();
        "
      /><Button
        @click="
          current = 1;
          load();
        "
      >
        查询
</Button><Button @click="load">刷新</Button><Button
        v-if="hasAccessByCodes(['payment-monitor:manage'])"
        type="primary"
        @click="edit()"
      >
        接入支付账户
      </Button>
    </Space>
    <Alert v-if="loadError" type="error" :message="loadError" class="mb-4" />
    <Table
      :columns="columns"
      :data-source="rows"
      :loading="busy"
      row-key="id"
      :scroll="{ x: 1400 }"
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
        <template v-if="column.dataIndex === 'provider'">
          {{ record.provider }}
          <Tag :color="record.livemode ? 'green' : 'orange'">
            {{ record.livemode ? '生产' : '测试' }}
          </Tag>
        </template>
        <template v-else-if="column.dataIndex === 'remote_account_id'">
          {{ record.remote_account_id || '等待首次验证' }}
        </template>
        <Tag
          v-else-if="column.dataIndex === 'enabled'"
          :color="record.enabled ? 'green' : 'default'"
        >
          {{ record.enabled ? '启用' : '停用' }}
        </Tag>
        <template v-else-if="column.dataIndex === 'last_success_at'">
          {{ Times.formatOptionalUnix(record.last_success_at) }}
        </template>
        <div
          v-else-if="column.dataIndex === 'last_error'"
          class="max-w-64 whitespace-pre-wrap break-words text-red-500"
        >
          {{ record.last_error || '—' }}
        </div>
        <Space v-else-if="column.dataIndex === 'operation'">
          <Button
            type="link"
            @click="
              health = record as Account;
              healthOpen = true;
            "
          >
            状态
</Button><Button
            v-if="hasAccessByCodes(['payment-monitor:manage'])"
            type="link"
            @click="edit(record as Account)"
          >
            配置
</Button><Button
            v-if="hasAccessByCodes(['payment-monitor:sync'])"
            type="link"
            :disabled="!record.enabled"
            @click="start(record as Account)"
          >
            采集
          </Button>
        </Space>
      </template>
    </Table>
    <AccountModal v-model:open="editOpen" :account="editing" @saved="load" />
    <Modal
      v-model:open="syncOpen"
      title="采集账单与争议"
      :confirm-loading="syncBusy"
      @ok="submit"
    >
      <p class="mb-4">
        {{
          syncing?.name
        }}：留空使用增量窗口，首次按账户回溯天数拉取。可指定历史时间段回补；结束时间不包含。
      </p>
      <DatePicker.RangePicker v-model:value="range" show-time class="!w-full" />
    </Modal>
    <Modal
      v-model:open="healthOpen"
      :title="`${health?.name || ''} · 资金与数据状态`"
      :width="800"
      :footer="null"
    >
      <template v-if="health">
        <Descriptions :column="2" bordered>
          <DescriptionsItem label="远端账户">
            {{ health.remote_account_id || '未验证' }}
</DescriptionsItem><DescriptionsItem label="国家">
            {{ health.health.country || '未知' }}
</DescriptionsItem><DescriptionsItem label="收款">
            {{
              health.health.charges_enabled == null
                ? '未知'
                : health.health.charges_enabled
                  ? '可用'
                  : '受限'
            }}
</DescriptionsItem><DescriptionsItem label="提现">
            {{
              health.health.payouts_enabled == null
                ? '未知'
                : health.health.payouts_enabled
                  ? '可用'
                  : '受限'
            }}
</DescriptionsItem><DescriptionsItem label="限制原因" :span="2">
            {{ health.health.disabled_reason || '—' }}
          </DescriptionsItem>
        </Descriptions>
        <h3 class="my-3 font-semibold">可用余额 / 待结算余额</h3>
        <p
          v-for="b in health.health.balance?.available || []"
          :key="`a-${b.currency}`"
        >
          可用：{{ money(b.amount, b.currency) }}
        </p>
        <p
          v-for="b in health.health.balance?.pending || []"
          :key="`p-${b.currency}`"
        >
          待结算：{{ money(b.amount, b.currency) }}
        </p>
        <Alert
          v-if="health.health.efw_error || health.health.missing?.length"
          type="warning"
          :message="
            [health.health.efw_error, ...(health.health.missing || [])]
              .filter(Boolean)
              .join('；')
          "
          class="my-3"
        />
        <h3 class="my-3 font-semibold">已完整采集范围（结束时间不包含）</h3>
        <p v-if="!health.coverage.length">尚未完成同步</p>
        <p v-for="r in health.coverage" :key="r[0]">
          {{ Times.formatOptionalUnix(r[0]) }} ～
          {{ Times.formatOptionalUnix(r[1]) }}
        </p>
      </template>
    </Modal>
  </Page>
</template>
