<script setup lang="ts">
import type { DownloadJob } from './index';

import type { DownloadTask, DownloadTaskItem } from '#/api/res/downloads';

import { onMounted, onUnmounted, ref, watch } from 'vue';

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
const columns = [
  { title: '资源', dataIndex: 'resId', key: 'resId' },
  { title: '保存目录', dataIndex: 'targetDirectory', key: 'targetDirectory' },
  { title: '文件', key: 'file' },
  { title: '进度', key: 'progress' },
  { title: '状态', dataIndex: 'status', key: 'status' },
  { title: '失败原因', dataIndex: 'error', key: 'error' },
  { title: '操作', key: 'action' },
] as any[];
const historyColumns = [
  { title: '剧名', dataIndex: 'res_name', key: 'res_name' },
  { title: '版本', dataIndex: 'version_name', key: 'version_name' },
  { title: '进度', key: 'progress' },
  { title: '开始时间', key: 'started_at' },
  { title: '完成时间', key: 'finished_at' },
  { title: '失败原因', dataIndex: 'error', key: 'error' },
  { title: '操作', key: 'action' },
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

async function refresh() {
  if (!open.value) return;
  loading.value = true;
  errorText.value = '';
  try {
    if (desktop) jobs.value = await desktopDownloads.list();
    const page = await ResDownloadApi.mineTasks({ page: 1, size: 50 });
    history.value = page.items;
  } catch (error) {
    errorText.value = uploadErrorMessage(error, '读取下载记录失败');
  } finally {
    loading.value = false;
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
onMounted(async () => {
  if (desktop)
    stop = await desktopDownloads.listen((job) => {
      const index = jobs.value.findIndex((item) => item.id === job.id);
      if (index === -1) jobs.value.unshift(job);
      else jobs.value.splice(index, 1, job);
    });
  await refresh();
});
onUnmounted(() => stop?.());
watch(open, (value) => {
  if (value) void refresh();
});
</script>

<template>
  <Modal v-model:open="open" title="我的下载记录" :footer="null" width="980px">
    <Alert
      v-if="!desktop"
      type="warning"
      message="资源文件只能在 Tauri 桌面端下载。"
      class="mb-3"
    />
    <Alert v-if="errorText" type="error" :message="errorText" class="mb-3" />
    <p class="mb-3 text-muted-foreground">
      默认跳过本地已有文件；展开任务可查看各集状态和失败原因。
    </p>
    <div class="mb-3 flex items-center justify-between">
      <strong>本机下载任务</strong>
      <Button :loading="loading" @click="refresh">刷新</Button>
    </div>
    <Table
      :loading="loading"
      :columns="columns"
      :data-source="jobs"
      :pagination="false"
      row-key="id"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'file'">
          {{ record.files.length }} 个文件
        </template>
        <Progress
          v-else-if="column.key === 'progress'"
          :percent="progress(record)"
          size="small"
        />
        <Tag v-else-if="column.key === 'status'">{{ record.status }}</Tag>
        <template v-else-if="column.key === 'error'">
          <span class="whitespace-pre-wrap break-all text-destructive">{{
            record.error || '—'
          }}</span>
        </template>
        <template v-else-if="column.key === 'action'">
          <Button
            v-if="record.status === '下载中'"
            :disabled="!!busyJob"
            type="link"
            @click="pause(record)"
          >
            暂停
          </Button>
          <template v-else>
            <Button :disabled="!!busyJob" type="link" @click="resume(record)">
              {{ record.status === '已完成' ? '检查并补下载' : '继续' }}
            </Button>
            <Button
              :disabled="!!busyJob"
              type="link"
              danger
              @click="overwrite(record)"
            >
              覆盖重新下载
            </Button>
          </template>
        </template>
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
    <div class="mb-3 mt-6"><strong>服务端下载历史</strong></div>
    <Table
      :columns="historyColumns"
      :data-source="history"
      :pagination="false"
      row-key="id"
    >
      <template #bodyCell="{ column, record }">
        <Progress
          v-if="column.key === 'progress'"
          :percent="taskProgress(record)"
          size="small"
        />
        <span v-else-if="column.key === 'started_at'">{{
          date(record.started_at)
        }}</span>
        <span v-else-if="column.key === 'finished_at'">{{
          date(record.finished_at)
        }}</span>
        <Button
          v-else-if="column.key === 'action'"
          type="link"
          @click="showDetails(record)"
        >
          查看章节
        </Button>
      </template>
    </Table>
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
