<script lang="ts" setup>
import type { SenderMode } from './data';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { SimCardFilterOptions, SmsMessage } from '#/api/msg';

import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';

import { useAccess } from '@vben/access';
import { Page } from '@vben/common-ui';
import { Eye, MessageSquareCode, RotateCw } from '@vben/icons';

import {
  Button,
  Descriptions,
  DescriptionsItem,
  Form,
  FormItem,
  Input,
  message,
  Modal,
  Segmented,
  Select,
  Space,
  Tag,
  TextArea,
  Tooltip,
  TypographyParagraph,
} from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { SimCardApi, SmsMessageApi } from '#/api/msg';
import SimCardSelect from '#/components/management/sim-card-select.vue';
import { displayValue } from '#/management';
import { Times } from '#/times';
import { vxeSortParams } from '#/vxe-sort';

import { useMessageColumns, useMessageFormSchema } from './data';
import PopupDrawer from './modules/popup-drawer.vue';
import PopupModal from './modules/popup-modal.vue';

const messageSortFields = [
  'dedupe_key',
  'sim_iccid',
  'device_code',
  'direction',
  'received_at',
];
const route = useRoute();
const { hasAccessByCodes } = useAccess();
const canManageSmsJobs = computed(() => hasAccessByCodes(['sms_jobs:manage']));
const reprocessLoading = ref(false);
const selectedReprocessLoading = ref(false);
const messageReprocessingKey = ref('');

const filterOptions = ref<SimCardFilterOptions>({
  carriers: [],
  devices: [],
  lifecycle_states: [],
  ownerships: [],
  phone_regions: [],
  real_names: [],
  software_versions: [],
  slot_codes: [],
});
const messageDrawerOpen = ref(false);
const selectedMessage = ref<null | SmsMessage>(null);

const sendOpen = ref(false);
const sendSubmitting = ref(false);
const sendForm = reactive({
  content: '',
  senderCarrier: undefined as string | undefined,
  senderIccids: [] as string[],
  senderMode: 'numbers' as SenderMode,
  to: '',
});

async function loadFilterOptions() {
  const options = await SimCardApi.filterOptions();
  filterOptions.value = {
    carriers: options.carriers ?? [],
    devices: options.devices ?? [],
    lifecycle_states: options.lifecycle_states ?? [],
    ownerships: options.ownerships ?? [],
    phone_regions: options.phone_regions ?? [],
    real_names: options.real_names ?? [],
    software_versions: options.software_versions ?? [],
    slot_codes: options.slot_codes ?? [],
  };
}

const [MessagesGrid, messagesGridApi] = useVbenVxeGrid<SmsMessage>({
  formOptions: {
    schema: useMessageFormSchema(filterOptions.value),
    submitOnChange: true,
  },
  gridOptions: {
    columns: useMessageColumns(),
    height: 'auto',
    pagerConfig: { pageSize: 20, pageSizes: [10, 20, 50, 100] },
    proxyConfig: {
      ajax: {
        query: async (params, formValues) => {
          const { page } = params;
          const result = await SmsMessageApi.list({
            device_code: String(formValues.device_code ?? '') || undefined,
            direction: String(formValues.direction ?? '') || undefined,
            ...vxeSortParams(params, messageSortFields),
            page: page.currentPage,
            received_between: Times.toUnixRange(formValues.received_between),
            sim_iccid: String(formValues.sim_iccid ?? '') || undefined,
            size: page.pageSize,
          });
          return { items: result.items, total: result.total };
        },
      },
    },
    sortConfig: { remote: true },
    rowConfig: { keyField: 'dedupe_key' },
    toolbarConfig: {
      custom: true,
      export: false,
      refresh: true,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<SmsMessage>,
});

function selectedMessages() {
  const grid = messagesGridApi.grid as unknown as
    | undefined
    | { getCheckboxRecords?: () => SmsMessage[] };
  return typeof grid?.getCheckboxRecords === 'function'
    ? grid.getCheckboxRecords()
    : [];
}

function reprocessResultText(result: {
  balances_updated: number;
  expirations_updated: number;
  failed: number;
  phone_numbers_updated: number;
  scanned: number;
  skipped: number;
}) {
  return `扫描 ${result.scanned} 条，余额更新 ${result.balances_updated} 条，有效期更新 ${result.expirations_updated} 条，号码更新 ${result.phone_numbers_updated} 条，跳过 ${result.skipped} 条，失败 ${result.failed} 条`;
}

function openMessage(record: SmsMessage) {
  selectedMessage.value = record;
  messageDrawerOpen.value = true;
}

function openSend() {
  sendForm.content = '';
  sendForm.senderCarrier = undefined;
  sendForm.senderIccids = [];
  sendForm.senderMode = 'numbers';
  sendForm.to = '';
  sendOpen.value = true;
}

function firstQueryValue(value: unknown) {
  return Array.isArray(value) ? value[0] : value;
}

function queryString(key: string) {
  const value = firstQueryValue(route.query[key]);
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function hydrateFiltersFromRoute() {
  return messagesGridApi.formApi.setValues({
    device_code: queryString('device_code'),
    direction: queryString('direction'),
    received_between: Times.parseUnixRange(queryString('received_between')),
    sim_iccid: queryString('sim_iccid'),
  });
}

async function reprocessOneMessage(record: SmsMessage) {
  messageReprocessingKey.value = record.dedupe_key;
  try {
    const result = await SmsMessageApi.reprocessOne(record.dedupe_key);
    message.success(`短信重跑完成：${reprocessResultText(result)}`);
    await messagesGridApi.query();
  } finally {
    messageReprocessingKey.value = '';
  }
}

function reprocessSelectedMessages() {
  const records = selectedMessages();
  if (records.length === 0) {
    message.warning('请先勾选需要重跑的短信记录');
    return;
  }
  Modal.confirm({
    content: `系统将重新解析选中的 ${records.length} 条短信，补充余额、有效期和号码信息。`,
    okText: '开始重跑',
    title: '确认重跑选中短信',
    async onOk() {
      selectedReprocessLoading.value = true;
      try {
        await SmsMessageApi.reprocessSelected({
          dedupe_keys: records.map((record) => record.dedupe_key),
        });
        message.success('选中短信重处理后台任务已提交');
      } finally {
        selectedReprocessLoading.value = false;
      }
    },
  });
}

function reprocessSmsBusinessData() {
  Modal.confirm({
    content:
      '系统将在后台重新扫描已保存的接收短信，补提取余额短信和 iccid 探测短信中的号码信息。',
    okText: '开始重跑',
    title: '确认重跑短信记录',
    async onOk() {
      reprocessLoading.value = true;
      try {
        await SmsMessageApi.reprocessBusinessData();
        message.success('短信记录重处理后台任务已提交');
      } finally {
        reprocessLoading.value = false;
      }
    },
  });
}

async function submitSms() {
  const hasSender =
    sendForm.senderMode === 'numbers'
      ? sendForm.senderIccids.length > 0
      : Boolean(sendForm.senderCarrier);
  if (!hasSender || !sendForm.to.trim() || !sendForm.content.trim()) {
    message.warning('请选择发送号码，并填写接收号码和短信内容');
    return;
  }
  sendSubmitting.value = true;
  try {
    const task = await SimCardApi.sendSmsBatch({
      content: sendForm.content.trim(),
      target_number: sendForm.to.trim(),
      ...(sendForm.senderMode === 'carrier'
        ? { sender_carrier: sendForm.senderCarrier }
        : { sender_iccids: sendForm.senderIccids }),
    });
    message.success(`批量短信任务 #${task.id} 已提交`);
    sendOpen.value = false;
  } finally {
    sendSubmitting.value = false;
  }
}

onMounted(async () => {
  await loadFilterOptions();
  await messagesGridApi.formApi.updateSchema(
    useMessageFormSchema(filterOptions.value),
  );
  await hydrateFiltersFromRoute();
  await messagesGridApi.query();
});
</script>

<template>
  <Page
    auto-content-height
    class="management-page"
    content-class="management-content"
  >
    <header class="page-heading">
      <div>
        <h1>短信管理</h1>
        <p>集中查看接收记录、跟踪发送任务并创建短信</p>
      </div>
      <Space wrap>
        <Button
          v-access:code="'sms_messages:reprocess'"
          :loading="reprocessLoading"
          @click="reprocessSmsBusinessData"
        >
          <template #icon><RotateCw /></template>重跑短信补数据
        </Button>
        <Button v-if="canManageSmsJobs" type="primary" @click="openSend">
          <template #icon><MessageSquareCode /></template>发送短信
        </Button>
      </Space>
    </header>

    <div class="tab-content">
      <MessagesGrid class="management-grid" table-title="短信记录">
        <template #toolbar-tools>
          <Button
            v-access:code="'sms_messages:reprocess'"
            :loading="selectedReprocessLoading"
            @click="reprocessSelectedMessages"
          >
            重跑选中
          </Button>
        </template>
        <template #direction="{ row }">
          <Tag :color="row.direction === 'inbound' ? 'blue' : 'green'">
            {{ row.direction === 'inbound' ? '接收' : '发送' }}
          </Tag>
        </template>
        <template #localNumber="{ row }">
          {{ displayValue(row.local_number) }}
        </template>
        <template #deviceCode="{ row }">
          {{ displayValue(row.device_code) }}
        </template>
        <template #messageContent="{ row }">
          <span class="sms-content-cell" :title="row.content">{{
            row.content
          }}</span>
        </template>
        <template #receivedAt="{ row }">
          {{ Times.formatUnix(row.received_at) }}
        </template>
        <template #actions="{ row }">
          <Space size="small">
            <Tooltip title="查看详情">
              <Button
                aria-label="查看短信详情"
                size="small"
                type="link"
                @click="openMessage(row)"
              >
                <template #icon><Eye /></template>
              </Button>
            </Tooltip>
            <Tooltip title="重跑本条短信补数据">
              <Button
                v-access:code="'sms_messages:reprocess'"
                aria-label="重跑本条短信"
                :loading="messageReprocessingKey === row.dedupe_key"
                size="small"
                type="link"
                @click="reprocessOneMessage(row)"
              >
                <template #icon><RotateCw /></template>
              </Button>
            </Tooltip>
          </Space>
        </template>
      </MessagesGrid>
    </div>

    <PopupDrawer
      v-model:open="messageDrawerOpen"
      size="min(720px, 100vw)"
      title="短信记录详情"
    >
      <template v-if="selectedMessage">
        <Descriptions :column="{ xs: 1, sm: 2 }" bordered size="small">
          <DescriptionsItem label="方向">
            {{ selectedMessage.direction === 'inbound' ? '接收' : '发送' }}
          </DescriptionsItem>
          <DescriptionsItem label="电话卡 ICCID">
            {{ displayValue(selectedMessage.sim_iccid) }}
          </DescriptionsItem>
          <DescriptionsItem label="本机号码">
            {{ displayValue(selectedMessage.local_number) }}
          </DescriptionsItem>
          <DescriptionsItem label="对方号码">
            {{ displayValue(selectedMessage.remote_number) }}
          </DescriptionsItem>
          <DescriptionsItem label="设备">
            {{ displayValue(selectedMessage.device_code) }}
          </DescriptionsItem>
          <DescriptionsItem label="卡槽">
            {{ displayValue(selectedMessage.slot_key) }}
          </DescriptionsItem>
          <DescriptionsItem label="设备时间">
            {{ displayValue(selectedMessage.upstream_time) }}
          </DescriptionsItem>
          <DescriptionsItem label="记录时间">
            {{ Times.formatUnix(selectedMessage.received_at) }}
          </DescriptionsItem>
        </Descriptions>
        <section class="detail-block">
          <h2>短信内容</h2>
          <TypographyParagraph class="content-box">
            {{ selectedMessage.content }}
          </TypographyParagraph>
        </section>
      </template>
    </PopupDrawer>

    <PopupModal
      v-model:open="sendOpen"
      :confirm-loading="sendSubmitting"
      title="发送短信"
      width="640px"
      @ok="submitSms"
    >
      <Form layout="vertical">
        <FormItem label="发送方式" required>
          <Segmented
            v-model:value="sendForm.senderMode"
            :options="[
              { label: '选择号码', value: 'numbers' },
              { label: '按运营商', value: 'carrier' },
            ]"
          />
        </FormItem>
        <FormItem
          v-if="sendForm.senderMode === 'numbers'"
          label="发送号码"
          required
        >
          <SimCardSelect
            v-model="sendForm.senderIccids"
            mode="multiple"
            placeholder="选择一个或多个发送号码"
            require-phone-number
          />
        </FormItem>
        <FormItem v-else label="发送运营商" required>
          <Select
            v-model:value="sendForm.senderCarrier"
            allow-clear
            :options="
              filterOptions.carriers.map((carrier) => ({
                label: carrier,
                value: carrier,
              }))
            "
            placeholder="选择发送号码运营商"
            show-search
          />
        </FormItem>
        <FormItem label="接收号码" required>
          <Input
            v-model:value="sendForm.to"
            placeholder="手动输入接收号码，例如 +8613800138000"
          />
        </FormItem>
        <FormItem label="短信内容" required>
          <TextArea
            v-model:value="sendForm.content"
            :maxlength="1000"
            :rows="5"
            show-count
          />
        </FormItem>
      </Form>
    </PopupModal>
  </Page>
</template>

<style scoped>
.management-page {
  --sms-grid-min-height: clamp(480px, calc(100vh - 330px), 720px);

  min-height: 0;
}

.management-page :deep(.management-content) {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.management-grid {
  flex: 1 1 auto;
  min-height: var(--sms-grid-min-height);
}

.page-heading {
  display: flex;
  flex: 0 0 auto;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
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

.tab-content {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: var(--sms-grid-min-height);
}

.sms-content-cell {
  display: block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail-block {
  margin-top: 20px;
}

.detail-block h2 {
  margin: 0 0 8px;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0;
}

.content-box {
  min-height: 48px;
  padding: 12px;
  margin: 0;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  background: hsl(var(--muted));
  border-radius: 4px;
}

@media (max-width: 760px) {
  .page-heading {
    flex-direction: column;
    align-items: flex-start;
  }

  .management-page {
    --sms-grid-min-height: 420px;
  }
}
</style>
