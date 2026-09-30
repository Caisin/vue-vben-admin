<script setup lang="ts">
import type { DownloadJob } from './index';

import type { DownloadTask, DownloadTaskItem } from '#/api/res/downloads';

import { computed, onMounted, onUnmounted, ref, watch } from 'vue';

import { Alert, Button, Modal, Progress, Table, Tag } from 'antdv-next';

import { ResDownloadApi } from '#/api/res/downloads';
import { uploadErrorMessage } from '#/components/file-picker/internal/upload-error';

import { desktop, desktopDownloads } from './index';

const open = defineModel<boolean>('open', { required: true });
const jobs = ref<DownloadJob[]>([]);
const history = ref<DownloadTask[]>([]);
const detailItems = ref<DownloadTaskItem[]>([]);
const detailPage = ref(1);
const detailTotal = ref(0);
const detailOpen = ref(false);
const selectedTask = ref<DownloadTask>();
const loading = ref(false);
const errorText = ref('');
const busyJob = ref('');
const lastUpdatedAt = ref(0);
const activeServerTasks = computed(
  () =>
    history.value.filter((task) =>
      ['downloading', 'pending'].includes(task.status),
    ).length,
);
const activeLocalJobs = computed(
  () => jobs.value.filter((job) => job.status === '下载中').length,
);
const columns = [
  { title: '资源', key: 'resource', width: 150 },
  { title: '保存位置', key: 'directory', width: 250 },
  { title: '文件', key: 'file', width: 72 },
  { title: '下载进度', key: 'progress', width: 170 },
  { title: '状态', key: 'status', width: 90 },
  { title: '错误信息', key: 'error', width: 170 },
  { title: '操作', key: 'action', width: 190 },
] as any[];
const historyColumns = [
  { title: '剧名', dataIndex: 'res_name', key: 'res_name', width: 220 },
  { title: '版本', dataIndex: 'version_name', key: 'version_name', width: 180 },
  { title: '下载进度', key: 'progress', width: 220 },
  { title: '状态', key: 'status', width: 90 },
  { title: '开始时间', key: 'started_at', width: 150 },
  { title: '完成时间', key: 'finished_at', width: 150 },
  { title: '失败原因', dataIndex: 'error', key: 'error', width: 180 },
  { title: '操作', key: 'action', width: 90 },
] as any[];
const localColumns = [
  { title: '文件', dataIndex: 'fileName', key: 'fileName' },
  { title: '状态', dataIndex: 'status', key: 'status' },
  { title: '失败原因', dataIndex: 'error', key: 'error' },
];
const detailColumns = [
  { title: '失败原因', dataIndex: 'error', key: 'error' },
  { title: '集数', dataIndex: 'seq_no', key: 'seq_no' },
  { title: '章节', dataIndex: 'item_name', key: 'item_name' },
  { title: '文件', dataIndex: 'file_name', key: 'file_name' },
  { title: '状态', dataIndex: 'status', key: 'status' },
  { title: '完成时间', key: 'finished_at' },
] as any[];

let refreshing = false;
async function refresh(showLoading = true) {
  if (!open.value || refreshing) return;
  refreshing = true;
  if (showLoading) {
    loading.value = true;
    errorText.value = '';
  }
  try {
    if (desktop) jobs.value = await desktopDownloads.list();
    const page = await ResDownloadApi.mineTasks({ page: 1, size: 50 });
    history.value = page.items;
    lastUpdatedAt.value = Date.now();
    if (selectedTask.value) {
      selectedTask.value =
        page.items.find((task) => task.id === selectedTask.value?.id) ??
        selectedTask.value;
    }
  } catch (error) {
    if (showLoading || history.value.length === 0) {
      errorText.value = uploadErrorMessage(error, '读取下载记录失败');
    }
  } finally {
    if (showLoading) loading.value = false;
    refreshing = false;
  }
}

function taskProgress(task: DownloadTask) {
  return task.total_count
    ? Math.floor((task.downloaded_count / task.total_count) * 100)
    : 0;
}

async function showDetails(task: DownloadTask, page = 1) {
  selectedTask.value = task;
  detailOpen.value = true;
  detailPage.value = page;
  const result = await ResDownloadApi.mineTaskItems(task.id, {
    page,
    size: 20,
  });
  detailItems.value = result.items;
  detailTotal.value = result.total;
}

function progress(job: DownloadJob) {
  const total = job.files.reduce(
    (sum, file) => sum + Number(file.size || 0),
    0,
  );
  const bytes = job.files.reduce(
    (sum, file) => sum + Number(file.bytes || 0),
    0,
  );
  return total > 0 ? Math.min(100, Math.floor((bytes / total) * 100)) : 0;
}

function completedFiles(job: DownloadJob) {
  return job.files.filter((file) => ['已完成', '已跳过'].includes(file.status))
    .length;
}

function statusColor(status: string) {
  if (['completed', '已完成'].includes(status)) return 'success';
  if (['downloading', '下载中'].includes(status)) return 'processing';
  if (['failed', '下载失败'].includes(status)) return 'error';
  if (['cancelled', '已暂停'].includes(status)) return 'warning';
  return 'default';
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    cancelled: '已取消',
    completed: '已完成',
    downloading: '下载中',
    failed: '失败',
    pending: '等待中',
  };
  return labels[status] ?? status ?? '未知';
}

async function act(job: DownloadJob, action: () => Promise<unknown>) {
  if (busyJob.value) return;
  busyJob.value = job.id;
  errorText.value = '';
  try {
    await action();
    await refresh();
  } catch (error) {
    errorText.value = uploadErrorMessage(error, '下载操作失败');
  } finally {
    busyJob.value = '';
  }
}

async function pause(job: DownloadJob) {
  await act(job, () => desktopDownloads.pause(job.id));
}

async function resume(job: DownloadJob) {
  await act(job, () => desktopDownloads.resume(job.id));
}

function overwrite(job: DownloadJob) {
  Modal.confirm({
    title: '覆盖本地文件并重新下载？',
    content: `将重新下载此任务的全部文件，覆盖目录“${job.targetDirectory}”中的对应文件。普通继续下载会保留已有文件。`,
    okText: '覆盖重新下载',
    cancelText: '取消',
    okButtonProps: { danger: true },
    onOk: () => act(job, () => desktopDownloads.resume(job.id, true)),
  });
}

function date(value: number) {
  return value ? new Date(Number(value) * 1000).toLocaleString() : '—';
}

let stop: (() => void) | undefined;
let refreshTimer: ReturnType<typeof setInterval> | undefined;
function stopPolling() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = undefined;
}

function startPolling() {
  stopPolling();
  refreshTimer = setInterval(() => void refresh(false), 2000);
}

onMounted(async () => {
  if (desktop) {
    stop = await desktopDownloads.listen((job) => {
      const index = jobs.value.findIndex((item) => item.id === job.id);
      if (index === -1) jobs.value.unshift(job);
      else jobs.value.splice(index, 1, job);
    });
  }
  await refresh();
  if (open.value) startPolling();
});

onUnmounted(() => {
  stop?.();
  stopPolling();
});

watch(open, (value) => {
  if (value) {
    void refresh();
    startPolling();
  } else {
    stopPolling();
  }
});
</script>

<template>
  <Modal
    v-model:open="open"
    class="download-history-modal"
    :footer="null"
    title="下载中心"
    width="min(1160px, calc(100vw - 32px))"
  >
    <Alert
      v-if="!desktop"
      type="warning"
      message="资源文件只能在 Tauri 桌面端下载。"
      class="mb-4"
    />
    <Alert v-if="errorText" type="error" :message="errorText" class="mb-4" />
    <div class="download-history-intro">
      <div>
        <div class="download-history-title">我的下载记录</div>
        <div class="download-history-description">
          本地下载实时更新，服务端任务每 2
          秒同步一次；展开本机任务可查看文件明细。
        </div>
      </div>
      <Button size="small" :loading="loading" @click="refresh()">
        刷新记录
      </Button>
    </div>
    <div class="download-history-summary">
      <div class="summary-card">
        <span class="summary-label">本机任务</span>
        <strong>{{ jobs.length }}</strong>
        <span>{{
          activeLocalJobs ? `${activeLocalJobs} 个进行中` : '暂无进行中任务'
        }}</span>
      </div>
      <div class="summary-card">
        <span class="summary-label">服务端任务</span>
        <strong>{{ history.length }}</strong>
        <span>{{
          activeServerTasks ? `${activeServerTasks} 个同步中` : '状态已同步'
        }}</span>
      </div>
      <div class="summary-card summary-card-muted">
        <span class="summary-label">最近同步</span>
        <strong>{{ lastUpdatedAt ? date(lastUpdatedAt / 1000) : '—' }}</strong>
        <span>打开窗口期间自动刷新</span>
      </div>
    </div>

    <section class="download-history-section">
      <div class="download-history-section-header">
        <div>
          <h3>本机下载任务</h3>
          <p>下载到当前电脑的文件，可暂停、继续或覆盖重下。</p>
        </div>
        <Tag color="blue">{{ jobs.length }} 个任务</Tag>
      </div>
      <Table
        class="download-history-table"
        :loading="loading"
        :columns="columns"
        :data-source="jobs"
        :pagination="false"
        :scroll="{ x: 1092, y: 260 }"
        row-key="id"
      >
        <template #bodyCell="{ column, record }">
          <div v-if="column.key === 'resource'" class="resource-cell">
            <strong>资源 #{{ record.resId }}</strong>
            <span>版本 #{{ record.versionId }}</span>
          </div>
          <div
            v-else-if="column.key === 'directory'"
            class="directory-cell"
            :title="record.targetDirectory"
          >
            {{ record.targetDirectory }}
          </div>
          <div v-else-if="column.key === 'file'" class="file-count-cell">
            <strong>{{ record.files.length }}</strong>
            <span>个文件</span>
          </div>
          <div v-else-if="column.key === 'progress'" class="progress-cell">
            <div class="progress-line">
              <Progress
                :percent="progress(record)"
                :show-info="false"
                size="small"
              />
              <strong>{{ progress(record) }}%</strong>
            </div>
            <span>{{ completedFiles(record) }} /
              {{ record.files.length }} 个文件</span>
          </div>
          <Tag
            v-else-if="column.key === 'status'"
            :color="statusColor(record.status)"
          >
            {{ record.status }}
          </Tag>
          <span
            v-else-if="column.key === 'error'"
            class="error-cell"
            :title="record.error || undefined"
          >
            {{ record.error || '—' }}
          </span>
          <div v-else-if="column.key === 'action'" class="action-cell">
            <Button
              v-if="record.status === '下载中'"
              :disabled="!!busyJob"
              size="small"
              type="link"
              @click="pause(record)"
            >
              暂停
            </Button>
            <template v-else>
              <Button
                :disabled="!!busyJob"
                size="small"
                type="link"
                @click="resume(record)"
              >
                {{ record.status === '已完成' ? '检查补下载' : '继续下载' }}
              </Button>
              <Button
                :disabled="!!busyJob"
                danger
                size="small"
                type="link"
                @click="overwrite(record)"
              >
                覆盖重下
              </Button>
            </template>
          </div>
        </template>
        <template #expandedRowRender="{ record }">
          <Table
            :columns="localColumns"
            :data-source="record.files"
            :pagination="{ pageSize: 20 }"
            row-key="fileId"
          >
            <template #bodyCell="{ column, record: file }">
              <span
                v-if="column.key === 'error'"
                class="whitespace-pre-wrap break-all text-destructive"
                >{{ file.error || '—' }}</span>
            </template>
          </Table>
        </template>
      </Table>
    </section>

    <section class="download-history-section">
      <div class="download-history-section-header">
        <div>
          <h3>服务端下载历史</h3>
          <p>服务端记录每个文件的下载结果，进度会自动同步。</p>
        </div>
        <Tag :color="activeServerTasks ? 'processing' : 'default'">
          {{ activeServerTasks ? `${activeServerTasks} 个进行中` : '已同步' }}
        </Tag>
      </div>
      <Table
        class="download-history-table"
        :columns="historyColumns"
        :data-source="history"
        :pagination="false"
        :scroll="{ x: 1250, y: 260 }"
        row-key="id"
      >
        <template #bodyCell="{ column, record }">
          <div v-if="column.key === 'progress'" class="progress-cell">
            <div class="progress-line">
              <Progress
                :percent="taskProgress(record)"
                :show-info="false"
                size="small"
                :status="record.status === 'failed' ? 'exception' : undefined"
              />
              <strong>{{ taskProgress(record) }}%</strong>
            </div>
            <span>
              {{ record.downloaded_count }} / {{ record.total_count }} 个文件
            </span>
          </div>
          <Tag
            v-else-if="column.key === 'status'"
            :color="statusColor(record.status)"
          >
            {{ statusLabel(record.status) }}
          </Tag>
          <span v-else-if="column.key === 'started_at'">{{
            date(record.started_at)
          }}</span>
          <span v-else-if="column.key === 'finished_at'">{{
            date(record.finished_at)
          }}</span>
          <span
            v-else-if="column.key === 'error'"
            class="error-cell"
            :title="record.error || undefined"
          >
            {{ record.error || '—' }}
          </span>
          <Button
            v-else-if="column.key === 'action'"
            size="small"
            type="link"
            @click="showDetails(record)"
          >
            查看章节
          </Button>
        </template>
      </Table>
    </section>
  </Modal>
  <Modal
    v-model:open="detailOpen"
    :title="`${selectedTask?.res_name ?? ''} · ${selectedTask?.version_name ?? ''} · 下载章节`"
    :footer="null"
    width="900px"
  >
    <Table
      :columns="detailColumns"
      :data-source="detailItems"
      :pagination="{
        current: detailPage,
        pageSize: 20,
        total: detailTotal,
        showSizeChanger: false,
        onChange: (page: number) =>
          selectedTask && showDetails(selectedTask, page),
      }"
      row-key="id"
    >
      <template #bodyCell="{ column, record }">
        <span v-if="column.key === 'finished_at'">{{
          date(record.finished_at)
        }}</span>
        <Tag v-else-if="column.key === 'status'">{{ record.status }}</Tag>
      </template>
    </Table>
  </Modal>
</template>

<style scoped>
.download-history-modal :deep(.ant-modal-body) {
  max-height: calc(100vh - 150px);
  padding: 20px 24px 24px;
  overflow-y: auto;
}

.download-history-intro,
.download-history-section-header,
.progress-line {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
}

.download-history-intro {
  padding: 2px 0 20px;
}

.download-history-title {
  font-size: 18px;
  font-weight: 650;
  line-height: 1.4;
}

.download-history-description,
.download-history-section-header p,
.summary-card > span:last-child,
.progress-cell > span,
.resource-cell > span,
.file-count-cell > span {
  font-size: 12px;
  line-height: 1.5;
  color: hsl(var(--muted-foreground));
}

.download-history-description {
  margin-top: 4px;
}

.download-history-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 24px;
}

.summary-card {
  display: flex;
  flex-direction: column;
  gap: 3px;
  justify-content: center;
  min-height: 86px;
  padding: 14px 16px;
  background: hsl(var(--muted) / 20%);
  border: 1px solid hsl(var(--border));
  border-radius: 10px;
}

.summary-card strong {
  font-size: 22px;
  line-height: 1.2;
}

.summary-label {
  font-size: 12px;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.summary-card-muted strong {
  font-size: 14px;
}

.download-history-section + .download-history-section {
  margin-top: 28px;
}

.download-history-section-header {
  margin-bottom: 10px;
}

.download-history-section-header h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 650;
  line-height: 1.5;
}

.download-history-section-header p {
  margin: 3px 0 0;
}

.resource-cell,
.file-count-cell,
.progress-cell {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.resource-cell strong,
.file-count-cell strong,
.progress-line strong {
  font-size: 13px;
  color: hsl(var(--foreground));
}

.directory-cell,
.error-cell {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.progress-line {
  justify-content: flex-start;
}

.progress-line :deep(.ant-progress) {
  flex: 1;
  min-width: 74px;
}

.action-cell {
  display: flex;
  flex-wrap: wrap;
  gap: 0 4px;
}

.download-history-table :deep(.ant-table-thead > tr > th),
.download-history-table :deep(.ant-table-tbody > tr > td) {
  padding: 12px 10px;
  vertical-align: middle;
}

@media (max-width: 700px) {
  .download-history-modal :deep(.ant-modal-body) {
    padding: 16px;
  }

  .download-history-intro,
  .download-history-section-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .download-history-summary {
    grid-template-columns: 1fr;
  }
}
</style>
