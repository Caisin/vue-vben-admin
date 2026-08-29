<script lang="ts" setup>
import type { NotifyChannelOption } from './data';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type {
  NotifyChannel,
  NotifyDeliveryAttempt,
  NotifyMessage,
  NotifyMessageEnqueue,
  NotifyMessagePriority,
  NotifyMessageStatus,
} from '#/api/notify';
import type { JsonValue } from '#/api/request';

import { computed, onMounted, reactive, ref, shallowRef, watch } from 'vue';

import { Page } from '@vben/common-ui';
import { Plus } from '@vben/icons';

import {
  Form as AForm,
  Button,
  Descriptions,
  DescriptionsItem,
  FormItem,
  Input,
  InputNumber,
  message,
  Popconfirm,
  Select,
  Space,
  Tag,
} from 'antdv-next';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { NotifyChannelApi, NotifyMessageApi } from '#/api/notify';
import { FieldHelp } from '#/components/management';
import { Times } from '#/times';
import { vxeSortParams } from '#/vxe-sort';

import { editableNotifyPayload } from '../editable-payload';
import {
  deliveryStatusOptions,
  messageColumns,
  messagePriorityLabel,
  messagePriorityOptions,
  messageStatusColor,
  messageStatusLabel,
  useFormSchema,
} from './data';
import PopupDrawer from './modules/popup-drawer.vue';

type NotifyChannelContext = Pick<
  NotifyChannel,
  'channel_code' | 'channel_name' | 'id'
>;

const props = withDefaults(
  defineProps<{
    channel?: NotifyChannelContext;
    embedded?: boolean;
  }>(),
  { channel: undefined, embedded: false },
);

const rootComponent = computed(() => (props.embedded ? 'div' : Page));
const rootProps = computed(() =>
  props.embedded
    ? { class: 'message-page embedded-message-page' }
    : {
        autoContentHeight: true,
        class: 'message-page',
        contentClass: 'management-content',
      },
);

const messageSortFields = [
  'id',
  'channel_id',
  'created_at',
  'updated_at',
  'sent_at',
  'next_attempt_at',
];
const drawerOpen = ref(false);
const detailOpen = ref(false);
const attemptsOpen = ref(false);
const saving = ref(false);
const composeTitle = ref('手动入队消息');
const currentMessage = ref<NotifyMessage>();
const attempts = ref<NotifyDeliveryAttempt[]>([]);
const attemptsLoading = ref(false);
const channelRows = shallowRef<NotifyChannel[]>([]);
const payloadText = ref('{}');
const form = reactive<NotifyMessageEnqueue>({
  biz_id: '',
  biz_type: '',
  channel_id: 0,
  content: '',
  content_type: 'text',
  dedupe_key: null,
  max_attempts: null,
  not_before: null,
  payload: {},
  priority: 'normal',
  subject: '',
});

const payloadPlaceholder = '{"url":"https://..."}';
const contentTypeOptions = [
  { label: '文本', value: 'text' },
  { label: 'Markdown', value: 'markdown' },
  { label: '链接', value: 'link' },
  { label: 'JSON', value: 'json' },
];
const channelOptions = computed<NotifyChannelOption[]>(() => {
  const options = channelRows.value.map((item) => ({
    label: `${item.channel_name} (${item.channel_code})`,
    value: item.id,
  }));
  if (
    props.channel &&
    !options.some((item) => String(item.value) === String(props.channel?.id))
  ) {
    options.unshift({
      label: `${props.channel.channel_name} (${props.channel.channel_code})`,
      value: props.channel.id,
    });
  }
  return options;
});
const channelLabelMap = computed(() => {
  const labels = new Map(
    channelRows.value.map((item) => [
      String(item.id),
      `${item.channel_name} (${item.channel_code})`,
    ]),
  );
  if (props.channel) {
    labels.set(
      String(props.channel.id),
      `${props.channel.channel_name} (${props.channel.channel_code})`,
    );
  }
  return labels;
});
const tableTitle = computed(() =>
  props.channel ? `${props.channel.channel_name} · 推送消息` : '跨通道消息审计',
);

const [Grid, gridApi] = useVbenVxeGrid<NotifyMessage>({
  formOptions: {
    schema: useFormSchema(channelOptions, !props.embedded),
    submitOnChange: true,
  },
  gridOptions: {
    columns: messageColumns(),
    height: '100%',
    pagerConfig: { pageSize: 20, pageSizes: [10, 20, 50, 100] },
    proxyConfig: {
      ajax: {
        query: async (params, formValues) => {
          const { page } = params;
          if (props.embedded && !props.channel) {
            return { items: [], total: 0 };
          }
          const result = await NotifyMessageApi.list({
            biz_id: String(formValues.biz_id ?? '').trim() || undefined,
            biz_type: String(formValues.biz_type ?? '').trim() || undefined,
            channel_id:
              props.channel?.id ??
              (formValues.channel_id as number | string | undefined),
            page: page.currentPage,
            priority: formValues.priority as NotifyMessagePriority | undefined,
            size: page.pageSize,
            status: formValues.status as NotifyMessageStatus | undefined,
            ...vxeSortParams(params, messageSortFields),
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

onMounted(async () => {
  if (props.embedded) return;
  channelRows.value = await NotifyChannelApi.all();
});

watch(
  () => props.channel?.id,
  async () => {
    if (props.embedded) await gridApi.reload();
  },
);

function openCreate() {
  if (props.embedded && !props.channel) {
    message.warning('请先选择消息通道');
    return;
  }
  Object.assign(form, {
    biz_id: '',
    biz_type: '',
    channel_id: Number(props.channel?.id ?? 0),
    content: '',
    content_type: 'text',
    dedupe_key: null,
    max_attempts: null,
    not_before: null,
    payload: {},
    priority: 'normal',
    subject: '',
  });
  payloadText.value = '{}';
  composeTitle.value = '手动入队消息';
  drawerOpen.value = true;
}

function openResend(row: NotifyMessage) {
  const payload = editableNotifyPayload(row.payload);
  Object.assign(form, {
    biz_id: row.biz_id,
    biz_type: row.biz_type,
    channel_id: Number(row.channel_id),
    content: row.content,
    content_type: row.content_type,
    // 重发必须创建独立消息，不能命中原消息的幂等键。
    dedupe_key: null,
    max_attempts: row.max_attempts,
    not_before: null,
    payload,
    priority: row.priority,
    subject: row.subject,
  });
  payloadText.value = jsonText(payload);
  composeTitle.value = `编辑并重发：${row.subject}`;
  drawerOpen.value = true;
}
function buildPayload(): NotifyMessageEnqueue {
  const channelId = Number(form.channel_id);
  if (!Number.isFinite(channelId) || channelId <= 0) {
    throw new Error('请选择消息通道');
  }
  if (!form.subject.trim() || !form.content.trim()) {
    throw new Error('标题和内容不能为空');
  }
  const payload = JSON.parse(payloadText.value || '{}') as JsonValue;
  if (!payload || Array.isArray(payload) || typeof payload !== 'object') {
    throw new Error('Payload JSON 必须是 JSON object');
  }
  return {
    ...form,
    biz_id: form.biz_id?.trim() || '',
    biz_type: form.biz_type?.trim() || '',
    channel_id: channelId,
    content: form.content.trim(),
    dedupe_key: form.dedupe_key?.trim() || null,
    max_attempts:
      form.max_attempts === null || form.max_attempts === undefined
        ? null
        : Number(form.max_attempts),
    not_before:
      form.not_before === null || form.not_before === undefined
        ? null
        : Number(form.not_before),
    payload,
    subject: form.subject.trim(),
  };
}
async function enqueueMessage() {
  let payload: NotifyMessageEnqueue;
  try {
    payload = buildPayload();
  } catch (error) {
    message.error(error instanceof Error ? error.message : '消息配置无效');
    return;
  }
  saving.value = true;
  try {
    const created = await NotifyMessageApi.create(payload);
    message.success(created.duplicate ? '已有相同消息在队列中' : '消息已入队');
    drawerOpen.value = false;
    await gridApi.reload();
  } finally {
    saving.value = false;
  }
}
async function retry(row: NotifyMessage) {
  await NotifyMessageApi.retry(row.id);
  message.success('消息已重新进入重试队列');
  await gridApi.reload();
}
async function cancel(row: NotifyMessage) {
  await NotifyMessageApi.cancel(row.id);
  message.success('消息已取消');
  await gridApi.reload();
}
function openDetail(row: NotifyMessage) {
  currentMessage.value = row;
  detailOpen.value = true;
}
async function openAttempts(row: NotifyMessage) {
  currentMessage.value = row;
  attemptsOpen.value = true;
  attemptsLoading.value = true;
  try {
    const result = await NotifyMessageApi.attempts(row.id, {
      page: 1,
      size: 50,
    });
    attempts.value = result.items;
  } finally {
    attemptsLoading.value = false;
  }
}
function jsonText(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}

function channelLabel(row: NotifyMessage) {
  return (
    channelLabelMap.value.get(String(row.channel_id)) ??
    `通道 #${row.channel_id}`
  );
}

async function refresh() {
  await gridApi.reload();
}

defineExpose({ refresh });
</script>

<template>
  <component :is="rootComponent" v-bind="rootProps">
    <Grid class="management-grid" :table-title="tableTitle">
      <template #toolbar-tools>
        <Button
          v-access:code="'notify:message:write'"
          :disabled="
            props.embedded ? !props.channel : channelOptions.length === 0
          "
          type="primary"
          @click="openCreate"
        >
          <template #icon><Plus /></template>手动入队
        </Button>
      </template>
      <template #status="{ row }">
        <Tag :color="messageStatusColor(row.status)">
          {{ messageStatusLabel(row.status) }}
        </Tag>
      </template>
      <template #subject="{ row }">
        <Button class="px-0" type="link" @click.stop="openDetail(row)">
          {{ row.subject }}
        </Button>
      </template>
      <template #channel="{ row }">
        <span :title="channelLabel(row)">{{ channelLabel(row) }}</span>
      </template>
      <template #priority="{ row }">
        {{ messagePriorityLabel(row.priority) }}
      </template>
      <template #createdAt="{ row }">
        {{ Times.formatOptionalUnix(row.created_at) }}
      </template>
      <template #sentAt="{ row }">
        {{ Times.formatOptionalUnix(row.sent_at) }}
      </template>
      <template #operation="{ row }">
        <Space>
          <Button size="small" type="link" @click.stop="openAttempts(row)">
            投递
          </Button>
          <Button
            v-access:code="'notify:message:write'"
            size="small"
            type="link"
            @click.stop="openResend(row)"
          >
            编辑重发
          </Button>
          <Button
            v-if="row.status === 'failed'"
            v-access:code="'notify:message:retry'"
            size="small"
            type="link"
            @click.stop="retry(row)"
          >
            重试
          </Button>
          <Popconfirm
            v-if="['queued', 'retry'].includes(row.status)"
            title="确认取消这条未发送消息？"
            @confirm="cancel(row)"
          >
            <Button
              v-access:code="'notify:message:retry'"
              danger
              size="small"
              type="link"
            >
              取消
            </Button>
          </Popconfirm>
        </Space>
      </template>
    </Grid>

    <PopupDrawer
      v-model:open="drawerOpen"
      destroy-on-close
      :title="composeTitle"
      width="760"
    >
      <AForm layout="vertical">
        <div class="form-grid">
          <FormItem>
            <template #label>
              <FieldHelp
                help="选择实际投递消息的通道；在通道工作台中会自动带入当前通道。"
                label="消息通道"
              />
            </template>
            <Select
              v-model:value="form.channel_id"
              class="w-full"
              :disabled="props.embedded"
              :options="channelOptions"
              show-search
            />
          </FormItem>
          <FormItem>
            <template #label>
              <FieldHelp
                help="同一批待投递消息中，高优先级会先被扫描；不会绕过通道限速。"
                label="优先级"
              />
            </template>
            <Select
              v-model:value="form.priority"
              :options="messagePriorityOptions"
            />
          </FormItem>
          <FormItem label="标题">
            <Input v-model:value="form.subject" />
          </FormItem>
          <FormItem>
            <template #label>
              <FieldHelp
                help="必须与正文和 provider 支持的格式一致，例如 markdown 通道发送 Markdown 正文。"
                label="内容类型"
              />
            </template>
            <Select
              v-model:value="form.content_type"
              :options="contentTypeOptions"
            />
          </FormItem>
          <FormItem>
            <template #label>
              <FieldHelp
                help="标识消息所属业务，例如 weekly_report，用于查询和审计。"
                label="业务类型"
              />
            </template>
            <Input v-model:value="form.biz_type" />
          </FormItem>
          <FormItem>
            <template #label>
              <FieldHelp
                help="保存业务对象的稳定标识，与业务类型共同定位消息来源。"
                label="业务 ID"
              />
            </template>
            <Input v-model:value="form.biz_id" />
          </FormItem>
          <FormItem>
            <template #label>
              <FieldHelp
                help="同一业务动作应使用稳定键；已有排队、执行、重试或成功消息时返回原消息，避免重复推送。"
                label="幂等键"
              />
            </template>
            <Input v-model:value="form.dedupe_key" />
          </FormItem>
          <FormItem>
            <template #label>
              <FieldHelp
                help="为空时使用通道的最大重试配置；填写后仅覆盖当前消息。"
                label="最大尝试次数"
              />
            </template>
            <InputNumber
              v-model:value="form.max_attempts"
              class="w-full"
              :min="1"
            />
          </FormItem>
          <FormItem class="full-row">
            <template #label>
              <FieldHelp
                help="最终发送正文，不得包含 webhook token、应用密钥或其它凭据。"
                label="内容"
              />
            </template>
            <textarea
              v-model="form.content"
              class="content-textarea"
            ></textarea>
          </FormItem>
          <FormItem class="full-row">
            <template #label>
              <FieldHelp
                help="填写 JSON object，可包含链接和 at 规则等协议参数；不得保存第三方凭据。"
                label="Payload JSON"
              />
            </template>
            <textarea
              v-model="payloadText"
              class="json-textarea"
              :placeholder="payloadPlaceholder"
            ></textarea>
          </FormItem>
        </div>
      </AForm>
      <template #footer>
        <Space>
          <Button @click="drawerOpen = false"> 取消 </Button>
          <Button :loading="saving" type="primary" @click="enqueueMessage">
            {{ composeTitle === '手动入队消息' ? '入队' : '重新入队' }}
          </Button>
        </Space>
      </template>
    </PopupDrawer>

    <PopupDrawer
      v-model:open="detailOpen"
      destroy-on-close
      title="消息详情"
      width="760"
    >
      <Descriptions v-if="currentMessage" bordered :column="1" size="small">
        <DescriptionsItem label="消息编码">
          {{ currentMessage.message_code }}
        </DescriptionsItem>
        <DescriptionsItem label="正文">
          <pre>{{ currentMessage.content }}</pre>
        </DescriptionsItem>
        <DescriptionsItem label="Payload">
          <pre>{{ jsonText(currentMessage.payload) }}</pre>
        </DescriptionsItem>
        <DescriptionsItem label="错误">
          {{ currentMessage.last_error || '-' }}
        </DescriptionsItem>
      </Descriptions>
    </PopupDrawer>

    <PopupDrawer
      v-model:open="attemptsOpen"
      destroy-on-close
      :title="`投递记录：${currentMessage?.subject || ''}`"
      width="900"
    >
      <div v-if="attemptsLoading">加载中...</div>
      <div v-else class="attempt-list">
        <div
          v-for="item in attempts"
          :key="String(item.id)"
          class="attempt-card"
        >
          <div>
            <Tag
              :color="
                item.status === 'succeeded'
                  ? 'success'
                  : item.status === 'failed'
                    ? 'error'
                    : 'processing'
              "
            >
              {{
                deliveryStatusOptions.find((x) => x.value === item.status)
                  ?.label ?? item.status
              }}
            </Tag>
            第 {{ item.attempt_no }} 次 ·
            {{ Times.formatOptionalUnix(item.started_at) }}
          </div>
          <pre>{{
            jsonText({
              request_summary: item.request_summary,
              response_summary: item.response_summary,
              error_message: item.error_message,
            })
          }}</pre>
        </div>
      </div>
    </PopupDrawer>
  </component>
</template>

<style scoped>
.message-page {
  height: 100%;
  min-height: 0;
}

.message-page :deep(.management-content) {
  height: 100%;
  min-height: 0;
}

.embedded-message-page {
  overflow: hidden;
}

.management-grid {
  height: 100%;
  min-height: 0;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 16px;
}

.full-row {
  grid-column: 1 / -1;
}

.content-textarea,
.json-textarea {
  width: 100%;
  min-height: 150px;
  padding: 8px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  border: 1px solid rgb(229 231 235);
  border-radius: 6px;
}

.attempt-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.attempt-card {
  padding: 12px;
  border: 1px solid rgb(229 231 235);
  border-radius: 8px;
}

pre {
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

@media (max-width: 900px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
