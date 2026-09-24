<script lang="ts" setup>
import type {
  AppShortSyncResourceSummary,
  AppShortSyncRunRecord,
  AppShortSyncRunWrite,
  AppShortSyncVideoRecord,
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

import { AppShortSyncApi } from '#/api/res/seas/app_short_sync';
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
const resourceState = ref<string>();
const resourcePage = ref(1);
const busyIds = ref<number[]>([]);
const selected = ref<AppShortSyncResourceSummary>();
const detailOpen = ref(false);
const chapters = ref<AppShortSyncVideoRecord[]>([]);
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
  { title: '源剧 ID', dataIndex: 'source_id', width: 100 },
  { title: '版本 / 语言', key: 'versions', width: 160 },
  { title: '状态', key: 'state', width: 100 },
  { title: '同步进度', key: 'progress', width: 180 },
  { title: '待同步', dataIndex: 'pending', width: 80 },
  { title: '同步中', dataIndex: 'running', width: 80 },
  { title: '失败 / 冲突', key: 'failed', width: 100 },
  { title: '失败原因', key: 'error', width: 240 },
  { title: '操作', key: 'actions', width: 160, fixed: 'right' as const },
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
async function refresh() {
  await Promise.all([loadResources(), loadChapters()]);
}
function restart(row: AppShortSyncResourceSummary) {
  Modal.confirm({
    title: `重新同步「${row.res_name}」？`,
    content:
      '继续迁移该剧未完成的章节，保留已同步的视频。冲突章节需先处理冲突。',
    okText: '重新同步',
    cancelText: '取消',
    onOk: () => operate(row, 'restart'),
  });
}
async function operate(
  row: AppShortSyncResourceSummary,
  action: 'restart' | 'stop',
) {
  if (busyIds.value.includes(row.res_id)) return;
  busyIds.value.push(row.res_id);
  try {
    await (action === 'stop'
      ? AppShortSyncApi.stopResource(row.res_id)
      : AppShortSyncApi.migrateVideos(row.res_id));
    message.success(
      action === 'stop'
        ? `已停止「${row.res_name}」`
        : `已提交「${row.res_name}」的同步任务`,
    );
    await refresh();
  } catch (error) {
    message.error(
      requestErrorMessage(
        error,
        action === 'stop' ? '停止失败' : '重新同步失败',
      ),
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
  settingsSaving.value = true;
  settingsError.value = '';
  try {
    const result = await AppShortSyncApi.saveSettings({ concurrency: value });
    concurrency.value = result.concurrency;
    message.success('同步配置已保存，当前迁移任务结束后生效');
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
          默认 5 集，范围 1–32 集；保存后在当前迁移任务全部结束后生效。
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
    <Card title="按剧同步进度">
      <template #extra>
        <Button v-if="canScan" type="primary" @click="runModalOpen = true">
          扫描源数据
        </Button>
      </template>
      <Space wrap class="mb-4">
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
        <Button @click="refresh">刷新</Button>
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
          <template v-else-if="column.key === 'actions'">
            <Space wrap>
              <Button
                v-if="canMigrate"
                type="link"
                :loading="busyIds.includes(record.res_id)"
                :disabled="
                  record.total === record.succeeded ||
                  record.state === 'running'
                "
                @click="restart(record)"
              >
                重新同步
              </Button>
              <Button
                v-if="canMigrate && record.state === 'running'"
                type="link"
                danger
                :disabled="busyIds.includes(record.res_id)"
                @click="operate(record, 'stop')"
              >
                停止
              </Button>
            </Space>
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
