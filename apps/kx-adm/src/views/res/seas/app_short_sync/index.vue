<script lang="ts" setup>
import type { Dayjs } from 'dayjs';

import type {
  AppShortSyncResourceSummary,
  AppShortSyncRunRecord,
  AppShortSyncRunWrite,
  AppShortSyncVideoRecord,
  SyncLogEvent,
  SyncTask,
} from '#/api/res/seas/app_short_sync';

import {
  computed,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  onMounted,
  ref,
} from 'vue';

import { useAccess } from '@vben/access';
import { Page } from '@vben/common-ui';

import {
  Alert,
  Button,
  Card,
  DatePicker,
  Drawer,
  Form,
  FormItem,
  Input,
  InputNumber,
  message,
  Modal,
  Progress,
  Select,
  Space,
  Table,
  Tag,
} from 'antdv-next';

import { AppShortSyncApi, watchSyncLogs } from '#/api/res/seas/app_short_sync';
import { requestErrorMessage } from '#/request-errors';

const { hasAccessByCodes } = useAccess();
const canMigrate = computed(() =>
  hasAccessByCodes(['res:app-short-sync:migrate']),
);
const canScan = computed(() => hasAccessByCodes(['res:app-short-sync:run']));
const summaries = ref<AppShortSyncResourceSummary[]>([]);
const loading = ref(false);
const listError = ref('');
const keyword = ref('');
const resourceCode = ref('');
const createdRange = ref<[Dayjs, Dayjs]>();
const resourceState = ref<string>();
const resourcePage = ref(1);
const busyIds = ref<number[]>([]);
const singleTasks = ref<Record<number, null | SyncTask>>({});
const batchTasks = ref<Array<null | SyncTask>>([null, null]);
const batchBusy = ref([false, false]);
const batchReady = ref(false);
const batchError = ref('');
const logTask = ref<null | SyncTask>(null);
const syncLogs = ref<SyncLogEvent[]>([]);
let logAbort: AbortController | undefined;
async function openSyncLogs(task: SyncTask) {
  logAbort?.abort();
  logAbort = new AbortController();
  logTask.value = task;
  syncLogs.value = [];
  let cursor = 0;
  while (!logAbort.signal.aborted) {
    try {
      await watchSyncLogs(
        task.id,
        cursor,
        (event) => {
          cursor = Math.max(cursor, event.id);
          syncLogs.value = [...syncLogs.value, event].slice(-500);
        },
        (state) => {
          logTask.value = state;
        },
        logAbort.signal,
      );
      if (logTask.value && !taskActive(logTask.value)) break;
    } catch {
      if (!logAbort.signal.aborted)
        await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}
function closeSyncLogs() {
  logAbort?.abort();
  logAbort = undefined;
  logTask.value = null;
}
const taskActive = (task?: null | SyncTask) =>
  Boolean(task && ['queued', 'retrying', 'running'].includes(task.status));
const batchLabels = ['全部同步', '全量同步封面'];
const selected = ref<AppShortSyncResourceSummary>();
const detailOpen = ref(false);
const chapters = ref<AppShortSyncVideoRecord[]>([]);
const activeVideos = ref<AppShortSyncVideoRecord[]>([]);
const activeVideosError = ref('');
const activeVideoColumns = [
  { title: '剧名', dataIndex: 'res_name', key: 'res_name' },
  { title: '剧 ID', dataIndex: 'res_id', key: 'res_id' },
  { title: '版本', dataIndex: 'version_name', key: 'version_name' },
  { title: '版本 ID', dataIndex: 'version_id', key: 'version_id' },
  { title: '集数', dataIndex: 'seq_no', key: 'seq_no' },
  { title: '阶段', dataIndex: 'stage', key: 'stage' },
  { title: '进度', dataIndex: 'progress_current', key: 'progress' },
  { title: '尝试次数', dataIndex: 'attempts', key: 'attempts' },
  { title: '更新时间', dataIndex: 'updated_at', key: 'updated_at' },
];
const chapterTotal = ref(0);
const chapterPage = ref(1);
const chapterState = ref<string>();
const versionId = ref<number>();
const sourceId = ref<number>();
const detailLoading = ref(false);
const detailError = ref('');
const runModalOpen = ref(false);
const saving = ref(false);
const runError = ref('');
const runs = ref<AppShortSyncRunRecord[]>([]);
const resourceText = ref('');
const form = ref<AppShortSyncRunWrite>({ cdn_base: '' });
const concurrency = ref<null | number>(5);
const segmentConcurrency = ref<null | number>(8);
const coverConcurrency = ref<null | number>(5);
const videoTimeout = ref<null | number>(1800);
const coverTimeout = ref<null | number>(120);
const settingsLoading = ref(false);
const settingsReady = ref(false);
const settingsSaving = ref(false);
const settingsError = ref('');
let timer: ReturnType<typeof setTimeout> | undefined;
let alive = true;
let listSequence = 0;
let detailSequence = 0;

const states = [
  { label: '待同步', value: 'pending' },
  { label: '同步中', value: 'running' },
  { label: '已同步', value: 'succeeded' },
  { label: '失败', value: 'failed' },
  { label: '冲突', value: 'conflict' },
  { label: '已停止', value: 'paused' },
];
const labels = Object.fromEntries(states.map((s) => [s.value, s.label]));
const colors: Record<string, string> = {
  pending: 'default',
  running: 'processing',
  succeeded: 'success',
  failed: 'error',
  conflict: 'warning',
  paused: 'default',
};
const resourceColumns = [
  {
    title: '剧名 / 作品编号',
    key: 'drama',
    width: 240,
    fixed: 'left' as const,
  },
  { title: '原始创建时间', key: 'create_time', width: 180 },
  { title: '源剧 ID', dataIndex: 'source_id', width: 100 },
  { title: '版本 / 语言', key: 'versions', width: 160 },
  { title: '状态', key: 'state', width: 150 },
  { title: '同步进度', key: 'progress', width: 180 },
  { title: '待同步', dataIndex: 'pending', width: 80 },
  { title: '同步中', dataIndex: 'running', width: 80 },
  { title: '失败 / 冲突', key: 'failed', width: 100 },
  { title: '失败原因', key: 'error', width: 240 },
];
const chapterColumns = [
  { title: '集数', dataIndex: 'seq_no', width: 70 },
  { title: '版本 ID', dataIndex: 'version_id', width: 100 },
  { title: '源章节 ID', dataIndex: 'source_id', width: 110 },
  { title: '状态', key: 'state', width: 100 },
  { title: '执行环节 / 环节进度', key: 'stage', width: 250 },
  { title: '尝试次数', dataIndex: 'attempts', width: 90 },
  { title: '失败原因', dataIndex: 'error_code', width: 280 },
  { title: '更新时间', key: 'updated_at', width: 170 },
];
const stageLabels: Record<string, string> = {
  pending: '等待同步',
  preparing: '准备同步',
  source_url: '解析源地址',
  storage_missing: '存储文件缺失，等待重新同步',
  storage_check: '检查目标存储',
  download_mp4: '下载 MP4',
  download_manifest: '读取 HLS 清单',
  download_segments: '下载 HLS 分片',
  transcode: '转码中',
  transcode_output: '读取转码结果',
  transcode_complete: '转码完成',
  storage_directory: '准备上传目录',
  upload: '上传中',
  upload_complete: '上传完成',
  register: '登记章节',
  completed: '同步完成',
};
function stageText(video: AppShortSyncVideoRecord) {
  if (video.state === 'succeeded') return '同步完成';
  if (video.state === 'pending') return '等待同步';
  const stage = (stageLabels[video.stage] ?? video.stage) || '历史记录无环节';
  if (video.state === 'failed') return `失败于：${stage}`;
  if (video.state === 'paused') return `停止于：${stage}`;
  return stage;
}
function bytesText(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}
function stageProgressText(video: AppShortSyncVideoRecord) {
  if (video.state === 'pending' || video.state === 'succeeded') return '';
  if (video.progress_unit === 'bytes') {
    const done = bytesText(video.progress_current);
    return video.progress_total === null
      ? `已下载 ${done}（总量未知）`
      : `${done} / ${bytesText(video.progress_total)}`;
  }
  if (video.progress_unit === 'segments')
    return `${video.progress_current} / ${video.progress_total ?? '?'} 个分片`;
  return '';
}
function stagePercent(video: AppShortSyncVideoRecord) {
  return video.progress_total &&
    video.progress_total > 0 &&
    stageProgressText(video)
    ? Math.min(
        100,
        Math.floor((video.progress_current / video.progress_total) * 100),
      )
    : undefined;
}
const total = computed(() => summaries.value.reduce((n, r) => n + r.total, 0));
const succeeded = computed(() =>
  summaries.value.reduce((n, r) => n + r.succeeded, 0),
);
const failed = computed(() =>
  summaries.value.reduce((n, r) => n + r.failed + r.conflict, 0),
);
const percent = (row: AppShortSyncResourceSummary) =>
  row.total ? Math.floor((100 * row.succeeded) / row.total) : 0;
const time = (value: number) =>
  value ? new Date(value * 1000).toLocaleString() : '-';

async function loadResources() {
  const sequence = ++listSequence;
  loading.value = true;
  try {
    const result = await AppShortSyncApi.resourceSummary({
      keyword: keyword.value.trim() || undefined,
      resource_code: resourceCode.value.trim() || undefined,
      created_from: createdRange.value?.[0]?.startOf('day').unix(),
      created_until: createdRange.value?.[1]?.endOf('day').unix(),
      state: resourceState.value,
    });
    if (!alive || sequence !== listSequence) return;
    summaries.value = result;
    listError.value = '';
    if (selected.value)
      selected.value =
        result.find((r) => r.res_id === selected.value?.res_id) ??
        selected.value;
  } catch (error) {
    if (alive && sequence === listSequence)
      listError.value = requestErrorMessage(error, '加载剧同步状态失败');
  } finally {
    if (sequence === listSequence) loading.value = false;
  }
}
async function loadChapters() {
  if (!detailOpen.value || !selected.value) return;
  const id = selected.value.res_id;
  const sequence = ++detailSequence;
  detailLoading.value = true;
  try {
    const result = await AppShortSyncApi.listVideos({
      res_id: id,
      state: chapterState.value,
      version_id: versionId.value,
      source_id: sourceId.value,
      page: chapterPage.value,
      size: 20,
    });
    if (
      !alive ||
      sequence !== detailSequence ||
      selected.value?.res_id !== id ||
      !detailOpen.value
    )
      return;
    chapters.value = result.items.map((v) => v.video);
    chapterTotal.value = result.total;
    detailError.value = '';
  } catch (error) {
    if (alive && sequence === detailSequence)
      detailError.value = requestErrorMessage(error, '加载章节详情失败');
  } finally {
    if (sequence === detailSequence) detailLoading.value = false;
  }
}
function showChapters(row: AppShortSyncResourceSummary) {
  selected.value = row;
  chapterPage.value = 1;
  chapterState.value = undefined;
  versionId.value = undefined;
  sourceId.value = undefined;
  chapters.value = [];
  chapterTotal.value = 0;
  detailError.value = '';
  detailOpen.value = true;
  void loadChapters();
}
function filterResources() {
  resourcePage.value = 1;
  void loadResources();
}
function filterChapters() {
  chapterPage.value = 1;
  void loadChapters();
}
async function loadActiveVideos() {
  if (!canMigrate.value) return;
  try {
    const result = await AppShortSyncApi.listVideos({
      state: 'running',
      page: 1,
      size: 100,
    });
    activeVideos.value = result.items.map((item) => item.video);
    activeVideosError.value = '';
  } catch (error) {
    activeVideosError.value = requestErrorMessage(
      error,
      '读取正在同步的集失败',
    );
  }
}
async function refresh() {
  await Promise.all([
    loadResources(),
    loadActiveVideos(),
    loadChapters(),
    loadBatchTasks(),
    loadSingleTasks(),
  ]);
}
async function loadSingleTasks() {
  if (!canMigrate.value) return;
  await Promise.all(
    Object.entries(singleTasks.value)
      .filter(([, task]) => taskActive(task))
      .map(async ([id]) => {
        try {
          singleTasks.value[Number(id)] = await AppShortSyncApi.migrationStatus(
            false,
            Number(id),
          );
        } catch (error) {
          listError.value = requestErrorMessage(error, '读取单剧校验任务失败');
        }
      }),
  );
}
async function loadBatchTasks() {
  if (!canMigrate.value) return;
  try {
    const result = await Promise.all([
      AppShortSyncApi.migrationStatus(),
      AppShortSyncApi.migrationStatus(true),
    ]);
    if (!alive) return;
    batchTasks.value = result;
    batchReady.value = true;
    batchError.value = '';
  } catch (error) {
    if (!alive) return;
    batchReady.value = false;
    batchError.value = requestErrorMessage(error, '读取后台同步状态失败');
  }
}
async function operateBatch(index: number, stop = false) {
  if (batchBusy.value[index]) return;
  batchBusy.value[index] = true;
  try {
    const task = batchTasks.value[index];
    batchTasks.value[index] =
      stop && task
        ? await AppShortSyncApi.stopMigration(task.id)
        : await AppShortSyncApi.migrateVideos(undefined, index === 1);
    message.success(
      stop ? '已请求停止，正在释放当前任务' : '已提交后台同步任务',
    );
    await refresh();
  } catch (error) {
    message.error(requestErrorMessage(error, stop ? '停止失败' : '提交失败'));
  } finally {
    batchBusy.value[index] = false;
  }
}
async function operate(
  row: AppShortSyncResourceSummary,
  action: 'restart' | 'stop',
) {
  if (busyIds.value.includes(row.res_id)) return;
  busyIds.value.push(row.res_id);
  try {
    if (action === 'stop') {
      const task = singleTasks.value[row.res_id];
      if (taskActive(task) && task)
        singleTasks.value[row.res_id] = await AppShortSyncApi.stopMigration(
          task.id,
        );
      await AppShortSyncApi.stopResource(row.res_id);
    } else {
      singleTasks.value[row.res_id] = await AppShortSyncApi.migrateVideos(
        row.res_id,
      );
    }
    message.success(
      action === 'stop'
        ? `已停止「${row.res_name}」`
        : `已提交「${row.res_name}」的校验与补齐任务`,
    );
    await refresh();
  } catch (error) {
    message.error(
      requestErrorMessage(error, action === 'stop' ? '停止失败' : '同步失败'),
    );
  } finally {
    busyIds.value = busyIds.value.filter((id) => id !== row.res_id);
  }
}
async function loadSettings() {
  if (settingsLoading.value || settingsSaving.value) return;
  settingsLoading.value = true;
  settingsError.value = '';
  try {
    const result = await AppShortSyncApi.getSettings();
    if (!alive) return;
    concurrency.value = result.concurrency;
    segmentConcurrency.value = result.segment_concurrency ?? 8;
    coverConcurrency.value = result.cover_concurrency ?? 5;
    videoTimeout.value = result.video_timeout_seconds ?? 1800;
    coverTimeout.value = result.cover_timeout_seconds ?? 120;
    settingsReady.value = true;
  } catch (error) {
    if (alive)
      settingsError.value = requestErrorMessage(error, '加载同步配置失败');
  } finally {
    settingsLoading.value = false;
  }
}
async function saveSettings() {
  if (settingsSaving.value || !settingsReady.value) return;
  const value = concurrency.value;
  if (value === null || !Number.isInteger(value) || value < 1 || value > 32) {
    settingsError.value = '同时同步集数必须为 1 至 32 的整数';
    return;
  }
  const segments = segmentConcurrency.value;
  if (
    segments === null ||
    !Number.isInteger(segments) ||
    segments < 1 ||
    segments > 32
  ) {
    settingsError.value = '单集分片并发数必须为 1 至 32 的整数';
    return;
  }
  const coverParallel = coverConcurrency.value;
  if (
    coverParallel === null ||
    !Number.isInteger(coverParallel) ||
    coverParallel < 1 ||
    coverParallel > 32
  ) {
    settingsError.value = '封面并发数必须为 1 至 32 的整数';
    return;
  }
  const videoSeconds = videoTimeout.value;
  const coverSeconds = coverTimeout.value;
  if (
    videoSeconds === null ||
    !Number.isInteger(videoSeconds) ||
    videoSeconds < 30 ||
    videoSeconds > 86_400 ||
    coverSeconds === null ||
    !Number.isInteger(coverSeconds) ||
    coverSeconds < 10 ||
    coverSeconds > 3600
  ) {
    settingsError.value = '单集超时为 30–86400 秒，封面超时为 10–3600 秒';
    return;
  }
  settingsSaving.value = true;
  settingsError.value = '';
  try {
    const result = await AppShortSyncApi.saveSettings({
      concurrency: value,
      segment_concurrency: segments,
      cover_concurrency: coverParallel,
      video_timeout_seconds: videoSeconds,
      cover_timeout_seconds: coverSeconds,
    });
    concurrency.value = result.concurrency;
    segmentConcurrency.value = result.segment_concurrency ?? 8;
    coverConcurrency.value = result.cover_concurrency ?? 5;
    videoTimeout.value = result.video_timeout_seconds ?? 1800;
    coverTimeout.value = result.cover_timeout_seconds ?? 120;
    message.success('同步配置已保存；封面并发从下一轮生效');
  } catch (error) {
    settingsError.value = requestErrorMessage(error, '保存同步配置失败');
  } finally {
    settingsSaving.value = false;
  }
}
async function loadRuns() {
  try {
    const result = await AppShortSyncApi.listRuns({ page: 1, size: 10 });
    if (!alive) return;
    runs.value = result.items;
    if (!form.value.cdn_base)
      form.value.cdn_base =
        result.items.find((r) => r.config.cdn_base)?.config.cdn_base ?? '';
  } catch (error) {
    if (alive) runError.value = requestErrorMessage(error, '加载同步记录失败');
  }
}
async function submitRun() {
  if (saving.value) return;
  runError.value = '';
  try {
    const ids = resourceText.value
      .split(/[\s,，]+/)
      .filter(Boolean)
      .map(Number);
    if (ids.some((id) => !Number.isSafeInteger(id) || id <= 0))
      throw new Error('源剧范围只能填写正整数 ID');
    const url = new URL(form.value.cdn_base);
    if (url.protocol !== 'https:') throw new Error('CDN 基址必须使用 HTTPS');
    saving.value = true;
    const result = await AppShortSyncApi.createRun({
      ...form.value,
      resource_ids: ids.length > 0 ? [...new Set(ids)] : undefined,
    });
    if (result.run.state === 'failed')
      throw new Error(result.run.error_code || '任务提交失败');
    runModalOpen.value = false;
    message.success('源数据扫描已提交');
    await Promise.all([loadRuns(), refresh()]);
  } catch (error) {
    runError.value = requestErrorMessage(
      error,
      error instanceof Error ? error.message : '提交失败',
    );
  } finally {
    saving.value = false;
  }
}
function stopPolling() {
  alive = false;
  ++listSequence;
  ++detailSequence;
  if (timer) clearTimeout(timer);
  timer = undefined;
}
function startPolling() {
  alive = true;
  if (timer) return;
  timer = setTimeout(async () => {
    await Promise.all([refresh(), loadRuns()]);
    timer = undefined;
    if (alive) startPolling();
  }, 5000);
}
onMounted(() => {
  void refresh();
  void loadRuns();
  void loadSettings();
  startPolling();
});
onActivated(() => {
  startPolling();
  void loadSettings();
});
onDeactivated(stopPolling);
onBeforeUnmount(stopPolling);
onBeforeUnmount(closeSyncLogs);
</script>

<template>
  <Page title="短剧同步">
    <Card title="视频同步配置" class="mb-4">
      <Space wrap>
        <label for="sync-concurrency">同时同步集数</label>
        <InputNumber
          id="sync-concurrency"
          v-model:value="concurrency"
          :min="1"
          :max="32"
          :precision="0"
          :disabled="
            !canMigrate || !settingsReady || settingsLoading || settingsSaving
          "
          aria-label="同时同步集数"
        />
        <label for="sync-segment-concurrency">单集分片并发数</label>
        <InputNumber
          id="sync-segment-concurrency"
          v-model:value="segmentConcurrency"
          :min="1"
          :max="32"
          :precision="0"
          :disabled="
            !canMigrate || !settingsReady || settingsLoading || settingsSaving
          "
          aria-label="单集分片并发数"
        />
        <label for="cover-concurrency">封面并发数</label>
        <InputNumber
          id="cover-concurrency"
          v-model:value="coverConcurrency"
          :min="1"
          :max="32"
          :precision="0"
          aria-label="封面并发数"
          :disabled="
            !canMigrate || !settingsReady || settingsLoading || settingsSaving
          "
        />
        <label for="video-timeout">单集超时（秒）</label>
        <InputNumber
          id="video-timeout"
          v-model:value="videoTimeout"
          :min="30"
          :max="86400"
          :precision="0"
          aria-label="单集超时（秒）"
          :disabled="
            !canMigrate || !settingsReady || settingsLoading || settingsSaving
          "
        />
        <label for="cover-timeout">封面超时（秒）</label>
        <InputNumber
          id="cover-timeout"
          v-model:value="coverTimeout"
          :min="10"
          :max="3600"
          :precision="0"
          aria-label="封面超时（秒）"
          :disabled="
            !canMigrate || !settingsReady || settingsLoading || settingsSaving
          "
        />
        <Button
          v-if="canMigrate"
          type="primary"
          :loading="settingsSaving"
          :disabled="!settingsReady || settingsLoading"
          @click="saveSettings"
        >
          保存同步配置
        </Button>
        <Button
          v-if="settingsError"
          :loading="settingsLoading"
          @click="loadSettings"
        >
          重新加载配置
        </Button>
        <div class="text-muted-foreground">
          同时同步默认 5 集，范围 1–32 集，当前轮结束且并发池空闲后生效。每集
          m3u8 默认并发下载 8 个分片，范围 1–32，从下一集开始生效。
        </div>
      </Space>
      <Alert
        v-if="settingsError"
        :message="settingsError"
        type="error"
        show-icon
        class="mt-3"
      />
    </Card>
    <Card title="正在同步的集" class="mb-4">
      <Alert
        v-if="activeVideosError"
        :message="activeVideosError"
        type="error"
        show-icon
      />
      <Table
        v-else
        :columns="activeVideoColumns"
        :data-source="activeVideos"
        :pagination="false"
        size="small"
        row-key="id"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'progress'">
            {{ record.progress_current }}
            <span v-if="record.progress_total != null">
              / {{ record.progress_total }}
            </span>
            {{ record.progress_unit }}
          </template>
          <span v-else-if="column.key === 'updated_at'">
            {{ time(record.updated_at) }}
          </span>
        </template>
      </Table>
      <Empty
        v-if="!activeVideosError && activeVideos.length === 0"
        description="当前没有正在同步的集"
      />
    </Card>
    <Card title="按剧同步进度">
      <template #extra>
        <Space wrap>
          <template v-if="canMigrate">
            <template v-for="(label, index) in batchLabels" :key="label">
              <Button
                v-if="taskActive(batchTasks[index])"
                danger
                :loading="batchBusy[index]"
                :disabled="!!batchTasks[index]?.cancel_requested_at"
                @click="operateBatch(index, true)"
              >
                {{ batchTasks[index]?.cancel_requested_at ? '正在停止' : '停止'
                }}{{ label }}
              </Button>
              <Button
                v-else
                :loading="batchBusy[index]"
                :disabled="!batchReady"
                @click="operateBatch(index)"
              >
                {{ label }}
              </Button>
            </template>
          </template>
          <Button
            v-if="canScan"
            type="primary"
            aria-label="扫描源数据"
            @click="runModalOpen = true"
          >
            扫描源数据
          </Button>
        </Space>
      </template>
      <p class="text-muted-foreground mb-3">
        每轮最多处理 300
        条记录，新剧优先；成功项跳过。失败或超时释放并发位置，下一轮重试，最多重试
        1 次（总共 2
        次尝试）后记为最终失败。系统重启后继续，手动停止后可启动紧急单剧。
      </p>
      <Alert
        v-if="batchError"
        :message="batchError"
        type="error"
        class="mb-3"
      />
      <template v-for="(task, index) in batchTasks" :key="index">
        <Alert
          v-if="task"
          class="mb-3"
          show-icon
          :type="task.error_message || task.failed_count ? 'warning' : 'info'"
          :message="`${batchLabels[index]}：${task.message || task.status}，成功 ${task.succeeded_count} / ${task.total_count ?? '-'}，失败 ${task.failed_count}`"
          :description="task.error_message || undefined"
        >
          <template #action>
            <Button size="small" @click="openSyncLogs(task)">
              查看实时日志
            </Button>
          </template>
        </Alert>
      </template>
      <Card v-if="logTask" title="全量同步实时日志" class="mt-3" size="small">
        <template #extra>
          <Button size="small" @click="closeSyncLogs">关闭</Button>
        </template>
        <Alert
          :message="`${logTask.message || logTask.status} · 成功 ${logTask.succeeded_count} · 失败 ${logTask.failed_count}`"
          type="info"
          class="mb-2"
        />
        <div
          class="max-h-72 overflow-auto rounded bg-muted p-2 font-mono text-xs"
        >
          <div
            v-for="event in syncLogs"
            :key="event.id"
            :class="event.level === 'error' ? 'text-destructive' : ''"
          >
            [{{ time(event.created_at) }}] [{{ event.stage }}]
            {{ event.message }}
          </div>
          <div v-if="syncLogs.length === 0" class="text-muted-foreground">
            等待日志事件…
          </div>
        </div>
      </Card>
      <Space wrap class="mb-4">
        <Input
          v-model:value="resourceCode"
          allow-clear
          placeholder="作品编号（精确匹配）"
          aria-label="作品编号"
          class="w-52"
          @press-enter="filterResources"
        />
        <DatePicker.RangePicker
          v-model:value="createdRange"
          :placeholder="['原始创建开始日期', '原始创建结束日期']"
        />

        <Input
          v-model:value="keyword"
          allow-clear
          aria-label="剧名、作品编号或源剧 ID"
          placeholder="剧名、作品编号或源剧 ID"
          @press-enter="filterResources"
        />
        <Select
          v-model:value="resourceState"
          :options="states"
          allow-clear
          class="w-36"
          aria-label="剧同步状态"
          placeholder="剧同步状态"
        />
        <Button type="primary" @click="filterResources">查询</Button>
        <Button aria-label="刷新" @click="refresh">刷新</Button>
        <div>
          当前筛选：{{ summaries.length }} 部剧 · 已同步 {{ succeeded }} /
          {{ total }} 集 · 失败/冲突 {{ failed }} 集
        </div>
      </Space>
      <Alert
        v-if="listError"
        :message="listError"
        type="error"
        show-icon
        class="mb-4"
      />
      <Table
        :data-source="summaries"
        :columns="resourceColumns"
        :loading="loading"
        row-key="res_id"
        :scroll="{ x: 1370 }"
        :pagination="{
          current: resourcePage,
          pageSize: 20,
          showSizeChanger: false,
        }"
        @change="(p: { current?: number }) => (resourcePage = p.current ?? 1)"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'drama'">
            <Button type="link" class="!p-0" @click="showChapters(record)">
              {{ record.res_name }}
            </Button>
            <div class="text-muted-foreground text-xs">
              {{ record.resource_code || '未关联编号' }} · 资源
              {{ record.res_id }}
            </div>
          </template>
          <template v-else-if="column.key === 'versions'">
            {{ record.version_count }} 个版本
            <div>
              {{ record.languages.join(' / ') || '未指定语言' }}
            </div>
          </template>
          <template v-else-if="column.key === 'state'">
            <Tag :color="colors[record.state]">
              {{ labels[record.state] || record.state }}
            </Tag>
            <Button
              v-if="
                canMigrate &&
                record.state !== 'running' &&
                !taskActive(singleTasks[record.res_id])
              "
              type="link"
              size="small"
              :loading="busyIds.includes(record.res_id)"
              @click="operate(record, 'restart')"
            >
              {{
                record.state === 'succeeded' || record.succeeded > 0
                  ? '重新同步'
                  : '同步'
              }}
            </Button>
            <Button
              v-if="
                canMigrate &&
                (record.state === 'running' ||
                  taskActive(singleTasks[record.res_id]))
              "
              type="link"
              size="small"
              danger
              :loading="busyIds.includes(record.res_id)"
              @click="operate(record, 'stop')"
            >
              停止
            </Button>
            <div
              v-if="
                singleTasks[record.res_id]?.message ||
                singleTasks[record.res_id]?.error_message
              "
              class="text-xs"
            >
              {{
                singleTasks[record.res_id]?.error_message ||
                singleTasks[record.res_id]?.message
              }}
            </div>
            <div class="text-muted-foreground text-xs">
              {{ record.cover_synced ? '封面已同步' : '封面待同步' }}
            </div>
            <div v-if="record.cover_error" class="text-destructive text-xs">
              {{ record.cover_error }}
            </div>
          </template>
          <template v-else-if="column.key === 'create_time'">
            <span>{{
              record.create_time ? time(record.create_time) : '未记录'
            }}</span>
          </template>
          <template v-else-if="column.key === 'progress'">
            <Progress :percent="percent(record)" size="small" />
            <div>{{ record.succeeded }} / {{ record.total }} 集</div>
          </template>
          <template v-else-if="column.key === 'failed'">
            {{ record.failed }} / {{ record.conflict }}
          </template>
          <template v-else-if="column.key === 'error'">
            <span class="break-words">{{
              record.failure_reasons.join('；') || '-'
            }}</span>
          </template>
        </template>
      </Table>
    </Card>
    <details class="mt-4 rounded border p-4">
      <summary class="cursor-pointer">源数据扫描记录</summary>
      <Alert v-if="runError" :message="runError" type="error" class="my-3" />
      <div v-for="run in runs" :key="run.id" class="border-b py-3">
        批次 {{ run.id }} · {{ labels[run.state] || run.state }} · 已处理
        {{ run.processed }} / {{ run.total }} · {{ time(run.updated_at) }}
        <div v-if="run.error_code" class="text-destructive whitespace-pre-wrap">
          {{ run.error_code }}
        </div>
      </div>
    </details>
    <Drawer
      v-model:open="detailOpen"
      :title="`${selected?.res_name ?? ''} · 章节详情`"
      size="90%"
    >
      <template v-if="detailOpen && selected">
        <p class="mb-4">
          作品编号：{{ selected.resource_code || '-' }} · 源剧：{{
            selected.source_id
          }}
          · 已同步 {{ selected.succeeded }} / {{ selected.total }} 集
        </p>
        <Space wrap class="mb-4">
          <Select
            v-model:value="chapterState"
            :options="states"
            allow-clear
            class="w-36"
            aria-label="章节状态"
            placeholder="章节状态"
          />
          <InputNumber
            v-model:value="versionId"
            :min="1"
            placeholder="版本 ID"
            aria-label="版本 ID"
          />
          <InputNumber
            v-model:value="sourceId"
            :min="1"
            placeholder="源章节 ID"
            aria-label="源章节 ID"
          />
          <Button type="primary" @click="filterChapters">筛选章节</Button>
          <Button @click="loadChapters">刷新章节</Button>
        </Space>
        <Alert
          v-if="detailError"
          :message="detailError"
          type="error"
          class="mb-4"
        />
        <Table
          :data-source="chapters"
          :columns="chapterColumns"
          :loading="detailLoading"
          row-key="id"
          :scroll="{ x: 1250 }"
          :pagination="{
            current: chapterPage,
            pageSize: 20,
            total: chapterTotal,
            showSizeChanger: false,
          }"
          @change="
            (p: { current?: number }) => {
              chapterPage = p.current ?? 1;
              loadChapters();
            }
          "
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'state'">
              <Tag :color="colors[record.state]">
                {{ labels[record.state] || record.state }}
              </Tag>
            </template>
            <template v-else-if="column.key === 'stage'">
              <div>{{ stageText(record) }}</div>
              <Progress
                v-if="stagePercent(record) !== undefined"
                :percent="stagePercent(record)"
                :status="record.state === 'failed' ? 'exception' : 'normal'"
                size="small"
              />
              <div class="text-muted-foreground text-xs">
                {{ stageProgressText(record) }}
              </div>
            </template>
            <template v-else-if="column.key === 'updated_at'">
              {{ time(record.updated_at) }}
            </template>
          </template>
        </Table>
      </template>
    </Drawer>
    <Modal
      v-model:open="runModalOpen"
      title="扫描源数据"
      :confirm-loading="saving"
      :closable="!saving"
      :mask-closable="!saving"
      ok-text="提交扫描"
      @ok="submitRun"
    >
      <Alert v-if="runError" :message="runError" type="error" class="mb-3" />
      <Form layout="vertical">
        <FormItem label="CDN 基址" required>
          <Input
            v-model:value="form.cdn_base"
            placeholder="https://cdn.example.com/"
          />
        </FormItem>
        <FormItem label="源剧范围">
          <Input
            v-model:value="resourceText"
            placeholder="留空扫描全部；填写源剧 ID，逗号分隔"
          />
        </FormItem>
      </Form>
    </Modal>
  </Page>
</template>
