<script lang="ts" setup>
import type { NotifyChannelType } from '#/api';
import type { DingtalkAppOption } from '#/api/param/dingtalk-notify';

import { computed, onMounted, reactive, ref } from 'vue';

import {
  Alert,
  Button,
  Form,
  FormItem,
  Input,
  InputPassword,
  message,
  Select,
} from 'antdv-next';

import { CredentialApi } from '#/api/credential';
import { DingtalkNotifyApi } from '#/api/param/dingtalk-notify';
import { JsonFileInput } from '#/components/credential';

import { parseDingtalkWebhookConfig } from '../../dingtalk/webhook-config';

const props = defineProps<{ channelType: NotifyChannelType }>();
const emit = defineEmits<{ success: [providerCode: string] }>();

const saving = ref(false);
const appsLoading = ref(false);
const apps = ref<DingtalkAppOption[]>([]);
const firebaseForm = reactive({
  name: '',
  serviceAccountJson: '',
});
const customForm = reactive({
  keyword: '',
  name: '',
  openConversationId: '',
  robotCode: '',
  secret: '',
  webhookUrl: '',
});
const groupForm = reactive({
  appKey: '',
  botCode: '',
  name: '',
  openConversationId: '',
  robotCode: '',
});

const isFirebase = computed(() => props.channelType === 'push');
const isCustomRobot = computed(
  () => props.channelType === 'dingtalk_custom_robot',
);
const isGroupBot = computed(() => props.channelType === 'dingtalk_group_bot');
const appOptions = computed(() =>
  apps.value
    .filter((item) => item.enabled)
    .map((item) => ({
      label: `${item.app_name} (${item.app_key})`,
      value: item.app_key,
    })),
);

async function loadApps() {
  if (!isGroupBot.value) return;
  appsLoading.value = true;
  try {
    apps.value = await DingtalkNotifyApi.apps();
    groupForm.appKey =
      groupForm.appKey ||
      apps.value.find((item) => item.enabled && item.is_def)?.app_key ||
      apps.value.find((item) => item.enabled)?.app_key ||
      '';
  } finally {
    appsLoading.value = false;
  }
}

async function save() {
  saving.value = true;
  try {
    let providerCode: string;
    if (isFirebase.value) {
      const created = await CredentialApi.create({
        kind: 'google_service_account',
        name: firebaseForm.name.trim(),
        payload: {
          kind: 'google_service_account',
          service_account_json: firebaseForm.serviceAccountJson.trim(),
        },
        profile: 'firebase_fcm',
      });
      providerCode = created.code;
    } else if (isCustomRobot.value) {
      const parsed = parseDingtalkWebhookConfig(customForm.webhookUrl);
      const secret = customForm.secret.trim();
      if (secret && !secret.startsWith('SEC')) {
        throw new Error('钉钉加签密钥必须以 SEC 开头');
      }
      const created = await DingtalkNotifyApi.create_custom_robot({
        keyword: customForm.keyword.trim() || null,
        open_conversation_id: customForm.openConversationId.trim(),
        robot_code: customForm.robotCode.trim(),
        robot_name: customForm.name.trim(),
        secret,
        webhook_url: parsed.webhookUrl,
      });
      providerCode = created.robot_code;
    } else if (isGroupBot.value) {
      const created = await DingtalkNotifyApi.create_group_bot({
        app_key: groupForm.appKey.trim(),
        bot_code: groupForm.botCode.trim(),
        bot_name: groupForm.name.trim(),
        open_conversation_id: groupForm.openConversationId.trim(),
        robot_code: groupForm.robotCode.trim(),
      });
      providerCode = created.bot_code;
    } else {
      throw new Error('当前 Provider 仅支持在完整维护页面新增');
    }
    message.success('Provider 配置已新增');
    emit('success', providerCode);
  } catch (error) {
    message.error(error instanceof Error ? error.message : 'Provider 配置无效');
  } finally {
    saving.value = false;
  }
}

onMounted(loadApps);
</script>

<template>
  <Form layout="vertical">
    <template v-if="isFirebase">
      <FormItem label="显示名称" required>
        <Input
          v-model:value="firebaseForm.name"
          placeholder="例如生产环境 Firebase"
        />
      </FormItem>
      <FormItem label="Service Account JSON" required>
        <JsonFileInput
          v-model="firebaseForm.serviceAccountJson"
          :rows="10"
          placeholder="粘贴 JSON，或拖拽/选择 service-account.json"
        />
      </FormItem>
    </template>
    <template v-else-if="isCustomRobot">
      <FormItem label="配置编码" required>
        <Input v-model:value="customForm.robotCode" />
      </FormItem>
      <FormItem label="显示名称" required>
        <Input v-model:value="customForm.name" />
      </FormItem>
      <FormItem label="Webhook URL" required>
        <Input v-model:value="customForm.webhookUrl" />
      </FormItem>
      <FormItem label="加签密钥">
        <InputPassword v-model:value="customForm.secret" placeholder="SEC..." />
      </FormItem>
      <FormItem label="关键字">
        <Input v-model:value="customForm.keyword" />
      </FormItem>
      <FormItem label="群会话 ID">
        <Input v-model:value="customForm.openConversationId" />
      </FormItem>
    </template>
    <template v-else-if="isGroupBot">
      <FormItem label="配置编码" required>
        <Input v-model:value="groupForm.botCode" />
      </FormItem>
      <FormItem label="显示名称" required>
        <Input v-model:value="groupForm.name" />
      </FormItem>
      <FormItem label="钉钉应用" required>
        <Select
          v-model:value="groupForm.appKey"
          :loading="appsLoading"
          :options="appOptions"
        />
      </FormItem>
      <FormItem label="机器人编码" required>
        <Input v-model:value="groupForm.robotCode" />
      </FormItem>
      <FormItem label="群会话 ID" required>
        <Input v-model:value="groupForm.openConversationId" />
      </FormItem>
    </template>
    <Alert
      v-else
      message="当前 Provider 需要在完整维护页面配置"
      show-icon
      type="info"
    />
    <div v-if="isFirebase || isCustomRobot || isGroupBot" class="text-right">
      <Button :loading="saving" type="primary" @click="save">新增</Button>
    </div>
  </Form>
</template>
