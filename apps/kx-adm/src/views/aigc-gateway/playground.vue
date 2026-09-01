<script setup lang="ts">
import type { GatewayMediaJob, ModelRoute } from '#/api/aigc-gateway';

import { computed, onUnmounted, ref, watch } from 'vue';

import { IconifyIcon } from '@vben/icons';

import {
  Button,
  Empty,
  InputNumber,
  message,
  Segmented,
  Select,
  Slider,
  Spin,
  Tag,
  TextArea,
} from 'antdv-next';

import { AigcGatewayApi } from '#/api/aigc-gateway';

const props = defineProps<{ models: ModelRoute[] }>();

type Mode = 'chat' | 'image' | 'video';
interface ChatMessage {
  content: string;
  role: 'assistant' | 'user';
}

const mode = ref<Mode>('chat');
const model = ref<string>();
const prompt = ref('');
const instructions = ref('');
const temperature = ref(0.7);
const imageSize = ref('1024x1024');
const imageCount = ref(1);
const videoSize = ref('1280x720');
const videoSeconds = ref(5);
const videoAspectRatio = ref('16:9');
const videoImageUrls = ref('');
const sending = ref(false);
const messages = ref<ChatMessage[]>([]);
const mediaJob = ref<GatewayMediaJob>();
let pollTimer: ReturnType<typeof setTimeout> | undefined;

const modelOptions = computed(() =>
  [
    ...new Set(
      props.models
        .filter((item) => {
          const capabilities =
            item.capabilities ??
            (item.upstream_model.startsWith('jimeng_') ? ['video'] : ['chat']);
          return capabilities.includes(mode.value);
        })
        .map((item) => item.canonical_model),
    ),
  ].map((value) => ({ label: value, value })),
);
const mediaUrls = computed(() => extractMediaUrls(mediaJob.value?.result));
const selectedRoute = computed(() =>
  props.models.find((item) => item.canonical_model === model.value),
);
const isJimengVideo = computed(() =>
  selectedRoute.value?.upstream_model.startsWith('jimeng_'),
);
const isJimengImageVideo = computed(() =>
  selectedRoute.value?.upstream_model.includes('_i2v_'),
);

function ensureModel() {
  const value = model.value ?? modelOptions.value[0]?.value;
  if (!value) message.warning('请先配置可用模型');
  model.value = value;
  return value;
}

async function sendChat() {
  const text = prompt.value.trim();
  const selectedModel = ensureModel();
  if (!text || !selectedModel || sending.value) return;
  messages.value.push({ content: text, role: 'user' });
  prompt.value = '';
  sending.value = true;
  try {
    const result = await AigcGatewayApi.playgroundChat({
      input: text,
      instructions: instructions.value.trim(),
      model: selectedModel,
      temperature: temperature.value,
    });
    messages.value.push({
      content: responseText(result) || JSON.stringify(result, null, 2),
      role: 'assistant',
    });
  } finally {
    sending.value = false;
  }
}

async function generateMedia() {
  const text = prompt.value.trim();
  const selectedModel = ensureModel();
  if (!text || !selectedModel || sending.value || mode.value === 'chat') return;
  sending.value = true;
  mediaJob.value = undefined;
  try {
    const isImage = mode.value === 'image';
    const dispatch = await AigcGatewayApi.playgroundMedia({
      media_type: mode.value,
      model: selectedModel,
      path: isImage ? '/v1/images/generations' : '/v1/videos',
      request: isImage
        ? {
            model: selectedModel,
            n: imageCount.value,
            prompt: text,
            size: imageSize.value,
          }
        : {
            aspect_ratio: videoAspectRatio.value,
            image_urls: videoImageUrls.value
              .split('\n')
              .map((value) => value.trim())
              .filter(Boolean),
            model: selectedModel,
            prompt: text,
            seconds: videoSeconds.value,
            size: videoSize.value,
          },
    });
    await pollMedia(dispatch.id);
  } finally {
    sending.value = false;
  }
}

async function pollMedia(id: number | string) {
  clearTimeout(pollTimer);
  try {
    const job = await AigcGatewayApi.mediaJob(id);
    mediaJob.value = job;
    if (job.state === 'pending' || job.state === 'running') {
      pollTimer = setTimeout(() => void pollMedia(id), 1500);
    }
  } catch {
    clearTimeout(pollTimer);
  }
}

function responseText(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const record = value as Record<string, unknown>;
  if (typeof record.output_text === 'string') return record.output_text;
  if (typeof record.text === 'string') return record.text;
  if (typeof record.content === 'string') return record.content;
  if (record.message) {
    const message = responseText(record.message);
    if (message) return message;
  }
  for (const key of ['output', 'content', 'choices', 'candidates', 'parts']) {
    const items = record[key];
    if (Array.isArray(items)) {
      const text = items
        .map((item) => responseText(item))
        .filter(Boolean)
        .join('\n');
      if (text) return text;
    }
  }
  return '';
}

function extractMediaUrls(value: unknown): string[] {
  const urls = new Set<string>();
  const visit = (item: unknown) => {
    if (typeof item === 'string') {
      if (/^(data:|https?:\/\/)/.test(item)) urls.add(item);
      else if (item.trim().startsWith('{') || item.trim().startsWith('[')) {
        try {
          visit(JSON.parse(item));
        } catch {
          // 非 JSON 字符串不属于媒体地址。
        }
      }
      return;
    }
    if (Array.isArray(item)) {
      item.forEach((child) => visit(child));
      return;
    }
    if (!item || typeof item !== 'object') return;
    for (const [key, child] of Object.entries(item)) {
      if (key === 'b64_json' && typeof child === 'string') {
        urls.add(`data:image/png;base64,${child}`);
      } else {
        visit(child);
      }
    }
  };
  visit(value);
  return [...urls];
}

onUnmounted(() => clearTimeout(pollTimer));
watch(mode, () => {
  if (!modelOptions.value.some((item) => item.value === model.value)) {
    model.value = undefined;
  }
  mediaJob.value = undefined;
});
</script>

<template>
  <section class="playground">
    <aside class="playground-settings">
      <Segmented
        v-model:value="mode"
        block
        :options="[
          { label: '对话', value: 'chat' },
          { label: '生图', value: 'image' },
          { label: '生视频', value: 'video' },
        ]"
      />
      <label>
        <span>模型</span>
        <Select
          v-model:value="model"
          class="w-full"
          show-search
          :options="modelOptions"
          placeholder="选择模型"
        />
      </label>
      <template v-if="mode === 'chat'">
        <label>
          <span>系统指令</span>
          <TextArea
            v-model:value="instructions"
            :auto-size="{ minRows: 3, maxRows: 8 }"
            placeholder="可选"
          />
        </label>
        <label>
          <span>Temperature {{ temperature.toFixed(1) }}</span>
          <Slider v-model:value="temperature" :max="2" :step="0.1" />
        </label>
      </template>
      <template v-else-if="mode === 'image'">
        <label>
          <span>尺寸</span>
          <Select
            v-model:value="imageSize"
            :options="[
              { label: '正方形 1024 × 1024', value: '1024x1024' },
              { label: '横向 1536 × 1024', value: '1536x1024' },
              { label: '纵向 1024 × 1536', value: '1024x1536' },
            ]"
          />
        </label>
        <label>
          <span>数量</span>
          <InputNumber v-model:value="imageCount" :min="1" :max="4" />
        </label>
      </template>
      <template v-else>
        <label>
          <span>{{ isJimengVideo ? '画面比例' : '尺寸' }}</span>
          <Select
            v-if="isJimengVideo"
            v-model:value="videoAspectRatio"
            :options="
              ['16:9', '9:16', '1:1', '4:3', '3:4'].map((value) => ({
                label: value,
                value,
              }))
            "
          />
          <Select
            v-else
            v-model:value="videoSize"
            :options="[
              { label: '横屏 16:9', value: '1280x720' },
              { label: '竖屏 9:16', value: '720x1280' },
              { label: '正方形 1:1', value: '1024x1024' },
            ]"
          />
        </label>
        <label>
          <span>时长</span>
          <Select
            v-model:value="videoSeconds"
            :options="
              [4, 5, 8, 10].map((value) => ({ label: `${value} 秒`, value }))
            "
          />
        </label>
        <label v-if="isJimengImageVideo" class="setting-wide">
          <span>参考图片 URL</span>
          <TextArea
            v-model:value="videoImageUrls"
            :auto-size="{ minRows: 2, maxRows: 5 }"
            placeholder="每行一个图片 URL"
          />
        </label>
      </template>
    </aside>

    <div class="playground-stage">
      <div v-if="mode === 'chat'" class="conversation">
        <Empty v-if="messages.length === 0" description="暂无对话" />
        <div
          v-for="(item, index) in messages"
          :key="index"
          class="message"
          :class="item.role"
        >
          <span>{{ item.role === 'user' ? '我' : 'AI' }}</span>
          <pre>{{ item.content }}</pre>
        </div>
        <div v-if="sending" class="message assistant">
          <Spin size="small" />
        </div>
      </div>
      <div v-else class="media-result">
        <Empty v-if="!mediaJob" description="暂无生成结果" />
        <template v-else>
          <div class="media-status">
            <Tag
              :color="
                mediaJob.state === 'succeeded'
                  ? 'success'
                  : mediaJob.state === 'failed'
                    ? 'error'
                    : 'processing'
              "
            >
              {{ mediaJob.state }}
            </Tag>
            <span v-if="mediaJob.error_message">{{
              mediaJob.error_message
            }}</span>
          </div>
          <div v-if="mediaUrls.length" class="media-grid">
            <template v-for="url in mediaUrls" :key="url">
              <video v-if="mode === 'video'" controls :src="url"></video>
              <img v-else :src="url" alt="生成图片" />
            </template>
          </div>
          <pre v-else-if="mediaJob.state === 'succeeded'" class="raw-result">{{
            JSON.stringify(mediaJob.result, null, 2)
          }}</pre>
        </template>
      </div>

      <footer class="composer">
        <TextArea
          v-model:value="prompt"
          :auto-size="{ minRows: 2, maxRows: 6 }"
          :placeholder="mode === 'chat' ? '输入消息' : '描述希望生成的内容'"
          @keydown.meta.enter.prevent="
            mode === 'chat' ? sendChat() : generateMedia()
          "
          @keydown.ctrl.enter.prevent="
            mode === 'chat' ? sendChat() : generateMedia()
          "
        />
        <Button
          type="primary"
          :loading="sending"
          :disabled="!prompt.trim()"
          @click="mode === 'chat' ? sendChat() : generateMedia()"
        >
          <template #icon>
            <IconifyIcon v-if="mode === 'chat'" icon="lucide:send" />
            <IconifyIcon v-else-if="mode === 'image'" icon="lucide:image" />
            <IconifyIcon v-else icon="lucide:video" />
          </template>
          {{ mode === 'chat' ? '发送' : '生成' }}
        </Button>
      </footer>
    </div>
  </section>
</template>

<style scoped>
.playground {
  display: grid;
  grid-template-columns: minmax(220px, 280px) minmax(0, 1fr);
  min-height: 600px;
  border: 1px solid var(--vben-border-color);
}

.playground-settings {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 18px;
  border-right: 1px solid var(--vben-border-color);
}

.playground-settings label {
  display: grid;
  gap: 8px;
  font-size: 13px;
  font-weight: 500;
}

.setting-wide {
  grid-column: 1 / -1;
}

.playground-stage {
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  min-width: 0;
}

.conversation,
.media-result {
  min-height: 0;
  padding: 24px;
  overflow: auto;
}

.conversation {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.message {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr);
  gap: 10px;
  max-width: 84%;
}

.message.user {
  align-self: flex-end;
}

.message > span {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  font-size: 12px;
  background: var(--vben-bg-color-deep);
  border-radius: 50%;
}

.message pre,
.raw-result {
  padding: 12px 14px;
  margin: 0;
  font-family: inherit;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  border: 1px solid var(--vben-border-color);
  border-radius: 6px;
}

.message.user pre {
  background: color-mix(in srgb, var(--vben-primary) 14%, transparent);
}

.composer {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: end;
  padding: 16px;
  border-top: 1px solid var(--vben-border-color);
}

.media-status {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 16px;
}

.media-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}

.media-grid img,
.media-grid video {
  width: 100%;
  max-height: 520px;
  object-fit: contain;
  background: #111;
}

@media (max-width: 900px) {
  .playground {
    grid-template-columns: 1fr;
  }

  .playground-settings {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    border-right: 0;
    border-bottom: 1px solid var(--vben-border-color);
  }

  .playground-settings > :first-child {
    grid-column: 1 / -1;
  }

  .message {
    max-width: 100%;
  }
}
</style>
