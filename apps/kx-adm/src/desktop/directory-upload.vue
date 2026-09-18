<script setup lang="ts">
import type { UploadJob } from './index';

import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { useAccessStore } from '@vben/stores';

import {
  Alert,
  Button,
  Input,
  InputNumber,
  Modal,
  Progress,
  Table,
} from 'antdv-next';

import { dramaStorage } from '#/api/res/version-files';
import { uploadErrorMessage } from '#/components/file-picker/internal/upload-error';

import { desktop, desktopUploads, importDesktopSession } from './index';
const props = defineProps<{
  res: string;
  version: string;
  versionName: string;
}>();
const emit = defineEmits<{ complete: [] }>();
const router = useRouter();
const open = ref(false);
const storageError = ref('');
const busy = ref(false);
const errorText = ref('');
const storage = ref<Awaited<ReturnType<typeof dramaStorage>>>();
const jobs = ref<UploadJob[]>([]);
const visibleJobs = computed(() =>
  jobs.value.filter((j) => j.res === props.res),
);
const running = (j: UploadJob) =>
  ['上传中', '暂停中', '登记分集', '等待上传'].includes(j.status);
const now = ref(Date.now());
let clock: ReturnType<typeof setInterval> | undefined;
const unlisten: (() => void)[] = [];
let disposed = false;
function update(job: UploadJob) {
  const index = jobs.value.findIndex((j) => j.id === job.id);
  if (index === -1) {
    jobs.value.unshift(job);
  } else {
    jobs.value.splice(index, 1, job);
  }
  if (
    job.status === '完成' &&
    job.res === props.res &&
    job.version === props.version
  )
    emit('complete');
}
async function act(fn: () => Promise<unknown>) {
  busy.value = true;
  errorText.value = '';
  try {
    await fn();
  } catch (error) {
    errorText.value = uploadErrorMessage(error, '操作失败，请重试');
  } finally {
    busy.value = false;
  }
}
async function loadStorage() {
  storage.value = undefined;
  storageError.value = '';
  try {
    storage.value = await dramaStorage();
  } catch (error) {
    storageError.value = uploadErrorMessage(
      error,
      '读取剧视频存储失败，请重试',
    );
  }
}
async function refresh() {
  await act(async () => {
    await Promise.all([
      loadStorage(),
      desktopUploads.list().then((list) => {
        jobs.value = list;
      }),
    ]);
  });
}
async function show() {
  open.value = true;
  await refresh();
}
async function start(job: UploadJob) {
  await act(async () => {
    await loadStorage();
    if (!storage.value) return;
    await desktopUploads.start(job);
  });
}
async function configureStorage() {
  await router.push('/storage/settings');
  open.value = false;
}
async function choose() {
  await act(async () => {
    const selected = await dramaStorage();
    storage.value = selected;
    const job = await desktopUploads.scan(
      props.res,
      props.version,
      selected.code,
      ['fs', 'local'].includes(selected.storage_type),
      props.versionName,
    );
    if (job) update(job);
  });
}
async function syncLogin() {
  await act(async () => {
    const token = useAccessStore().accessToken;
    if (!token) throw new Error('请先登录');
    await importDesktopSession(token);
    await Promise.all([
      loadStorage(),
      desktopUploads.list().then((list) => {
        jobs.value = list;
      }),
    ]);
  });
}
function directoryProgress(job: UploadJob) {
  const total = job.items.reduce((sum, item) => sum + item.size, 0);
  const bytes = job.items.reduce(
    (sum, item) => sum + Math.min(item.size, item.bytes),
    0,
  );
  return {
    total,
    bytes,
    percent: total ? Math.floor((bytes / total) * 100) : 0,
    completed: job.items.filter((item) => item.fileId).length,
    failed: job.items.filter((item) => item.status === '上传失败').length,
  };
}
function size(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
function duration(elapsed: number) {
  const seconds = Math.floor(elapsed / 1000);
  return `${Math.floor(seconds / 3600)}时${Math.floor((seconds % 3600) / 60)}分${seconds % 60}秒`;
}
function elapsed(job: UploadJob, item?: UploadJob['items'][number]) {
  const timing = item?.timing ?? job.timing;
  return duration(
    (timing?.elapsedMs ?? 0) +
      (timing?.active
        ? Math.max(0, now.value - (job.snapshotAt ?? now.value))
        : 0),
  );
}
onMounted(async () => {
  if (!desktop) return;
  clock = setInterval(() => {
    now.value = Date.now();
  }, 1000);
  const stops = await Promise.all([desktopUploads.listen(update)]);
  if (disposed) stops.forEach((stop) => stop());
  else unlisten.push(...stops);
});
onUnmounted(() => {
  disposed = true;
  if (clock) clearInterval(clock);
  unlisten.forEach((stop) => stop());
});
</script>
<template>
  <Button v-if="desktop" type="primary" @click="show">整剧目录上传</Button>
  <span v-else class="text-sm text-muted-foreground">整剧目录上传请使用桌面端</span>
  <Modal
    v-model:open="open"
    title="整剧目录上传"
    :width="1100"
    :z-index="960"
    :footer="null"
  >
    <Alert
      type="info"
      message="每个版本选择自己的视频目录，扫描后确认集数和标题。关闭此窗口不影响上传；关闭主窗口后在托盘继续运行，退出应用会暂停。"
      class="mb-3"
    />
    <Alert
      v-if="storageError"
      type="error"
      :message="storageError"
      class="mb-3"
    />
    <Alert v-if="errorText" type="error" :message="errorText" class="mb-3" />
    <div class="mb-4 flex flex-wrap items-center gap-2">
      <strong>当前版本：{{ versionName }}</strong>
      <span>剧视频存储：{{
          storage?.storage_name || (storageError ? '读取失败' : '正在读取…')
        }}</span>
      <Button
        type="primary"
        :loading="busy"
        :disabled="!storage"
        @click="choose"
      >
        选择目录并扫描
      </Button>
      <Button :disabled="busy" @click="syncLogin">同步当前登录</Button>
      <Button :disabled="busy" @click="refresh">刷新配置和任务</Button>
      <Button :disabled="busy" @click="configureStorage">存储设置</Button>
    </div>
    <p v-if="busy" role="status" class="mb-3">
      正在处理，请稍候…目录扫描在桌面后台执行。
    </p>
    <section
      v-for="job in visibleJobs"
      :key="job.id"
      class="mb-5 rounded border p-3"
    >
      <div class="mb-2 flex flex-wrap items-center gap-3">
        <strong>{{ job.versionName || `版本 ${job.version}` }} ·
          {{ job.name }}</strong><span>{{ job.status }} · {{ job.items.length }} 集</span>
        <Button
          v-if="!running(job) && job.status !== '完成'"
          :disabled="busy || !storage"
          @click="start(job)"
        >
          {{ job.status === '待确认' ? '确认清单并上传' : '继续 / 重试' }}
        </Button>
        <Button
          v-if="running(job)"
          :disabled="job.status === '暂停中'"
          @click="act(() => desktopUploads.pause(job.id))"
        >
          在途分集结束后暂停
        </Button>
      </div>
      <div class="mb-3 space-y-2" aria-label="目录上传进度">
        <p class="break-all text-sm text-muted-foreground">
          目标目录：{{
            job.targetDirectory || `res/${job.res}/versions/${job.version}/`
          }}
        </p>
        <div class="flex flex-wrap items-center gap-3">
          <label :for="`concurrency-${job.id}`">同时上传集数</label>
          <InputNumber
            :id="`concurrency-${job.id}`"
            v-model:value="job.concurrency"
            :min="1"
            :max="8"
            :precision="0"
            :disabled="running(job)"
            placeholder="3"
            aria-label="同时上传集数"
          />
          <span>已上传 {{ directoryProgress(job).completed }}/{{
              job.items.length
            }}
            集 · 失败 {{ directoryProgress(job).failed }} 集</span>
          <span>上传耗时：{{ elapsed(job) }}</span>
        </div>
        <Progress
          :percent="directoryProgress(job).percent"
          :status="job.status === '完成' ? 'success' : 'normal'"
        />
        <p class="text-sm text-muted-foreground">
          {{ size(directoryProgress(job).bytes) }} /
          {{ size(directoryProgress(job).total) }} · 上传完成后登记分集
        </p>
      </div>
      <Alert
        v-if="job.error"
        type="warning"
        :message="job.error"
        class="mb-2"
      />
      <Table
        :data-source="job.items"
        row-key="relative"
        size="small"
        :scroll="{ x: 780 }"
        :pagination="{ pageSize: 10 }"
        :columns="[
          { title: '文件', dataIndex: 'relative', width: 240 },
          { title: '集数', key: 'seq', width: 100 },
          { title: '标题', key: 'title', width: 180 },
          { title: '进度', key: 'progress', width: 130 },
          { title: '耗时', key: 'elapsed', width: 120 },
          { title: '状态', key: 'status', width: 180 },
        ]"
      >
        <template #bodyCell="{ column, record }">
          <InputNumber
            v-if="column.key === 'seq'"
            v-model:value="record.seq"
            :min="1"
            :precision="0"
            :disabled="running(job) || !!record.fileId"
            aria-label="分集集数"
          />
          <Input
            v-else-if="column.key === 'title'"
            v-model:value="record.title"
            :maxlength="200"
            :disabled="running(job) || !!record.fileId"
            aria-label="分集标题"
          />
          <Progress
            v-else-if="column.key === 'progress'"
            :percent="
              record.size ? Math.floor((record.bytes / record.size) * 100) : 0
            "
            size="small"
          />
          <span v-else-if="column.key === 'elapsed'">{{
            elapsed(job, record)
          }}</span>
          <template v-else-if="column.key === 'status'">
            <span>{{ record.status }}</span>
            <p v-if="record.error" class="text-destructive">
              {{ record.error }}
            </p>
          </template>
        </template>
      </Table>
    </section>
    <p
      v-if="!visibleJobs.length"
      class="py-6 text-center text-muted-foreground"
    >
      当前版本暂无目录上传任务
    </p>
  </Modal>
</template>
