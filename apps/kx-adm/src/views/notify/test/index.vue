<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type {
  NotifyChannel,
  NotifyMessage,
  NotifyMessageStatus,
  NotifyRecipientEndpoint,
  NotifyTestMessageResult,
  NotifyTestMessageSend,
} from '#/api/notify';

import { computed, onMounted, ref, shallowRef } from 'vue';
import { useRouter } from 'vue-router';

import { Page, useVbenModal } from '@vben/common-ui';
import { ExternalLink, IconifyIcon, RotateCw } from '@vben/icons';

import { Alert, Button, message, Space, Tag, Tooltip } from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { NotifyTestApi } from '#/api/notify';
import { Times } from '#/times';
import { vxeSortParams } from '#/vxe-sort';

import { NotifyMessageTestModal } from '../components/message-test';
import { messageStatusColor, messageStatusLabel } from '../messages/data';
import { testMessageColumns, useTestQuerySchema } from './data';
import MessageRecordDrawer from './modules/message-record-drawer.vue';

const channelRows = shallowRef<NotifyChannel[]>([]);
const endpointRows = shallowRef<NotifyRecipientEndpoint[]>([]);
const recordOpen = ref(false);
const selectedRecord = ref<NotifyMessage>();
const lastSendResult = ref<NotifyTestMessageResult>();
const optionsLoading = ref(false);
const router = useRouter();

const channelOptions = computed(() =>
  channelRows.value.map((channel) => ({
    label: `${channel.channel_name} (${channel.channel_code})`,
    value: channel.id,
  })),
);
const channelLabelMap = computed(
  () =>
    new Map(
      channelRows.value.map((channel) => [
        String(channel.id),
        `${channel.channel_name} (${channel.channel_code})`,
      ]),
    ),
);

const [MessageTestModal, messageTestModalApi] = useVbenModal({
  connectedComponent: NotifyMessageTestModal,
  destroyOnClose: false,
});

const [Grid, gridApi] = useVbenVxeGrid<NotifyMessage>({
  formOptions: {
    schema: useTestQuerySchema(channelOptions),
    submitOnChange: true,
  },
  gridOptions: {
    columns: testMessageColumns(),
    height: '100%',
    pagerConfig: { pageSize: 10, pageSizes: [10, 20, 50] },
    proxyConfig: {
      ajax: {
        query: async (params, formValues) => {
          const { page } = params;
          const result = await NotifyTestApi.messages({
            channel_id: formValues.channel_id as number | string | undefined,
            page: page.currentPage,
            size: page.pageSize,
            status: formValues.status as NotifyMessageStatus | undefined,
            ...vxeSortParams(params, ['created_at', 'sent_at']),
          });
          return { items: result.items, total: result.total };
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
  } as VxeTableGridOptions<NotifyMessage>,
});

async function loadOptions() {
  optionsLoading.value = true;
  try {
    const options = await NotifyTestApi.options();
    channelRows.value = options.channels;
    endpointRows.value = options.recipient_endpoints;
  } finally {
    optionsLoading.value = false;
  }
}

onMounted(loadOptions);

function modalData(message?: NotifyMessage) {
  return {
    channels: channelRows.value,
    message,
    recipientEndpoints: endpointRows.value,
  };
}

function openMessageTest() {
  messageTestModalApi.setData(modalData()).open();
}

function channelLabel(row: NotifyMessage) {
  return (
    channelLabelMap.value.get(String(row.channel_id)) ??
    `通道 #${row.channel_id}`
  );
}

function openRecord(row: NotifyMessage) {
  selectedRecord.value = row;
  recordOpen.value = true;
}

function editAndResend(row: NotifyMessage) {
  recordOpen.value = false;
  messageTestModalApi.setData(modalData(row)).open();
}

function submitTestMessage(payload: NotifyTestMessageSend) {
  return NotifyTestApi.send(payload);
}

function refreshHistory() {
  void gridApi.reload();
}

function onMessageSent(result: NotifyTestMessageResult) {
  lastSendResult.value = result;
  refreshHistory();
}

function openChannelManagement() {
  const href = router.resolve({ path: '/notify/channels' }).href;
  window.open(href, '_blank', 'noopener,noreferrer');
}

async function refreshOptions() {
  await loadOptions();
  await gridApi.reload();
  message.success('消息通道选项已刷新');
}
</script>

<template>
  <Page
    auto-content-height
    class="management-page"
    content-class="management-content"
  >
    <MessageTestModal :submit="submitTestMessage" @success="onMessageSent" />

    <header class="page-heading">
      <div>
        <h1>通知测试台</h1>
        <p>发送测试消息并追踪入队、投递与失败原因</p>
      </div>
      <Button
        v-access:code="'notify:test:send'"
        :disabled="channelRows.length === 0"
        type="primary"
        @click="openMessageTest"
      >
        <IconifyIcon icon="lucide:send-horizontal" />
        发送测试
      </Button>
      <Space size="small">
        <Button size="small" type="link" @click="openChannelManagement">
          <template #icon><ExternalLink /></template>
          维护通道
        </Button>
        <Tooltip title="刷新消息通道选项">
          <Button
            aria-label="刷新消息通道选项"
            size="small"
            type="text"
            :loading="optionsLoading"
            @click="refreshOptions"
          >
            <template #icon><RotateCw /></template>
          </Button>
        </Tooltip>
      </Space>
    </header>

    <Alert
      v-if="lastSendResult"
      class="test-result"
      show-icon
      type="success"
      :message="`测试消息 ${lastSendResult.message_code} 已入队`"
      description="下方记录会显示后续发送状态；失败原因保留在记录详情中，不在提示中展示敏感响应。"
    />

    <Grid class="management-grid" table-title="测试记录">
      <template #status="{ row }">
        <Tag :color="messageStatusColor(row.status)">
          {{ messageStatusLabel(row.status) }}
        </Tag>
      </template>
      <template #channel="{ row }">
        <span :title="channelLabel(row)">{{ channelLabel(row) }}</span>
      </template>
      <template #subject="{ row }">
        <Button class="px-0" type="link" @click.stop="openRecord(row)">
          {{ row.subject }}
        </Button>
      </template>
      <template #createdAt="{ row }">
        {{ Times.formatOptionalUnix(row.created_at) }}
      </template>
      <template #sentAt="{ row }">
        {{ Times.formatOptionalUnix(row.sent_at) }}
      </template>
      <template #operation="{ row }">
        <Space>
          <Button size="small" type="link" @click.stop="openRecord(row)">
            详情
          </Button>
          <Button
            v-access:code="'notify:test:send'"
            size="small"
            type="link"
            @click.stop="editAndResend(row)"
          >
            编辑重发
          </Button>
        </Space>
      </template>
    </Grid>

    <MessageRecordDrawer
      v-model:open="recordOpen"
      :message="selectedRecord"
      @edit="editAndResend"
    />
  </Page>
</template>

<style scoped>
.test-result {
  flex: 0 0 auto;
}
</style>
