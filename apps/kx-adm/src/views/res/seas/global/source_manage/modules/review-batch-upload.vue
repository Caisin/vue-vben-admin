<script setup lang="ts">
import type { ReviewImport } from '#/api/res/review';
import type { Id, VersionItem } from '#/api/res/versions';

import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

import {
  Alert,
  Button,
  Input,
  InputNumber,
  Modal,
  Progress,
  Table,
  Tag,
} from 'antdv-next';

import { reviewApi as api } from '#/api/res/review';
import { requestErrorMessage } from '#/request-errors';
const props = defineProps<{
  res: Id;
  version: Id;
  items: VersionItem[];
  planned: number;
  disabled: boolean;
}>();
const emit = defineEmits<{ refresh: [] }>();
type Row = {
  file: File;
  seq: number;
  title: string;
  fileId?: Id;
  progress: number;
  error: string;
};
const open = ref(false);
const rows = ref<Row[]>([]);
const busy = ref(false);
const errorText = ref('');
const job = ref<null | ReviewImport>(null);
let alive = true;
let timer: ReturnType<typeof setTimeout> | undefined;
const pending = computed(() =>
  Boolean(
    job.value?.task_run &&
    ['queued', 'retrying', 'running'].includes(job.value.task_run.status),
  ),
);
const issues = computed(() => {
  const seen = new Set<number>();
  const errors: string[] = [];
  for (const row of rows.value) {
    if (!Number.isInteger(row.seq) || row.seq < 1 || row.seq > props.planned)
      errors.push(`${row.file.name}：集数不在已保存的计划范围内`);
    if (seen.has(row.seq)) errors.push(`第 ${row.seq} 集重复，请调整映射`);
    seen.add(row.seq);
    if (props.items.some((i) => Number(i.seq_no) === row.seq))
      errors.push(`第 ${row.seq} 集已有视频，请使用“替换这一集”`);
    if (!row.title.trim()) errors.push(`${row.file.name}：请填写分集标题`);
    if (row.file.size > 512 * 1024 * 1024)
      errors.push(`${row.file.name}：单个视频不能超过 512 MB`);
  }
  return errors;
});
function select(event: Event) {
  const files = [...((event.target as HTMLInputElement).files ?? [])];
  rows.value = files.map((file) => {
    const number = file.name.match(/(?:第\s*)?(\d+)(?:\s*集)?\.[^.]+$/)?.[1];
    const seq = number ? Number(number) : 0;
    return {
      file,
      seq,
      title: seq ? `第 ${seq} 集` : file.name.replace(/\.[^.]+$/, ''),
      progress: 0,
      error: '',
    };
  });
  errorText.value = '';
}
async function refresh() {
  if (timer) clearTimeout(timer);
  try {
    const result = await api.latestImport(props.res, props.version);
    if (!alive) return;
    const old = job.value;
    job.value = result;
    if (
      old &&
      result &&
      (old.results.length !== result.results.length ||
        old.task_run?.status !== result.task_run?.status)
    )
      emit('refresh');
    if (pending.value) timer = setTimeout(() => void refresh(), 2000);
  } catch (error) {
    if (alive)
      errorText.value = requestErrorMessage(
        error,
        '读取登记任务失败，请手动刷新',
      );
  }
}
async function submit() {
  if (
    busy.value ||
    pending.value ||
    issues.value.length > 0 ||
    rows.value.length === 0
  )
    return;
  busy.value = true;
  errorText.value = '';
  try {
    for (const row of rows.value) {
      if (!alive) return;
      if (row.fileId) continue;
      row.error = '';
      try {
        const files = await api.upload(
          props.res,
          props.version,
          row.file,
          (percent) => {
            row.progress = percent;
          },
        );
        row.fileId = files[0]?.file.file_id;
        if (!row.fileId) throw new Error('上传未返回文件');
      } catch (error) {
        row.error = requestErrorMessage(error, '上传失败');
        throw error;
      }
    }
    if (!alive) return;
    const entries: ReviewImport['entries'] = [];
    for (const row of rows.value) {
      if (row.fileId)
        entries.push({
          seq_no: row.seq,
          title: row.title,
          file_id: row.fileId,
          file_name: row.file.name,
        });
    }
    job.value = await api.submitImport(props.res, props.version, entries);
    rows.value = [];
    await refresh();
    emit('refresh');
  } catch (error) {
    if (alive)
      errorText.value = requestErrorMessage(
        error,
        '批量上传失败，已成功的文件可直接重试登记',
      );
  } finally {
    busy.value = false;
  }
}
async function retry() {
  if (!job.value || busy.value || pending.value) return;
  const completed = new Set(
    job.value.results
      .filter((r) => ['skipped', 'succeeded'].includes(r.state))
      .map((r) => r.seq_no),
  );
  const entries = job.value.entries.filter((e) => !completed.has(e.seq_no));
  if (entries.length === 0) return;
  busy.value = true;
  errorText.value = '';
  try {
    job.value = await api.submitImport(props.res, props.version, entries);
    await refresh();
  } catch (error) {
    errorText.value = requestErrorMessage(error, '重试登记失败');
  } finally {
    busy.value = false;
  }
}
onMounted(() => void refresh());
onBeforeUnmount(() => {
  alive = false;
  if (timer) clearTimeout(timer);
});
</script>
<template>
  <Button :disabled="disabled" @click="open = true">
    {{ pending ? '上传登记中…' : '整版 / 补集上传' }}
  </Button>
  <Modal
    v-model:open="open"
    title="批量上传分集"
    :width="950"
    :z-index="1030"
    :footer="null"
    :closable="!busy"
    :mask-closable="!busy"
  >
    <Alert
      message="选择多个视频，核对文件与集数后上传。已有分集不会被覆盖；上传完成后由后台任务登记，登记任务可关闭窗口后继续。"
      type="info"
      class="mb-4"
    />
    <Alert
      v-if="!planned"
      message="请先在工作台保存计划集数"
      type="warning"
      class="mb-3"
    />
    <Alert v-if="errorText" :message="errorText" type="error" class="mb-3" />
    <label class="mb-4 block">选择视频（文件名以集数结尾可自动识别）<input
        class="mt-2 block"
        type="file"
        multiple
        accept=".mp4,.mov,.m4v,.webm,.avi,.mpeg,.mpg"
        :disabled="busy || pending || !planned"
        @change="select"
    /></label>
    <Table
      v-if="rows.length"
      :data-source="rows"
      :row-key="(row: Row) => row.file.name"
      :pagination="{ pageSize: 10 }"
      :columns="[
        { title: '视频文件', key: 'file' },
        { title: '对应集数', key: 'seq', width: 130 },
        { title: '分集标题', key: 'title' },
        { title: '上传进度', key: 'progress', width: 170 },
      ]"
    >
      <template #bodyCell="{ column, record }">
        <span v-if="column.key === 'file'">{{ record.file.name }}</span>
        <InputNumber
          v-if="column.key === 'seq'"
          v-model:value="record.seq"
          :min="1"
          :max="planned"
          :precision="0"
          :disabled="busy"
        />
        <Input
          v-if="column.key === 'title'"
          v-model:value="record.title"
          :maxlength="200"
          :disabled="busy"
        />
        <div v-if="column.key === 'progress'">
          <Progress
            :percent="record.progress"
            :status="record.error ? 'exception' : undefined"
          /><small>{{
            record.error || (record.fileId ? '已上传，等待登记' : '')
          }}</small>
        </div>
      </template>
    </Table>
    <div v-if="issues.length" class="my-3 max-h-40 overflow-auto text-red-600">
      <p v-for="(issue, index) in issues" :key="index">{{ issue }}</p>
    </div>
    <Button
      v-if="rows.length"
      type="primary"
      :disabled="issues.length > 0 || pending"
      :loading="busy"
      @click="submit"
    >
      {{
        rows.some((r) => r.fileId) ? '继续上传并登记' : '确认映射，开始上传'
      }}（{{ rows.length }} 集）
    </Button>
    <section v-if="job" class="mt-5 border-t pt-4">
      <div class="mb-3 flex items-center justify-between">
        <strong>最近一次登记 · {{ job.results.length }} /
          {{ job.entries.length }} 集</strong>
        <div class="flex gap-2">
          <Button :disabled="busy" @click="refresh">刷新进度</Button><Button v-if="!pending" :disabled="busy" @click="retry">
            重试未成功集
          </Button>
        </div>
      </div>
      <Alert
        v-if="job.dispatch_error || job.task_run?.error_message"
        type="error"
        :message="job.dispatch_error || job.task_run?.error_message"
        class="mb-3"
      />
      <p>{{ job.task_run?.message || '等待任务调度' }}</p>
      <Table
        :data-source="job.results"
        row-key="seq_no"
        :pagination="{ pageSize: 10 }"
        :columns="[
          { title: '集数', dataIndex: 'seq_no' },
          { title: '视频文件', dataIndex: 'file_name' },
          { title: '结果', key: 'state' },
          { title: '说明', dataIndex: 'message' },
        ]"
      >
        <template #bodyCell="{ column, record }">
          <Tag
            v-if="column.key === 'state'"
            :color="record.state === 'failed' ? 'red' : 'green'"
          >
            {{
              record.state === 'failed'
                ? '失败'
                : record.state === 'skipped'
                  ? '已存在'
                  : '已登记'
            }}
          </Tag>
        </template>
      </Table>
    </section>
  </Modal>
</template>
