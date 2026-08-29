<script lang="ts" setup>
import type {
  MsgHealthStatus,
  MsgS2ConfigView,
  MsgS2ConfigWrite,
  MsgVoiceConfigView,
  MsgVoiceConfigWrite,
} from '#/api/msg';

import { computed, onMounted, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { Check } from '@vben/icons';

import {
  Alert,
  Button,
  Checkbox,
  Divider,
  Form,
  FormItem,
  Input,
  InputNumber,
  InputPassword,
  message,
  Select,
  Space,
  Switch,
  Tag,
  TextArea,
  Tooltip,
} from 'antdv-next';

import { DeviceApi, MsgConfigApi } from '#/api/msg';
import { StorageConfigApi } from '#/api/storage/config';

import PopupModal from './modules/popup-modal.vue';

const loading = ref(false);
const runtimeLoading = ref(false);
const s2Saving = ref(false);
const voiceSaving = ref(false);
const voiceSyncing = ref(false);
const voiceSyncOpen = ref(false);
const syncTtsEnabled = ref(false);
const syncTtsText = ref('');
const storageOptions = ref<Array<{ label: string; value: string }>>([]);

const s2 = reactive<MsgS2ConfigWrite>({
  clear_mqtt_password: false,
  device_command_topic: '{prefix}/S2/sub/{device_code}',
  device_response_topic: '{prefix}/S2/pub/#',
  enabled: false,
  mqtt_host: '127.0.0.1',
  mqtt_client_id: '',
  mqtt_password: '',
  mqtt_message_key: '',
  clear_mqtt_message_key: false,
  mqtt_port: 1883,
  mqtt_username: '',
  offline_after_secs: 300,
  refresh_interval_secs: 300,
  sms_receipt_timeout_secs: 120,
  sms_receipt_topics: [],
  sms_send_interval_secs: 15,
  topic_prefix: '',
});
const s2State = ref<MsgS2ConfigView>();
const runtimeState = ref<MsgHealthStatus>();

const voice = reactive<MsgVoiceConfigWrite>({
  access_key: '',
  clear_access_key: false,
  enabled: false,
  max_upload_bytes: 50 * 1024 * 1024,
  record_upload_url: '',
  storage_code: '',
});
const voiceState = ref<MsgVoiceConfigView>();
const receiptTopicsText = ref('');

const typedVoiceAccessKey = computed(() => voice.access_key.trim());
const deviceRecordUrl = computed(() =>
  buildDeviceRecordUrl(voice.record_upload_url, typedVoiceAccessKey.value),
);
const syncVoiceDisabledReason = computed(() => {
  if (!voiceState.value?.enabled) {
    return '请先启用并保存录音上传配置';
  }
  if (!voiceState.value.record_upload_url) {
    return '请先保存接听上传地址';
  }
  if (!voiceState.value.access_key_configured) {
    return '请先保存设备访问密钥';
  }
  if (
    voice.enabled !== voiceState.value.enabled ||
    voice.storage_code !== voiceState.value.storage_code ||
    voice.max_upload_bytes !== voiceState.value.max_upload_bytes ||
    voice.record_upload_url.trim() !== voiceState.value.record_upload_url
  ) {
    return '录音上传配置有未保存变更，请先保存后再同步';
  }
  if (!runtimeState.value?.runtime.running) {
    return '请先启动 MQTT 监听';
  }
  if (typedVoiceAccessKey.value || voice.clear_access_key) {
    return '当前密钥修改尚未保存，请先保存后再同步';
  }
  return '';
});
const canSyncVoiceForwardConfig = computed(
  () => syncVoiceDisabledReason.value.length === 0,
);

function applyS2(value: MsgS2ConfigView) {
  s2State.value = value;
  Object.assign(s2, {
    clear_mqtt_password: false,
    device_command_topic: value.device_command_topic,
    device_response_topic: value.device_response_topic,
    enabled: value.enabled,
    mqtt_host: value.mqtt_host,
    mqtt_client_id: value.mqtt_client_id,
    mqtt_password: '',
    mqtt_message_key: '',
    clear_mqtt_message_key: false,
    mqtt_port: value.mqtt_port,
    mqtt_username: value.mqtt_username,
    offline_after_secs: value.offline_after_secs,
    refresh_interval_secs: value.refresh_interval_secs,
    sms_receipt_timeout_secs: value.sms_receipt_timeout_secs,
    sms_receipt_topics: value.sms_receipt_topics,
    sms_send_interval_secs: value.sms_send_interval_secs,
    topic_prefix: value.topic_prefix,
  });
  receiptTopicsText.value = value.sms_receipt_topics.join('\n');
}

function applyVoice(value: MsgVoiceConfigView) {
  voiceState.value = value;
  Object.assign(voice, {
    access_key: '',
    clear_access_key: false,
    enabled: value.enabled,
    max_upload_bytes: value.max_upload_bytes,
    record_upload_url: value.record_upload_url,
    storage_code: value.storage_code,
  });
}

async function load() {
  loading.value = true;
  try {
    const [s2Config, voiceConfig, runtime, storages] = await Promise.all([
      MsgConfigApi.s2(),
      MsgConfigApi.voice(),
      MsgConfigApi.runtime(),
      StorageConfigApi.list({ page: 1, size: 100 }),
    ]);
    applyS2(s2Config);
    applyVoice(voiceConfig);
    runtimeState.value = runtime;
    storageOptions.value = storages.items.map((item) => ({
      label: `${item.storage_name} (${item.code})`,
      value: item.code,
    }));
  } finally {
    loading.value = false;
  }
}

async function saveS2() {
  s2Saving.value = true;
  try {
    const result = await MsgConfigApi.saveS2({
      ...s2,
      sms_receipt_topics: receiptTopicsText.value
        .split('\n')
        .map((topic) => topic.trim())
        .filter(Boolean),
    });
    applyS2(result);
    runtimeState.value = await MsgConfigApi.runtime();
    message.success(
      result.enabled
        ? 'S2 配置已保存；监听已启动时请关闭后重新开启以加载新配置'
        : 'S2 配置已保存，MQTT 监听已关闭',
    );
  } finally {
    s2Saving.value = false;
  }
}

async function refreshRuntime() {
  runtimeState.value = await MsgConfigApi.runtime();
}

async function toggleRuntime(checked: boolean) {
  if (checked && !s2State.value?.enabled) {
    message.warning('请先启用并保存 S2 与 MQTT 配置');
    return;
  }
  runtimeLoading.value = true;
  try {
    runtimeState.value = checked
      ? await MsgConfigApi.startRuntime()
      : await MsgConfigApi.stopRuntime();
    message.success(checked ? 'MQTT 监听已启动' : 'MQTT 监听已关闭');
  } finally {
    runtimeLoading.value = false;
  }
}

async function saveVoice() {
  voiceSaving.value = true;
  try {
    const result = await MsgConfigApi.saveVoice(voice);
    applyVoice(result);
    message.success('录音上传配置已保存');
  } finally {
    voiceSaving.value = false;
  }
}

function buildDeviceRecordUrl(uploadUrl: string, accessKey: string) {
  if (!uploadUrl.trim() || !accessKey.trim()) {
    return '';
  }
  try {
    const url = new URL(uploadUrl.trim());
    url.searchParams.delete('access_key');
    url.searchParams.delete('key');
    url.searchParams.set('key', accessKey.trim());
    return url.toString();
  } catch {
    return '';
  }
}

async function copyText(label: string, value: string) {
  const text = value.trim();
  if (!text) {
    message.warning(`${label}为空，无法复制`);
    return;
  }
  await navigator.clipboard.writeText(text);
  message.success(`${label}已复制`);
}

function generateVoiceAccessKey() {
  if (!globalThis.crypto?.getRandomValues) {
    message.error('当前浏览器不支持安全随机数生成');
    return;
  }
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  voice.access_key = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
  voice.clear_access_key = false;
  message.success('新访问密钥已生成，请保存后再同步到设备');
}

function openVoiceSync() {
  if (!canSyncVoiceForwardConfig.value) {
    message.warning(syncVoiceDisabledReason.value);
    return;
  }
  syncTtsEnabled.value = false;
  syncTtsText.value = '';
  voiceSyncOpen.value = true;
}

async function syncVoiceForwardConfig() {
  voiceSyncing.value = true;
  try {
    await DeviceApi.syncVoiceForwardConfig({
      device_codes: [],
      online_only: true,
      ...(syncTtsEnabled.value ? { tts_txt: syncTtsText.value } : {}),
    });
    voiceSyncOpen.value = false;
    message.success('转发配置同步后台任务已提交');
  } finally {
    voiceSyncing.value = false;
  }
}

onMounted(load);
</script>

<template>
  <Page auto-content-height>
    <PopupModal
      v-model:open="voiceSyncOpen"
      :confirm-loading="voiceSyncing"
      ok-text="同步"
      title="同步录音与 TTS 配置"
      @ok="syncVoiceForwardConfig"
    >
      <Checkbox v-model:checked="syncTtsEnabled">同步 TTS 文本</Checkbox>
      <FormItem class="sync-tts-field" label="TTS 语音文字">
        <TextArea
          v-model:value="syncTtsText"
          :auto-size="{ minRows: 3, maxRows: 8 }"
          :disabled="!syncTtsEnabled"
          ::maxlength="1000"
          show-count
        />
      </FormItem>
    </PopupModal>
    <div class="settings" :aria-busy="loading">
      <section>
        <div class="section-heading">
          <div>
            <h2>S2 与 MQTT</h2>
            <Space>
              <Tag :color="s2.enabled ? 'green' : 'default'">
                {{ s2.enabled ? '已启用' : '未启用' }}
              </Tag>
              <Tag
                :color="s2State?.mqtt_password_configured ? 'blue' : 'default'"
              >
                MQTT 密码{{
                  s2State?.mqtt_password_configured ? '已配置' : '未配置'
                }}
              </Tag>
              <Tag
                :color="
                  s2State?.mqtt_message_key_configured ? 'blue' : 'default'
                "
              >
                MQTT 消息密钥{{
                  s2State?.mqtt_message_key_configured ? '已配置' : '未配置'
                }}
              </Tag>
              <Tag
                :color="
                  s2State?.device_credential_key_configured ? 'blue' : 'default'
                "
              >
                设备凭据密钥{{
                  s2State?.device_credential_key_configured
                    ? '已生成'
                    : '未生成'
                }}
              </Tag>
              <Tag
                :color="
                  runtimeState?.runtime.running
                    ? runtimeState.runtime.healthy
                      ? 'green'
                      : 'orange'
                    : 'default'
                "
              >
                监听{{
                  runtimeState?.runtime.running
                    ? runtimeState.runtime.healthy
                      ? '已连接'
                      : '连接中'
                    : '已关闭'
                }}
              </Tag>
            </Space>
          </div>
          <Button
            v-access:code="'msg_settings:manage'"
            type="primary"
            :loading="s2Saving"
            @click="saveS2"
          >
            <Check class="size-4" />
            保存
          </Button>
        </div>

        <Alert
          message="MQTT 连接和订阅配置由下方监听开关控制；保存配置后关闭并重新开启监听即可加载新配置"
          show-icon
          type="info"
        />

        <div class="runtime-card">
          <div>
            <div class="runtime-title">MQTT 监听开关</div>
            <div class="runtime-reason">
              {{ runtimeState?.runtime.reason || '状态加载中' }}
            </div>
          </div>
          <Space>
            <Button :loading="runtimeLoading" @click="refreshRuntime">
              刷新状态
            </Button>
            <Switch
              v-access:code="'msg_settings:manage'"
              :checked="runtimeState?.runtime.running ?? false"
              :loading="runtimeLoading"
              checked-children="监听中"
              un-checked-children="已关闭"
              @change="toggleRuntime"
            />
          </Space>
        </div>

        <Form class="config-form" layout="vertical">
          <div class="form-grid">
            <FormItem label="启用 S2 同步">
              <Switch v-model:checked="s2.enabled" />
            </FormItem>
            <FormItem label="Topic 前缀" required>
              <Input v-model:value="s2.topic_prefix" placeholder="例如 kx" />
            </FormItem>
            <FormItem label="MQTT 主机" required>
              <Input v-model:value="s2.mqtt_host" />
            </FormItem>
            <FormItem label="MQTT 端口" required>
              <InputNumber v-model:value="s2.mqtt_port" :max="65535" :min="1" />
            </FormItem>
            <FormItem label="MQTT 客户端 ID">
              <Input
                v-model:value="s2.mqtt_client_id"
                autocomplete="off"
                placeholder="例如 kx-adm-msg-local；留空使用进程默认值"
              />
            </FormItem>
            <FormItem label="MQTT 用户名">
              <Input v-model:value="s2.mqtt_username" autocomplete="off" />
            </FormItem>
            <FormItem label="MQTT 密码">
              <InputPassword
                v-model:value="s2.mqtt_password"
                autocomplete="new-password"
                placeholder="留空保留现有密码"
              />
              <Checkbox
                v-model:checked="s2.clear_mqtt_password"
                class="clear-secret"
              >
                清除已保存密码
              </Checkbox>
            </FormItem>
            <FormItem label="MQTT 消息密钥">
              <InputPassword
                v-model:value="s2.mqtt_message_key"
                autocomplete="new-password"
                ::maxlength="16"
                placeholder="留空保留现有密钥；设备启用 MQTT 密钥时填 16 位数字字母"
              />
              <Checkbox
                v-model:checked="s2.clear_mqtt_message_key"
                class="clear-secret"
              >
                清除已保存消息密钥
              </Checkbox>
            </FormItem>
            <FormItem label="设备命令 Topic" required>
              <Input v-model:value="s2.device_command_topic" />
            </FormItem>
            <FormItem label="设备响应 Topic" required>
              <Input v-model:value="s2.device_response_topic" />
            </FormItem>
            <FormItem label="离线判定（秒）">
              <InputNumber v-model:value="s2.offline_after_secs" :min="10" />
            </FormItem>
            <FormItem label="周期刷新（秒）">
              <InputNumber v-model:value="s2.refresh_interval_secs" :min="5" />
            </FormItem>
            <FormItem label="短信回执超时（秒）">
              <InputNumber
                v-model:value="s2.sms_receipt_timeout_secs"
                :min="5"
              />
            </FormItem>
            <FormItem label="单设备短信间隔（秒）">
              <InputNumber v-model:value="s2.sms_send_interval_secs" :min="1" />
            </FormItem>
          </div>
          <FormItem label="短信回执 Topic">
            <TextArea
              v-model:value="receiptTopicsText"
              :auto-size="{ minRows: 2, maxRows: 6 }"
              placeholder="每行一个 Topic，可使用 {prefix}"
            />
          </FormItem>
        </Form>
      </section>

      <Divider />

      <section>
        <div class="section-heading">
          <div>
            <h2>录音上传</h2>
            <Tag
              :color="voiceState?.access_key_configured ? 'blue' : 'default'"
            >
              访问密钥{{
                voiceState?.access_key_configured ? '已配置' : '未配置'
              }}
            </Tag>
          </div>
          <Space>
            <Tooltip :title="syncVoiceDisabledReason || '同步到在线设备'">
              <Button
                v-access:code="'msg_settings:voice-forward-config'"
                :disabled="!canSyncVoiceForwardConfig"
                :loading="voiceSyncing"
                @click="openVoiceSync"
              >
                同步到所有设备
              </Button>
            </Tooltip>
            <Button
              v-access:code="'msg_settings:manage'"
              type="primary"
              :loading="voiceSaving"
              @click="saveVoice"
            >
              <Check class="size-4" />
              保存
            </Button>
          </Space>
        </div>

        <Form class="config-form" layout="vertical">
          <div class="form-grid">
            <FormItem label="启用录音上传">
              <Switch v-model:checked="voice.enabled" />
            </FormItem>
            <FormItem label="存储配置" required>
              <Select
                v-model:value="voice.storage_code"
                :options="storageOptions"
                placeholder="选择现有存储配置"
              />
            </FormItem>
            <FormItem label="最大上传字节数">
              <InputNumber
                v-model:value="voice.max_upload_bytes"
                :max="104857600"
                :min="1"
              />
            </FormItem>
            <FormItem class="form-grid-full" label="接听上传地址" required>
              <Input
                v-model:value="voice.record_upload_url"
                placeholder="例如 http://192.168.31.117/msg/voice/upload"
              />
              <Space class="field-actions" wrap>
                <Button
                  size="small"
                  @click="copyText('上传地址', voice.record_upload_url)"
                >
                  复制上传地址
                </Button>
                <Tooltip
                  :title="
                    deviceRecordUrl
                      ? '复制包含 ?key= 的设备侧地址'
                      : voiceState?.access_key_configured
                        ? '已保存密钥不会回显，请输入新密钥或生成后保存'
                        : '请先输入或生成设备访问密钥'
                  "
                >
                  <Button
                    :disabled="!deviceRecordUrl"
                    size="small"
                    @click="copyText('设备完整地址', deviceRecordUrl)"
                  >
                    复制设备完整地址
                  </Button>
                </Tooltip>
              </Space>
            </FormItem>
            <FormItem label="设备访问密钥" required>
              <InputPassword
                v-model:value="voice.access_key"
                autocomplete="new-password"
                placeholder="留空保留现有密钥"
              />
              <Checkbox
                v-model:checked="voice.clear_access_key"
                class="clear-secret"
              >
                清除已保存密钥
              </Checkbox>
              <Space class="field-actions" wrap>
                <Button
                  v-access:code="'msg_settings:manage'"
                  size="small"
                  @click="generateVoiceAccessKey"
                >
                  生成新密钥
                </Button>
                <Tooltip
                  :title="
                    typedVoiceAccessKey
                      ? '复制当前输入的密钥'
                      : voiceState?.access_key_configured
                        ? '已保存密钥不会回显，请输入新密钥或生成后保存'
                        : '当前没有可复制的密钥'
                  "
                >
                  <Button
                    v-access:code="'msg_settings:manage'"
                    :disabled="!typedVoiceAccessKey"
                    size="small"
                    @click="copyText('访问密钥', typedVoiceAccessKey)"
                  >
                    复制访问密钥
                  </Button>
                </Tooltip>
              </Space>
            </FormItem>
          </div>
        </Form>
      </section>
    </div>
  </Page>
</template>

<style scoped>
.settings {
  max-width: 1120px;
  padding: 8px 4px 32px;
  margin: 0 auto;
}

.section-heading {
  display: flex;
  gap: 24px;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 20px;
}

.section-heading h2 {
  margin: 0 0 8px;
  font-size: 18px;
  font-weight: 600;
  line-height: 28px;
}

.config-form {
  margin-top: 20px;
}

.runtime-card {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  margin-top: 16px;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.runtime-title {
  font-weight: 600;
}

.runtime-reason {
  margin-top: 4px;
  color: hsl(var(--muted-foreground));
  overflow-wrap: anywhere;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 24px;
}

.form-grid :deep(.ant-input-number),
.form-grid :deep(.ant-select) {
  width: 100%;
}

.form-grid-full {
  grid-column: 1 / -1;
}

.field-actions {
  margin-top: 8px;
}

.clear-secret {
  margin-top: 8px;
}

.sync-tts-field {
  margin-top: 16px;
}

@media (max-width: 768px) {
  .form-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .section-heading {
    flex-direction: column;
    align-items: stretch;
  }

  .runtime-card {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
