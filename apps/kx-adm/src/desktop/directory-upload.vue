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
  Popconfirm,
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
const drafts = ref(new Map<string, UploadJob>());
const displayJob = (job: UploadJob) => drafts.value.get(job.id) ?? job;
const expanded = (job: UploadJob) => job.collapsed === false;
const canEdit = (job: UploadJob) =>
  !running(job) && !job.importId && job.status !== '完成';
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
    const draft = drafts.value.get(job.id);
    if (draft) {
      job = await desktopUploads.update(draft);
      drafts.value.delete(job.id);
      update(job);
    }
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
    if (job) {
      update(job);
      await edit(job);
    }
  });
}
async function edit(job: UploadJob) {
  if (!canEdit(job)) return;
  const current = await desktopUploads.collapse(job, false);
  update(current);
  drafts.value.set(job.id, JSON.parse(JSON.stringify(current)) as UploadJob);
}
async function save(job: UploadJob) {
  await act(async () => {
    const draft = drafts.value.get(job.id);
    if (!draft) return;
    const saved = await desktopUploads.update(draft);
    drafts.value.delete(job.id);
    update(saved);
  });
}
async function toggle(job: UploadJob) {
  await act(async () => {
    update(await desktopUploads.collapse(job, expanded(job)));
  });
}
function removeItem(job: UploadJob, relative: string) {
  const draft = drafts.value.get(job.id);
  if (!draft) return;
  draft.items = draft.items.filter((item) => item.relative !== relative);
}
async function removeJob(job: UploadJob) {
  await act(async () => {
    await desktopUploads.remove(job);
    jobs.value = jobs.value.filter((item) => item.id !== job.id);
    drafts.value.delete(job.id);
  });
}
async function rebind(job: UploadJob) {
  await act(async () => {
    let current = job;
    const draft = drafts.value.get(job.id);
    if (draft) {
      current = await desktopUploads.update(draft);
      drafts.value.delete(job.id);
    }
    update(await desktopUploads.rebind(current));
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
        <Button
          size="small"
          :aria-expanded="expanded(job)"
          :disabled="busy"
          @click="toggle(job)"
        >
          {{ expanded(job) ? '收起明细' : '展开明细' }}
        </Button>
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
        <Button
          v-if="canEdit(job) && !drafts.get(job.id)"
          :disabled="busy"
          @click="act(() => edit(job))"
        >
          编辑清单
        </Button>
        <Button v-if="drafts.get(job.id)" :disabled="busy" @click="save(job)">
          保存修改
        </Button>
        <Button
          v-if="drafts.get(job.id)"
          :disabled="busy"
          @click="drafts.delete(job.id)"
        >
          取消修改
        </Button>
        <Popconfirm
          title="移除此本地目录任务？本地视频和服务器文件会保留。"
          @confirm="removeJob(job)"
        >
          <Button danger :disabled="busy || running(job)">移除目录</Button>
        </Popconfirm>
      </div>
      <div class="mb-3 space-y-2" aria-label="目录上传进度">
        <p v-if="expanded(job)" class="break-all text-sm text-muted-foreground">
          目标目录：{{
            job.targetDirectory || `res/${job.res}/versions/${job.version}/`
          }}
        </p>
        <div class="flex flex-wrap items-center gap-3">
          <span v-if="!expanded(job)">并发 {{ job.concurrency ?? 3 }} 集</span>
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
      <div v-if="expanded(job)" class="mb-3 flex flex-wrap items-center gap-3">
        <label :for="`directory-${job.id}`">目录名称</label>
        <Input
          :id="`directory-${job.id}`"
          :value="displayJob(job).name"
          :maxlength="200"
          :disabled="!drafts.get(job.id) || busy"
          class="max-w-72"
          aria-label="目录名称"
          @update:value="
            (value) => {
              const draft = drafts.get(job.id);
              if (draft) draft.name = value;
            }
          "
        />
        <label :for="`concurrency-${job.id}`">同时上传集数</label>
        <InputNumber
          :id="`concurrency-${job.id}`"
          :value="displayJob(job).concurrency ?? 3"
          :min="1"
          :max="8"
          :precision="0"
          :disabled="!drafts.get(job.id) || busy"
          aria-label="同时上传集数"
          @update:value="
            (value) => {
              const draft = drafts.get(job.id);
              if (draft) draft.concurrency = Number(value);
            }
          "
        />
        <Button
          v-if="!running(job) && !job.items.some((item) => item.fileId)"
          :disabled="busy || !storage"
          @click="rebind(job)"
        >
          使用当前存储
        </Button>
      </div>
      <Alert
        v-if="job.error"
        type="warning"
        :message="job.error"
        class="mb-2"
      />
      <Table
        v-if="expanded(job)"
        :data-source="displayJob(job).items"
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
          { title: '操作', key: 'actions', width: 80 },
        ]"
      >
        <template #bodyCell="{ column, record }">
          <InputNumber
            v-if="column.key === 'seq'"
            v-model:value="record.seq"
            :min="1"
            :precision="0"
            :disabled="
              !drafts.get(job.id) || busy || record.status === '已登记'
            "
            aria-label="分集集数"
          />
          <Input
            v-else-if="column.key === 'title'"
            v-model:value="record.title"
            :maxlength="200"
            :disabled="
              !drafts.get(job.id) || busy || record.status === '已登记'
            "
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
          <Button
            v-else-if="column.key === 'actions'"
            type="link"
            danger
            :disabled="
              !drafts.get(job.id) || busy || record.status === '已登记'
            "
            @click="removeItem(job, record.relative)"
          >
            移除
          </Button>
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
