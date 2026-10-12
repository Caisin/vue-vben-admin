<script setup lang="ts">
import type { Id } from '#/api/res/versions';
import type { DeliveryUploadJob } from '#/desktop/delivery';

import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { Alert, Button, Progress, Select } from 'antdv-next';

import { desktop } from '#/desktop';
import { nativeDelivery } from '#/desktop/delivery';
import { requestErrorMessage } from '#/request-errors';
const props = withDefaults(
  defineProps<{
    scope: Id;
    version: Id;
    kind: string;
    seq: number;
    disabled?: boolean;
    multiple?: boolean;
  }>(),
  { multiple: true },
);
const emit = defineEmits<{
  uploaded: [files: { file_id: number; name: string }[]];
  busy: [value: boolean];
}>();
const jobs = ref<DeliveryUploadJob[]>([]);
const job = ref<DeliveryUploadJob>();
const busy = ref(false);
const errorText = ref('');
let alive = true;
let initiatedHere = false;
let unlisten: (() => void) | undefined;
function matches(j: DeliveryUploadJob) {
  return (
    j.scope === Number(props.scope) &&
    j.version === Number(props.version) &&
    j.kind === props.kind &&
    j.seq === props.seq
  );
}
async function refresh() {
  if (!desktop) return;
  try {
    const list = await nativeDelivery.jobs();
    jobs.value = list.filter((j) => matches(j));
    if (!job.value) {
      const running = jobs.value.find((j) => j.status === '上传中');
      if (running) {
        job.value = running;
        busy.value = true;
        emit('busy', true);
      }
    }
  } catch (error) {
    errorText.value = requestErrorMessage(error, '无法读取原生上传任务');
  }
}
function publish(j: DeliveryUploadJob) {
  if (j.files.every((f) => f.file_id))
    emit(
      'uploaded',
      j.files.map((f) => ({ file_id: Number(f.file_id), name: f.name })),
    );
}
async function run() {
  if (!job.value || busy.value) return;
  busy.value = true;
  initiatedHere = true;
  emit('busy', true);
  errorText.value = '';
  try {
    const result = await nativeDelivery.run(job.value.id);
    if (alive && matches(result)) {
      job.value = result;
      publish(result);
    }
  } catch (error) {
    if (alive)
      errorText.value = requestErrorMessage(
        error,
        '上传未完成，可继续重试；已成功文件不会重传',
      );
  } finally {
    busy.value = false;
    initiatedHere = false;
    emit('busy', false);
    if (alive) await refresh();
  }
}
async function pick() {
  errorText.value = '';
  try {
    const result = await nativeDelivery.pick(
      Number(props.scope),
      Number(props.version),
      props.kind,
      props.seq,
      props.multiple !== false,
    );
    if (result && alive) {
      job.value = result;
      await run();
    }
  } catch (error) {
    errorText.value = requestErrorMessage(error, '选择文件失败');
  }
}
function reuse(id: string) {
  job.value = jobs.value.find((j) => j.id === id);
  if (job.value && (props.multiple !== false || job.value.files.length === 1))
    publish(job.value);
  else if (job.value) {
    errorText.value = '替换单集请选择只有一个视频的任务';
    job.value = undefined;
  }
}
watch(
  () => [props.scope, props.version, props.kind, props.seq],
  () => {
    job.value = undefined;
    errorText.value = '';
    void refresh();
  },
);
onMounted(async () => {
  if (!desktop) return;
  const stop = await nativeDelivery.listen((j) => {
    if (alive && matches(j) && (!job.value || j.id === job.value.id)) {
      job.value = j;
      busy.value = j.status === '上传中';
      emit('busy', busy.value);
      if (!busy.value && !initiatedHere) publish(j);
    }
  });
  if (alive) unlisten = stop;
  else stop();
  await refresh();
});
onBeforeUnmount(() => {
  alive = false;
  unlisten?.();
});
</script>
<template>
  <div class="native-transfer">
    <Alert
      v-if="!desktop"
      type="info"
      message="请在 Tauri 客户端打开此作品上传文件。网页可以维护文字、审核意见和交付清单。"
    />
    <template v-else>
      <div class="flex flex-wrap gap-2">
        <Button
          type="primary"
          :disabled="disabled || busy"
          @click="pick"
          v-access:code="'api:res.delivery.transfer.prepare'"
        >
          选择文件并上传
        </Button>
        <Button
          v-if="job && job.files.some((f) => !f.file_id)"
          :disabled="disabled || busy"
          @click="run"
          v-access:code="'api:res.delivery.transfer.prepare'"
        >
          继续 / 重试
        </Button>
        <Button v-if="busy" @click="nativeDelivery.pause()">暂停</Button>
      </div>
      <Select
        v-if="jobs.length"
        :value="job?.id"
        class="mt-3 w-full"
        :disabled="busy || disabled"
        placeholder="恢复上次上传 / 取回已完成文件"
        :options="
          jobs.map((j) => ({
            value: j.id,
            label: `${j.files[0]?.name} 等 ${j.files.length} 个文件 · ${j.status}`,
          }))
        "
        @update:value="reuse(String($event))"
      />
      <div v-if="job" class="mt-3">
        <p>{{ job.status }} · 上传完成后请提交材料，才会更新清单</p>
        <div
          v-for="(file, index) in job.files"
          :key="index"
          class="transfer-file"
        >
          <strong>{{ file.name }}</strong>
          <span>{{ file.status }}</span>
          <Progress
            :percent="
              file.file_id
                ? 100
                : Math.min(99, Math.round((file.bytes * 100) / file.size))
            "
          />
          <small v-if="file.error" class="text-red-600">{{ file.error }}</small>
        </div>
      </div>
    </template>
    <Alert v-if="errorText" type="error" :message="errorText" class="mt-3" />
  </div>
</template>
<style scoped>
.native-transfer {
  margin: 16px 0;
}

.transfer-file {
  padding: 12px;
  margin: 10px 0;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.transfer-file strong {
  display: block;
  overflow-wrap: anywhere;
}

.transfer-file span {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}
</style>
