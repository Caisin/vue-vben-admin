<script setup lang="ts">
import type {
  SoftwareLog,
  SoftwareStreamState,
} from '#/api/software/log-events';

import { nextTick, onScopeDispose, ref, watch } from 'vue';

import { Alert, Checkbox, Tag } from 'antdv-next';

import { watchSoftwareLogs } from '#/api/software/log-events';

const props = defineProps<{ operationId: number | string }>();
const emit = defineEmits<{ completed: []; state: [SoftwareStreamState] }>();
const logs = ref<SoftwareLog[]>([]);
const trimmed = ref(false);
const status = ref<SoftwareStreamState>();
const connectionError = ref('');
const follow = ref(true);
const output = ref<HTMLElement>();
let controller: AbortController | undefined;
let lastId = '0';

function pause(signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', finish);
      resolve();
    };
    const timer = setTimeout(finish, 1500);
    signal.addEventListener('abort', finish, { once: true });
    if (signal.aborted) finish();
  });
}
async function start(id: number | string) {
  controller?.abort();
  const current = new AbortController();
  controller = current;
  lastId = '0';
  logs.value = [];
  trimmed.value = false;
  status.value = undefined;
  connectionError.value = '';
  let terminal = false;
  while (!current.signal.aborted) {
    try {
      await watchSoftwareLogs(
        id,
        lastId,
        (log) => {
          if (current.signal.aborted || BigInt(log.id) <= BigInt(lastId))
            return;
          lastId = String(log.id);
          if (logs.value.length >= 256) trimmed.value = true;
          logs.value = [...logs.value, log].slice(-256);
          connectionError.value = '';
          void nextTick(() => {
            if (follow.value && output.value)
              output.value.scrollTop = output.value.scrollHeight;
          });
        },
        (state) => {
          if (current.signal.aborted) return;
          status.value = state;
          emit('state', state);
          connectionError.value = '';
          const ended = !['pending', 'running'].includes(state.state);
          if (ended && !terminal) {
            terminal = true;
            emit('completed');
          }
        },
        current.signal,
      );
    } catch (error) {
      if (!current.signal.aborted)
        connectionError.value =
          error instanceof Error ? error.message : '日志连接中断';
    }
    if (terminal || current.signal.aborted) break;
    await pause(current.signal);
  }
}
watch(
  () => props.operationId,
  (id) => {
    void start(id);
  },
  { immediate: true },
);
onScopeDispose(() => controller?.abort());
const labels: Record<string, string> = {
  pending: '等待执行',
  running: '执行中',
  succeeded: '成功',
  failed: '失败',
  cancelled: '已取消',
};
</script>
<template>
  <div class="min-w-0">
    <Tag v-if="trimmed" color="warning">仅显示最近 256 条日志</Tag>
    <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
      <span><Tag
          :color="
            status?.state === 'succeeded'
              ? 'success'
              : status?.state === 'failed'
                ? 'error'
                : 'processing'
          "
          >{{ labels[status?.state ?? 'pending'] ?? status?.state }}</Tag>步骤 {{ status?.step ?? 0 }} / {{ status?.total_steps ?? '-' }}</span>
      <Checkbox v-model:checked="follow">自动滚动</Checkbox>
    </div>
    <Alert
      v-if="connectionError || status?.error_summary"
      class="mb-3"
      type="error"
      show-icon
      :message="connectionError || status?.error_summary"
    />
    <div
      ref="output"
      class="log-output"
      aria-label="软件操作实时日志"
      role="log"
    >
      <div
        v-for="entry in logs"
        :key="entry.id"
        :class="{
          'log-error': entry.stream === 'stderr',
          'log-system': entry.stream === 'system',
        }"
      >
        <span class="log-prefix">[{{ entry.step }} {{ entry.stream }}]</span>
        {{ entry.content }}
      </div>
      <span v-if="!logs.length" class="text-muted-foreground">等待日志...</span>
    </div>
  </div>
</template>
<style scoped>
.log-output {
  height: 340px;
  max-height: 50dvh;
  padding: 12px;
  overflow: auto;
  font:
    12px/1.6 ui-monospace,
    monospace;
  color: #e5e7eb;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  background: #16191c;
  border: 1px solid hsl(var(--border));
  border-radius: 4px;
}

.log-prefix {
  color: #9ca3af;
}

.log-error {
  color: #fca5a5;
}

.log-system {
  color: #86efac;
}
</style>
