<script setup lang="ts">
import type { Id } from '#/api/res/versions';
import type { DeliveryUploadJob } from '#/desktop/delivery';

import { computed, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue';

import {
  Alert,
  Button,
  InputNumber,
  Progress,
  Select,
  Table,
} from 'antdv-next';

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
    autoPickDirectory?: boolean;
  }>(),
  { multiple: true },
);
const emit = defineEmits<{
  uploaded: [files: { file_id: number; name: string }[]];
  busy: [value: boolean];
  cleared: [];
  excluded: [fileId: number];
}>();
const jobs = ref<DeliveryUploadJob[]>([]);
const job = ref<DeliveryUploadJob>();
const busy = ref(false);
const selecting = ref(false);
const errorText = ref('');
const saving = ref(false);
const concurrencyId = useId();
const concurrency = ref(3);
const included = ref<number[]>([]);
const files = computed(() =>
  (job.value?.files ?? [])
    .map((file, index) => ({ ...file, index }))
    .filter((file) => included.value.includes(file.index)),
);
const locked = computed(
  () => busy.value || selecting.value || saving.value || !!props.disabled,
);
const summary = computed(() => {
  const total = files.value.reduce((sum, file) => sum + file.size, 0);
  const sent = files.value.reduce(
    (sum, file) => sum + Math.min(file.bytes, file.size),
    0,
  );
  return {
    percent: total ? Math.floor((sent * 100) / total) : 0,
    completed: files.value.filter((file) => file.file_id).length,
    failed: files.value.filter((file) => file.error).length,
  };
});
function setJob(value: DeliveryUploadJob) {
  job.value = value;
  const index = jobs.value.findIndex((row) => row.id === value.id);
  if (index === -1) jobs.value.unshift(value);
  else jobs.value[index] = value;
  concurrency.value = value.concurrency ?? 3;
  included.value = value.files.map((_, index) => index);
}
function removeFile(index: number) {
  if (locked.value) return;
  included.value = included.value.filter((i) => i !== index);
  const fileId = job.value?.files[index]?.file_id;
  if (fileId) emit('excluded', fileId);
  emit('cleared');
}
async function saveList() {
  if (!job.value || locked.value || included.value.length === 0) return;
  saving.value = true;
  emit('busy', true);
  errorText.value = '';
  try {
    const updated = await nativeDelivery.update(
      job.value.id,
      job.value.revision ?? 0,
      [...included.value],
      concurrency.value,
    );
    if (alive) {
      setJob(updated);
      return updated;
    }
  } catch (error) {
    errorText.value = requestErrorMessage(error, '保存上传清单失败');
  } finally {
    saving.value = false;
    emit('busy', false);
  }
}

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
async function refresh(syncCurrent = false) {
  if (!desktop) return;
  try {
    const list = await nativeDelivery.jobs();
    jobs.value = list.filter((j) => matches(j));
    if (syncCurrent && job.value) {
      const latest = jobs.value.find((j) => j.id === job.value?.id);
      if (latest) setJob(latest);
    }
    if (!job.value) {
      const running = jobs.value.find((j) => j.status === '上传中');
      if (running) {
        setJob(running);
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
      j.files.map((f) => ({
        file_id: Number(f.file_id),
        name: f.relative_path || f.name,
      })),
    );
}
async function run() {
  if (!job.value || locked.value) return;
  const confirmed = await saveList();
  if (!confirmed) return;
  busy.value = true;
  initiatedHere = true;
  emit('busy', true);
  errorText.value = '';
  try {
    const result = await nativeDelivery.run(confirmed.id, confirmed.revision);
    if (alive && matches(result)) {
      setJob(result);
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
    if (alive) await refresh(true);
  }
}
async function pick(directory = false) {
  if (!desktop || props.disabled || busy.value || selecting.value) return;
  selecting.value = true;
  emit('busy', true);
  errorText.value = '';
  try {
    const result = await nativeDelivery.pick(
      Number(props.scope),
      Number(props.version),
      props.kind,
      props.seq,
      props.multiple !== false,
      directory,
    );
    if (result && alive) {
      setJob(result);
      emit('cleared');
    }
  } catch (error) {
    errorText.value = requestErrorMessage(error, '选择文件失败');
  } finally {
    selecting.value = false;
    emit('busy', busy.value);
  }
}

function reuse(id: string) {
  const selected = jobs.value.find((j) => j.id === id);
  if (!selected) return;
  if (props.multiple === false && selected.files.length !== 1) {
    errorText.value = '替换单集请选择只有一个视频的任务';
    return;
  }
  setJob(selected);
  emit('cleared');
}
async function useCompleted() {
  const confirmed = await saveList();
  if (confirmed) publish(confirmed);
}
watch(
  () => [props.scope, props.version, props.kind, props.seq],
  () => {
    job.value = undefined;
    included.value = [];
    errorText.value = '';
    void refresh();
  },
);
onMounted(async () => {
  if (!desktop) return;
  const stop = await nativeDelivery.listen((j) => {
    if (alive && matches(j) && (!job.value || j.id === job.value.id)) {
      if (job.value) job.value = j;
      else setJob(j);
      busy.value = j.status === '上传中';
      emit('busy', busy.value);
      if (!busy.value && !initiatedHere) publish(j);
    }
  });
  if (alive) unlisten = stop;
  else stop();
  await refresh();
  if (alive && props.autoPickDirectory) await pick(true);
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
          :disabled="locked"
          @click="pick(false)"
          v-access:code="'api:res.delivery.transfer.prepare'"
        >
          选择文件并扫描
        </Button>
        <Button
          v-if="multiple"
          :disabled="locked"
          @click="pick(true)"
          v-access:code="'api:res.delivery.transfer.prepare'"
        >
          选择目录并扫描
        </Button>
        <Button
          v-if="job && job.files.some((f) => !f.file_id)"
          :disabled="locked || included.length === 0"
          @click="run"
          v-access:code="'api:res.delivery.transfer.prepare'"
        >
          {{
            job.files.some((f) => f.file_id || f.error)
              ? '继续 / 重试'
              : '确认清单并上传'
          }}
        </Button>
        <Button v-if="busy" @click="nativeDelivery.pause()">暂停</Button>
        <Button :disabled="locked" @click="refresh(true)">刷新任务</Button>
      </div>
      <Select
        v-if="jobs.length"
        :value="job?.id"
        class="mt-3 w-full"
        :disabled="locked"
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
        <Alert
          type="info"
          message="扫描完成后核对清单，移除不需要的文件并设置并发，再确认上传。移除只影响本任务，不删除本地或服务器文件。"
          class="mb-3"
        />
        <div class="mb-3 flex flex-wrap items-center gap-3">
          <label :for="concurrencyId">同时上传文件数</label>
          <InputNumber
            :id="concurrencyId"
            v-model:value="concurrency"
            :min="1"
            :max="8"
            :precision="0"
            :disabled="locked"
            aria-label="同时上传文件数"
          />
          <span>保留 {{ files.length }} 个文件 · {{ job.status }}</span>
          <Button :disabled="locked || files.length === 0" @click="saveList">
            保存清单
          </Button>
          <Button
            v-if="files.length > 0 && files.every((f) => f.file_id)"
            :disabled="locked"
            @click="useCompleted"
          >
            使用已上传文件
          </Button>
        </div>
        <p class="mb-2 text-sm text-muted-foreground">
          已上传 {{ summary.completed }}/{{ files.length }} 个文件 · 失败
          {{ summary.failed }} 个
        </p>
        <Progress :percent="summary.percent" />
        <Table
          :data-source="files"
          row-key="index"
          :pagination="{ pageSize: 10 }"
          :scroll="{ x: 650 }"
          size="small"
          :columns="[
            { title: '文件', key: 'name' },
            { title: '大小', key: 'size', width: 100 },
            { title: '进度', key: 'progress', width: 120 },
            { title: '状态', key: 'state', width: 160 },
            { title: '操作', key: 'action', width: 80 },
          ]"
        >
          <template #bodyCell="{ column, record }">
            <span v-if="column.key === 'name'" class="break-all">
              {{ record.relative_path || record.name }}
            </span>
            <span v-else-if="column.key === 'size'">
              {{ (record.size / 1024 / 1024).toFixed(1) }} MB
            </span>
            <Progress
              v-else-if="column.key === 'progress'"
              :percent="
                record.file_id
                  ? 100
                  : Math.min(99, Math.round((record.bytes * 100) / record.size))
              "
              size="small"
            />
            <template v-else-if="column.key === 'state'">
              {{ record.status }}
              <p v-if="record.error" class="text-red-600">{{ record.error }}</p>
            </template>
            <Button
              v-else-if="column.key === 'action'"
              type="link"
              danger
              :disabled="locked"
              @click="removeFile(record.index)"
            >
              移除
            </Button>
          </template>
        </Table>
        <p class="mt-2 text-sm text-muted-foreground">
          上传成功后核对集数或材料，再提交登记；已完成文件重试时不会重传。
        </p>
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
