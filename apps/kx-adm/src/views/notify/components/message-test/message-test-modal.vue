<script lang="ts" setup>
import type {
  NotifyMessageTestModalData,
  NotifyMessageTestSubmit,
} from './types';

import type { VbenFormSchema } from '#/adapter/form';
import type {
  NotifyChannel,
  NotifyMessage,
  NotifyRecipientEndpoint,
  NotifyTestMessageResult,
  NotifyTestMessageSend,
  NotifyTestTarget,
  NotifyTestTargetKind,
} from '#/api/notify';
import type { JsonValue } from '#/api/request';

import { computed, h, ref, shallowRef } from 'vue';
import { useRouter } from 'vue-router';

import { useVbenModal } from '@vben/common-ui';
import { ChevronDown, ExternalLink, RotateCw } from '@vben/icons';

import { Alert, Button, message, Space, Tooltip } from 'antdv-next';

import { useVbenForm } from '#/adapter/form';
import { NotifyTestApi } from '#/api/notify';

import { editableNotifyPayloadObject } from '../../editable-payload';
import {
  buildNotifyMessagePayload,
  contentTypeOptionsForChannel,
  splitNotifyMessagePayload,
} from '../../message-payload';

interface NotifySelectOption<T = number | string> {
  label: string;
  value: T;
}

interface NotifyTestFormValues {
  advanced_open?: boolean;
  at_mobiles?: string;
  at_user_ids?: string;
  channel_id?: number | string;
  content: string;
  content_section?: unknown;
  content_type: string;
  delivery_section?: unknown;
  endpoint_id?: number | string;
  extension_payload?: unknown;
  fallback_to_user_ids?: boolean;
  img_url?: string;
  is_at_all?: boolean;
  pic_url?: string;
  recipient?: string;
  single_title?: string;
  subject: string;
  target_kind: NotifyTestTargetKind;
  url?: string;
}

const props = defineProps<{ submit: NotifyMessageTestSubmit }>();
const emit = defineEmits<{
  success: [result: NotifyTestMessageResult];
}>();

const channelRows = shallowRef<NotifyChannel[]>([]);
const endpointRows = shallowRef<NotifyRecipientEndpoint[]>([]);
const selectedChannelId = ref<number | string>();
const sourceMessage = ref<NotifyMessage>();
const sending = ref(false);
const sendError = ref('');
const optionsLoading = ref(false);
const advancedOpen = ref(false);
const selectedTargetKind = ref<NotifyTestTargetKind>('channel_default');
const router = useRouter();

const channelOptions = computed<NotifySelectOption[]>(() =>
  channelRows.value.map((channel) => ({
    label: `${channel.channel_name} (${channel.channel_code})`,
    value: channel.id,
  })),
);
const endpointOptions = computed<NotifySelectOption[]>(() =>
  endpointRows.value.map((endpoint) => ({
    label: [
      `用户 #${endpoint.uid}`,
      endpoint.app_id || '默认应用',
      endpoint.platform || endpoint.endpoint_type,
      endpoint.device_id || '未标记设备',
      endpoint.provider_recipient_id_masked,
    ].join(' · '),
    value: endpoint.id,
  })),
);
const selectedChannel = computed(() =>
  channelRows.value.find(
    (channel) => String(channel.id) === String(selectedChannelId.value),
  ),
);
const selectedChannelType = computed(() => selectedChannel.value?.channel_type);
const targetKindOptions = computed<NotifySelectOption<NotifyTestTargetKind>[]>(
  () => {
    switch (selectedChannel.value?.channel_type) {
      case 'dingtalk_custom_robot':
      case 'dingtalk_group_bot': {
        return [
          { label: '仅发送到群', value: 'channel_default' },
          { label: '发送并提醒成员', value: 'ding_talk_at' },
        ];
      }
      case 'email':
      case 'sms': {
        return [{ label: '直接接收者', value: 'direct' }];
      }
      case 'push': {
        return [{ label: '推送端点', value: 'recipient_endpoint' }];
      }
      default: {
        return [];
      }
    }
  },
);

const schema: VbenFormSchema<NotifyTestFormValues>[] = [
  {
    component: 'Divider',
    fieldName: 'delivery_section',
    formItemClass: 'col-span-full pb-0',
    hideLabel: true,
    renderComponentContent: () => ({ default: () => '发送设置' }),
  },
  {
    component: 'Select',
    componentProps: () => ({
      class: 'w-full',
      onChange: onChannelChange,
      optionFilterProp: 'label',
      options: channelOptions.value,
      showSearch: true,
    }),
    fieldName: 'channel_id',
    help: '只显示已启用通道；测试消息会进入该通道的正常投递队列。',
    label: '消息通道',
    rules: 'selectRequired',
  },
  {
    component: 'Segmented',
    componentProps: () => ({
      block: true,
      class: 'w-full',
      onChange: onTargetKindChange,
      options: targetKindOptions.value,
    }),
    dependencies: {
      show: () => targetKindOptions.value.length > 1,
      triggerFields: ['channel_id'],
    },
    fieldName: 'target_kind',
    help: '默认只发送消息；选择提醒成员后才会附带 @ 参数。',
    label: '发送范围',
    rules: 'selectRequired',
  },
  {
    component: 'Select',
    componentProps: () => ({
      class: 'w-full',
      optionFilterProp: 'label',
      options: endpointOptions.value,
      showSearch: true,
    }),
    dependencies: {
      show: (values) => values.target_kind === 'recipient_endpoint',
      triggerFields: ['target_kind'],
    },
    fieldName: 'endpoint_id',
    help: '端点只显示脱敏标识；真实推送 token 不会返回浏览器。',
    label: '目标端点',
    rules: 'selectRequired',
  },
  {
    component: 'Input',
    componentProps: { maxlength: 320 },
    dependencies: {
      show: (values) => values.target_kind === 'direct',
      triggerFields: ['target_kind'],
    },
    fieldName: 'recipient',
    help: '邮件通道填写邮箱，短信通道填写 provider 支持的手机号格式。',
    label: '直接接收者',
    rules: 'required',
  },
  {
    component: 'Switch',
    dependencies: {
      show: (values) => values.target_kind === 'ding_talk_at',
      triggerFields: ['target_kind'],
    },
    fieldName: 'is_at_all',
    help: '启用后提醒群内所有人；关闭时至少填写一项 user ID 或手机号。',
    label: '提醒所有人',
  },
  {
    component: 'Switch',
    dependencies: {
      show: (values) =>
        values.target_kind === 'ding_talk_at' && Boolean(values.is_at_all),
      triggerFields: ['is_at_all', 'target_kind'],
    },
    fieldName: 'fallback_to_user_ids',
    help: '钉钉不允许当前机器人 @所有人时，自动改为逐个提醒下方填写的 user ID 或手机号。',
    label: '失败后逐人提醒',
  },
  {
    component: 'Textarea',
    componentProps: {
      autoSize: { maxRows: 4, minRows: 2 },
      placeholder: '多个 user ID 使用逗号或换行分隔',
    },
    dependencies: {
      show: (values) => values.target_kind === 'ding_talk_at',
      triggerFields: ['target_kind'],
    },
    fieldName: 'at_user_ids',
    label: '钉钉 user ID',
  },
  {
    component: 'Textarea',
    componentProps: {
      autoSize: { maxRows: 4, minRows: 2 },
      placeholder: '多个手机号使用逗号或换行分隔',
    },
    dependencies: {
      show: (values) => values.target_kind === 'ding_talk_at',
      triggerFields: ['target_kind'],
    },
    fieldName: 'at_mobiles',
    label: '提醒手机号',
  },
  {
    component: 'Divider',
    fieldName: 'content_section',
    formItemClass: 'col-span-full pb-0',
    hideLabel: true,
    renderComponentContent: () => ({ default: () => '消息内容' }),
  },
  {
    component: 'Input',
    componentProps: { maxlength: 500 },
    fieldName: 'subject',
    formItemClass: 'col-span-full',
    label: '消息标题',
    rules: 'required',
  },
  {
    component: 'Select',
    componentProps: () => ({
      class: 'w-full',
      options: contentTypeOptionsForChannel(selectedChannelType.value),
    }),
    fieldName: 'content_type',
    help: '钉钉通道支持文本、Markdown、链接卡片和按钮卡片；其它通道按 provider 的稳定能力限制选项。',
    label: '内容类型',
    rules: 'selectRequired',
  },
  {
    component: 'Input',
    componentProps: { maxlength: 2000 },
    dependencies: {
      show: (values) =>
        values.content_type === 'link' || values.content_type === 'action_card',
      triggerFields: ['content_type'],
    },
    fieldName: 'url',
    formItemClass: 'col-span-full',
    help: '链接卡片和按钮卡片点击后打开的 HTTPS 地址。',
    label: '跳转地址',
    rules: 'required',
  },
  {
    component: 'Input',
    componentProps: { maxlength: 2000 },
    dependencies: {
      show: (values) => values.content_type === 'link',
      triggerFields: ['content_type'],
    },
    fieldName: 'pic_url',
    formItemClass: 'col-span-full',
    help: '链接卡片右侧图片地址；群内提醒导致卡片转换为 Markdown 时该图片不会发送。',
    label: '卡片图片',
  },
  {
    component: 'Input',
    componentProps: { maxlength: 120, placeholder: '查看详情' },
    dependencies: {
      show: (values) => values.content_type === 'action_card',
      triggerFields: ['content_type'],
    },
    fieldName: 'single_title',
    help: '按钮卡片的操作文案，留空时使用“查看详情”。',
    label: '按钮文案',
  },
  {
    component: 'Input',
    componentProps: { maxlength: 2000 },
    dependencies: {
      show: () => selectedChannelType.value === 'push',
      triggerFields: ['channel_id'],
    },
    fieldName: 'img_url',
    formItemClass: 'col-span-full',
    help: 'Push 通知展示图片的 HTTPS 地址；业务跳转等自定义 data 填写在扩展参数中。',
    label: '推送图片',
  },
  {
    component: 'Textarea',
    componentProps: {
      autoSize: { maxRows: 12, minRows: 5 },
      maxlength: 20_000,
      showCount: true,
    },
    fieldName: 'content',
    formItemClass: 'col-span-full',
    help: '填写最终发送正文，不得包含 token、secret、Webhook 或其它凭据。',
    label: '消息内容',
    rules: 'required',
  },
  {
    component: 'DefaultButton',
    componentProps: () => ({
      block: true,
      onClick: toggleAdvanced,
    }),
    defaultValue: false,
    fieldName: 'advanced_open',
    formItemClass: 'col-span-full',
    hideLabel: true,
    renderComponentContent: () => ({
      default: () =>
        advancedOpen.value ? '收起高级参数' : '展开高级参数（可选）',
      icon: () =>
        h(ChevronDown, {
          class: advancedOpen.value ? 'rotate-180 transition-transform' : '',
        }),
    }),
  },
  {
    component: 'JsonEditor',
    componentProps: {
      maxHeight: '280px',
      minHeight: '140px',
      valueMode: 'text',
    },
    defaultValue: '{}',
    dependencies: {
      show: (values) => Boolean(values.advanced_open),
      triggerFields: ['advanced_open'],
    },
    fieldName: 'extension_payload',
    formItemClass: 'col-span-full',
    help: '仅用于 Push 自定义 data 或 provider 的未知业务键，通常保持 {}。不得填写 token、secret、Webhook；固定参数请使用上方字段。',
    label: '扩展参数',
    rules: 'required',
  },
];

const [Form, formApi] = useVbenForm<NotifyTestFormValues>({
  commonConfig: {
    colon: true,
    formItemClass: 'col-span-1',
    labelClass: 'whitespace-nowrap',
    labelWidth: 108,
  },
  layout: 'vertical',
  schema,
  showDefaultActions: false,
  wrapperClass: 'grid-cols-1 md:grid-cols-2 gap-x-5',
});

function defaultTargetKind(channel?: NotifyChannel): NotifyTestTargetKind {
  switch (channel?.channel_type) {
    case 'email':
    case 'sms': {
      return 'direct';
    }
    case 'push': {
      return 'recipient_endpoint';
    }
    default: {
      return 'channel_default';
    }
  }
}

function onTargetKindChange(value: NotifyTestTargetKind) {
  selectedTargetKind.value = value;
}

async function toggleAdvanced() {
  advancedOpen.value = !advancedOpen.value;
  await formApi.setFieldValue('advanced_open', advancedOpen.value);
}

async function onChannelChange(value?: number | string) {
  selectedChannelId.value = value;
  const channel = channelRows.value.find(
    (item) => String(item.id) === String(value),
  );
  const targetKind = defaultTargetKind(channel);
  selectedTargetKind.value = targetKind;
  await formApi.setValues({
    at_mobiles: '',
    at_user_ids: '',
    channel_id: value,
    content_type:
      contentTypeOptionsForChannel(channel?.channel_type)[0]?.value ?? 'text',
    endpoint_id: undefined,
    extension_payload: '{}',
    fallback_to_user_ids: false,
    img_url: '',
    is_at_all: false,
    pic_url: '',
    recipient: '',
    single_title: '',
    target_kind: targetKind,
    url: '',
  });
}

function splitTargets(value?: string) {
  return String(value ?? '')
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildTarget(values: NotifyTestFormValues): NotifyTestTarget {
  switch (values.target_kind) {
    case 'ding_talk_at': {
      const at_user_ids = splitTargets(values.at_user_ids);
      const at_mobiles = splitTargets(values.at_mobiles);
      const is_at_all = Boolean(values.is_at_all);
      if (!is_at_all && at_user_ids.length === 0 && at_mobiles.length === 0) {
        throw new Error('请填写钉钉提醒目标或开启提醒所有人');
      }
      return { at_mobiles, at_user_ids, is_at_all, kind: 'ding_talk_at' };
    }
    case 'direct': {
      const recipient = values.recipient?.trim();
      if (!recipient) throw new Error('请填写直接接收者');
      return { kind: 'direct', recipient };
    }
    case 'recipient_endpoint': {
      if (!values.endpoint_id) throw new Error('请选择目标端点');
      return {
        endpoint_id: values.endpoint_id,
        kind: 'recipient_endpoint',
      };
    }
    default: {
      return { kind: 'channel_default' };
    }
  }
}

function buildRequest(values: NotifyTestFormValues): NotifyTestMessageSend {
  const channel_id = values.channel_id;
  if (!channel_id) throw new Error('请选择消息通道');
  return {
    channel_id,
    content: values.content.trim(),
    content_type: values.content_type,
    payload: buildNotifyMessagePayload(
      values,
      selectedChannel.value?.channel_type,
      values.content_type,
    ),
    subject: values.subject.trim(),
    target: buildTarget(values),
  };
}

function readableTargets(value: JsonValue | undefined) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .filter((item) => !item.includes('*'));
}

async function hydrateMessage(row: NotifyMessage) {
  const channel = channelRows.value.find(
    (item) => String(item.id) === String(row.channel_id),
  );
  await onChannelChange(row.channel_id);
  const payload = editableNotifyPayloadObject(row.payload);
  const atUserIds = readableTargets(payload.at_userids ?? payload.at_user_ids);
  const atMobiles = readableTargets(payload.at_mobiles);
  const isAtAll = payload.is_at_all === true;
  const endpointId =
    typeof payload.endpoint_id === 'number' ||
    typeof payload.endpoint_id === 'string'
      ? payload.endpoint_id
      : undefined;
  const recipient =
    typeof payload.recipient === 'string' ? payload.recipient : '';
  let targetKind = defaultTargetKind(channel);
  if (
    ['dingtalk_custom_robot', 'dingtalk_group_bot'].includes(
      channel?.channel_type ?? '',
    ) &&
    (atUserIds.length > 0 || atMobiles.length > 0 || isAtAll)
  ) {
    targetKind = 'ding_talk_at';
  }
  selectedTargetKind.value = targetKind;
  await formApi.setValues({
    at_mobiles: atMobiles.join('\n'),
    at_user_ids: atUserIds.join('\n'),
    channel_id: row.channel_id,
    content: row.content,
    content_type: row.content_type,
    endpoint_id: endpointId,
    ...splitNotifyMessagePayload(row.payload),
    is_at_all: isAtAll,
    recipient,
    subject: row.subject,
    target_kind: targetKind,
  });
}

async function initializeForm(data: NotifyMessageTestModalData) {
  channelRows.value = data.channels;
  endpointRows.value = data.recipientEndpoints;
  sourceMessage.value = data.message;
  selectedChannelId.value = undefined;
  advancedOpen.value = false;
  sendError.value = '';
  await formApi.reset();
  if (data.message) {
    await hydrateMessage(data.message);
    return;
  }
  const first = data.channels[0];
  await onChannelChange(first?.id);
  await formApi.setValues({ content: '', subject: '' });
}

async function refreshOptions() {
  optionsLoading.value = true;
  try {
    const options = await NotifyTestApi.options();
    channelRows.value = options.channels;
    endpointRows.value = options.recipient_endpoints;
    message.success('通道和推送端点已刷新');
  } finally {
    optionsLoading.value = false;
  }
}

function openChannelManagement() {
  const href = router.resolve({ path: '/notify/channels' }).href;
  window.open(href, '_blank', 'noopener,noreferrer');
}

const [Modal, modalApi] = useVbenModal<NotifyMessageTestModalData>({
  destroyOnClose: false,
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) return;
    let payload: NotifyTestMessageSend;
    try {
      payload = buildRequest(await formApi.getValues());
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : '测试消息配置无效',
      );
      return;
    }
    sending.value = true;
    sendError.value = '';
    modalApi.lock();
    try {
      const result = await props.submit(payload);
      message.success(`测试消息 ${result.message_code} 已入队`);
      emit('success', result);
      modalApi.close();
    } catch (error) {
      sendError.value =
        error instanceof Error
          ? error.message
          : '发送失败，请检查消息通道配置后重试';
    } finally {
      sending.value = false;
      modalApi.unlock();
    }
  },
  async onOpenChange(isOpen) {
    if (!isOpen) return;
    const data = modalApi.getData();
    if (!data) {
      message.error('测试消息初始化数据缺失');
      modalApi.close();
      return;
    }
    modalApi.lock();
    try {
      await initializeForm(data);
    } finally {
      modalApi.unlock();
    }
  },
});

const modalTitle = computed(() =>
  sourceMessage.value ? '编辑并重发测试消息' : '发送测试消息',
);
</script>

<template>
  <Modal
    class="w-full max-w-260"
    :confirm-loading="sending"
    confirm-text="发送"
    :title="modalTitle"
  >
    <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
      <span class="text-xs text-gray-500">
        消息通道可在新页面维护；推送端点由 App/小程序上报，当前仅支持刷新。
      </span>
      <Space size="small">
        <Tooltip title="维护消息通道">
          <Button size="small" type="link" @click="openChannelManagement">
            <template #icon><ExternalLink /></template>
            维护通道
          </Button>
        </Tooltip>
        <Tooltip title="刷新通道和推送端点">
          <Button
            aria-label="刷新通道和推送端点"
            size="small"
            type="text"
            :loading="optionsLoading"
            @click="refreshOptions"
          >
            <template #icon><RotateCw /></template>
          </Button>
        </Tooltip>
      </Space>
    </div>
    <Alert
      v-if="
        selectedChannelType === 'dingtalk_custom_robot' &&
        selectedTargetKind === 'channel_default'
      "
      class="mb-3"
      message="本次只发送到机器人所在群，不会 @ 任何人"
      show-icon
      type="info"
    />
    <Alert
      v-if="sendError"
      class="mb-3"
      :message="sendError"
      show-icon
      type="error"
    />
    <Form class="max-h-[68vh] overflow-y-auto px-1 pr-3" />
  </Modal>
</template>
