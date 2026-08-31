<script lang="ts" setup>
import type {
  OcrMode,
  OcrProviderKind,
  OcrProviderSpec,
  OcrSettingsView,
} from '#/api/ocr';
import type { TaskRun } from '#/api/task';

import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';

import {
  Alert,
  Button,
  Card,
  Checkbox,
  Collapse,
  CollapsePanel,
  Form,
  FormItem,
  Input,
  InputNumber,
  message,
  Segmented,
  Select,
  Space,
  Tag,
} from 'antdv-next';

import { ocrAiCredentialKinds, OcrApi } from '#/api/ocr';
import { CredentialSelect } from '#/components/credential';
import { Times } from '#/times';

import {
  defaultOcrForm,
  defaultProviderForMode,
  formFromSettings,
  isTaskActive,
  modelStateColor,
  modelStateLabel,
  modeOptions,
  providerOptions,
  settingsPayload,
  validateOcrForm,
} from './data';

const router = useRouter();
const loading = ref(false);
const saving = ref(false);
const checking = ref(false);
const downloading = ref(false);
const providers = ref<OcrProviderSpec[]>([]);
const settings = ref<OcrSettingsView>();
const lastTask = ref<TaskRun>();
const form = reactive(defaultOcrForm());
const activeGuideKeys = ref<string[]>([]);

const localProviders = computed(() =>
  providerOptions(providers.value, 'local'),
);
const aiProviders = computed(() => providerOptions(providers.value, 'ai'));
const selectedAiProvider = computed(() =>
  providers.value.find((item) => item.kind === form.ai_provider),
);
const localProvider = computed(() =>
  providers.value.find((item) => item.kind === 'local_paddle'),
);
const localUnavailableReason = computed(() =>
  localProvider.value?.available === false
    ? localProvider.value.unavailable_reason || '本地 OCR 运行时不可用'
    : '',
);
const quickCreateCredentialKind = computed(() =>
  form.ai_provider === 'gemini_vision' ? 'http_header' : 'http_token',
);
const task = computed(() => lastTask.value);
const taskActive = computed(() => isTaskActive(task.value?.status));

async function load() {
  loading.value = true;
  try {
    const [providerList, currentSettings] = await Promise.all([
      OcrApi.providers(),
      OcrApi.settings(),
    ]);
    providers.value = providerList;
    settings.value = currentSettings;
    Object.assign(form, formFromSettings(currentSettings));
    ensureProviderForMode(form.mode);
  } finally {
    loading.value = false;
  }
}

function ensureProviderForMode(mode: OcrMode) {
  if (mode === 'ai' && !form.ai_provider) {
    form.ai_provider = aiProviders.value[0]?.value ?? '';
  }
}

function onModeChange(value: number | string) {
  form.mode = value as OcrMode;
  if (form.mode === 'ai') {
    form.ai_provider =
      defaultProviderForMode(providers.value, 'ai') ?? form.ai_provider;
    if (form.ai_provider) applyAiProviderSettings(form.ai_provider);
  }
  ensureProviderForMode(form.mode);
}

function onAiProviderChange(value: number | string) {
  form.ai_provider = value as OcrProviderKind;
  applyAiProviderSettings(form.ai_provider);
}

function applyAiProviderSettings(provider: OcrProviderKind) {
  if (provider === 'gemini_vision') {
    form.ai_base_url = settings.value?.gemini_base_url ?? form.ai_base_url;
    form.ai_model = settings.value?.gemini_model ?? form.ai_model;
    form.ai_credential_code =
      settings.value?.gemini_credential_code ?? form.ai_credential_code;
    return;
  }
  form.ai_base_url = settings.value?.openai_base_url ?? form.ai_base_url;
  form.ai_model = settings.value?.openai_model ?? form.ai_model;
  form.ai_credential_code =
    settings.value?.openai_credential_code ?? form.ai_credential_code;
}

async function saveCurrentSettings(silent = false) {
  const error = validateOcrForm(form, providers.value);
  if (error) {
    message.warning(error);
    return false;
  }
  saving.value = true;
  try {
    settings.value = await OcrApi.updateSettings(
      settingsPayload(form, settings.value),
    );
    Object.assign(form, formFromSettings(settings.value));
    if (!silent) message.success('OCR 配置已保存');
    return true;
  } finally {
    saving.value = false;
  }
}

async function save() {
  await saveCurrentSettings();
}

async function checkModels() {
  if (!form.local_model_dir.trim()) {
    message.warning('请先填写本地模型目录');
    return;
  }
  if (!(await saveCurrentSettings(true))) return;
  checking.value = true;
  try {
    const modelStatus = await OcrApi.checkModels();
    if (settings.value) {
      settings.value = { ...settings.value, model_status: modelStatus };
    }
    message.success('模型状态已刷新');
  } finally {
    checking.value = false;
  }
}

async function downloadModels() {
  if (!form.local_model_dir.trim()) {
    message.warning('请先填写本地模型目录');
    return;
  }
  if (!(await saveCurrentSettings(true))) return;
  downloading.value = true;
  try {
    lastTask.value = await OcrApi.downloadModels();
    message.success('模型下载任务已创建');
  } finally {
    downloading.value = false;
  }
}

async function openTaskDetail() {
  if (!task.value?.id) return;
  await router.push(`/system/tasks?run_id=${task.value.id}`);
}

function taskStatusColor(status?: string) {
  if (status === 'succeeded') return 'success';
  if (status === 'failed' || status === 'cancelled') return 'error';
  if (isTaskActive(status)) return 'processing';
  return 'default';
}

onMounted(load);
</script>

<template>
  <Page auto-content-height class="ocr-page" content-class="ocr-content">
    <header class="ocr-header">
      <h1>图片 OCR</h1>
      <Space wrap>
        <Button :loading="saving" type="primary" @click="save">保存配置</Button>
      </Space>
    </header>

    <section class="ocr-status-row">
      <Tag color="processing">
        当前 Provider：{{
          form.mode === 'local'
            ? localProviders[0]?.label || '本地 Paddle OCR'
            : selectedAiProvider?.label || '未选择'
        }}
      </Tag>
      <Tag :color="modelStateColor(settings?.model_status.state)">
        模型状态：{{ modelStateLabel(settings?.model_status.state) }}
      </Tag>
      <Tag>
        版本：{{
          settings?.model_status.version || settings?.model_version || '-'
        }}
      </Tag>
    </section>

    <Card :loading="loading" class="ocr-card">
      <Segmented
        :options="modeOptions()"
        :value="form.mode"
        @change="onModeChange"
      />

      <Form layout="vertical" class="ocr-form">
        <section class="ocr-section">
          <div class="section-title">
            <h2>启用策略</h2>
            <Tag :color="form.enabled ? 'success' : 'default'">
              {{ form.enabled ? '已启用' : '未启用' }}
            </Tag>
          </div>
          <Checkbox v-model:checked="form.enabled"> 启用图片 OCR </Checkbox>
        </section>

        <section v-if="form.mode === 'local'" class="ocr-section">
          <div class="section-title">
            <h2>本地模型</h2>
            <Space wrap>
              <Tag :color="modelStateColor(settings?.model_status.state)">
                {{ modelStateLabel(settings?.model_status.state) }}
              </Tag>
              <Tag
                :color="settings?.model_status.ready ? 'success' : 'warning'"
              >
                {{ settings?.model_status.message || '模型状态未知' }}
              </Tag>
            </Space>
          </div>
          <Alert
            v-if="localUnavailableReason"
            show-icon
            type="warning"
            :message="localUnavailableReason"
          />
          <div class="form-grid">
            <FormItem label="模型版本">
              <Input
                :value="
                  settings?.model_version ||
                  settings?.model_status.version ||
                  '-'
                "
                disabled
              />
            </FormItem>
            <FormItem label="超时时间（秒）">
              <InputNumber
                v-model:value="form.timeout_seconds"
                class="w-full"
                :max="600"
                :min="5"
              />
            </FormItem>
            <FormItem class="wide" label="模型目录" required>
              <Input
                v-model:value="form.local_model_dir"
                placeholder="服务端运行环境中的模型目录，例如 /data/kx/ocr/models"
              />
            </FormItem>
          </div>
          <Space wrap>
            <Button
              :disabled="taskActive"
              :loading="downloading"
              type="primary"
              @click="downloadModels"
            >
              {{
                settings?.model_status.ready
                  ? '保存并更新模型'
                  : '保存并下载模型'
              }}
            </Button>
            <Button :loading="checking" @click="checkModels">
              保存并重新检测
            </Button>
          </Space>
        </section>

        <section v-else class="ocr-section">
          <div class="section-title">
            <h2>AI 大模型</h2>
            <Tag :color="selectedAiProvider ? 'processing' : 'warning'">
              {{ selectedAiProvider?.label || '未选择 Provider' }}
            </Tag>
          </div>
          <div class="form-grid">
            <FormItem label="Provider" required>
              <Select
                v-model:value="form.ai_provider"
                class="w-full"
                :options="aiProviders"
                @change="onAiProviderChange"
              />
            </FormItem>
            <FormItem label="模型" required>
              <Input
                v-model:value="form.ai_model"
                placeholder="例如 gpt-4o-mini"
              />
            </FormItem>
            <FormItem class="wide" label="API 地址">
              <Input
                v-model:value="form.ai_base_url"
                placeholder="由 Provider 决定；兼容 OpenAI 风格时填写 base URL"
              />
            </FormItem>
            <FormItem class="wide" label="访问凭证" required>
              <CredentialSelect
                v-model="form.ai_credential_code"
                :create-kind="quickCreateCredentialKind"
                :kinds="ocrAiCredentialKinds"
                placeholder="选择 OCR Provider 凭证"
              />
            </FormItem>
            <FormItem label="超时时间（秒）">
              <InputNumber
                v-model:value="form.timeout_seconds"
                class="w-full"
                :max="600"
                :min="5"
              />
            </FormItem>
          </div>
        </section>
      </Form>
    </Card>

    <Card v-if="task" size="small" class="task-card">
      <template #title>模型下载任务</template>
      <Space wrap>
        <Tag :color="taskStatusColor(task.status)">{{ task.status }}</Tag>
        <span>{{ task.message || task.executor_code }}</span>
        <span>成功 {{ task.succeeded_count }}</span>
        <span>失败 {{ task.failed_count }}</span>
        <span>更新 {{ Times.formatOptionalUnix(task.updated_at) }}</span>
        <Button size="small" type="link" @click="openTaskDetail">
          查看任务详情
        </Button>
      </Space>
    </Card>

    <Collapse v-model:active-key="activeGuideKeys" class="guide-collapse">
      <CollapsePanel key="guide" header="配置说明">
        <ul>
          <li>
            模型目录是后端服务所在服务器的本地路径，不是浏览器所在电脑路径。
          </li>
          <li>本地模型下载会创建异步任务；任务进度在任务中心查看。</li>
          <li>
            AI 大模型凭证只保存凭证中心编码，页面不会展示 token 或 secret。
          </li>
        </ul>
      </CollapsePanel>
    </Collapse>
  </Page>
</template>

<style scoped>
.ocr-page {
  min-height: 0;
}

.ocr-page :deep(.ocr-content) {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
}

.ocr-header,
.section-title {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}

.ocr-header h1,
.section-title h2 {
  margin: 0;
  font-weight: 600;
}

.ocr-header h1 {
  font-size: 22px;
}

.section-title h2 {
  font-size: 16px;
}

.ocr-card {
  flex: 0 0 auto;
  min-height: 0;
}

.ocr-form {
  display: flex;
  flex-direction: column;
  gap: 18px;
  margin-top: 16px;
}

.ocr-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-top: 4px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 16px;
}

.wide {
  grid-column: 1 / -1;
}

.task-card {
  flex: 0 0 auto;
}

.guide-collapse {
  flex: 0 0 auto;
}

@media (max-width: 720px) {
  .ocr-header,
  .section-title {
    flex-direction: column;
    align-items: flex-start;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }

  .wide {
    grid-column: auto;
  }
}
</style>
