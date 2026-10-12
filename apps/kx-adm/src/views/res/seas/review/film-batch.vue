<script setup lang="ts">
import type { ReviewImport } from '#/api/res/review';
import type { Id, VersionItem } from '#/api/res/versions';

import { computed, onBeforeUnmount, ref } from 'vue';

import {
  Alert,
  Button,
  Input,
  InputNumber,
  Modal,
  Table,
  Tag,
} from 'antdv-next';

import { reviewApi } from '#/api/res/review';
import { requestErrorMessage } from '#/request-errors';

import { deliveryEpisode } from './delivery-files';
import NativeUpload from './native-upload.vue';
const props = defineProps<{ res: Id }>();
const emit = defineEmits<{ refresh: [] }>();
const selection = ref<{
  id: Id;
  name: string;
  items: VersionItem[];
  planned: number;
}>();
const loading = ref(false);
let alive = true;
let generation = 0;
const open = ref(false);
const busy = ref(false);
const errorText = ref('');
const entries = ref<ReviewImport['entries']>([]);
const task = ref<ReviewImport>();
let timer: ReturnType<typeof setTimeout> | undefined;
const target = computed(
  () =>
    Array.from({ length: selection.value?.planned ?? 0 }, (_, i) => i + 1).find(
      (n) =>
        !(selection.value?.items ?? []).some((i) => Number(i.seq_no) === n),
    ) ?? 1,
);
const valid = computed(
  () =>
    entries.value.length > 0 &&
    entries.value.every(
      (e) =>
        e.seq_no > 0 &&
        e.seq_no <= (selection.value?.planned ?? 0) &&
        e.title.trim() &&
        !(selection.value?.items ?? []).some(
          (i) => Number(i.seq_no) === e.seq_no,
        ),
    ) &&
    new Set(entries.value.map((e) => e.seq_no)).size === entries.value.length,
);
function uploaded(files: { file_id: number; name: string }[]) {
  entries.value = files.map((f) => {
    const seq = deliveryEpisode(f.name);
    return {
      seq_no: seq,
      title: seq ? `第${seq}集` : '',
      file_id: f.file_id,
      file_name: f.name,
    };
  });
}
async function refresh() {
  if (!alive || !selection.value) return;
  clearTimeout(timer);
  const id = selection.value.id;
  try {
    const result = await reviewApi.latestImport(props.res, id);
    if (!alive || String(selection.value?.id) !== String(id)) return;
    task.value = result ?? undefined;
    emit('refresh');
    if (
      task.value?.task_run &&
      ['pending', 'queued', 'running'].includes(task.value.task_run.status)
    )
      timer = setTimeout(refresh, 3000);
  } catch (error) {
    errorText.value = requestErrorMessage(error, '读取登记任务失败，请重试');
  }
}
async function submit() {
  if (!selection.value || !valid.value || busy.value || loading.value) return;
  busy.value = true;
  errorText.value = '';
  try {
    task.value = await reviewApi.submitImport(
      props.res,
      selection.value.id,
      entries.value,
    );
    entries.value = [];
    await refresh();
  } catch (error) {
    errorText.value = requestErrorMessage(
      error,
      '登记失败，已上传文件保留，可重试',
    );
  } finally {
    busy.value = false;
  }
}
async function openDirectory(id: Id) {
  if (busy.value || loading.value) return;
  const ticket = ++generation;
  open.value = true;
  loading.value = true;
  selection.value = undefined;
  entries.value = [];
  task.value = undefined;
  errorText.value = '';
  clearTimeout(timer);
  try {
    const view = await reviewApi.detail(props.res, id);
    if (!alive || ticket !== generation) return;
    const version = view.detail.version;
    if (
      !view.can_edit ||
      !['draft', 'reviewing'].includes(version.review_state)
    ) {
      throw new Error('此视频版本不可上传；定稿版本请先复制后修改');
    }
    if (Number(version.planned_episodes) < 1)
      throw new Error('请先设置计划集数');
    selection.value = {
      id: version.id,
      name: version.name,
      items: view.detail.items,
      planned: Number(version.planned_episodes),
    };
  } catch (error) {
    if (alive && ticket === generation)
      errorText.value = requestErrorMessage(error, '打开目录上传失败');
  } finally {
    if (ticket === generation) loading.value = false;
  }
}
defineExpose({ openDirectory });
onBeforeUnmount(() => {
  alive = false;
  generation++;
  clearTimeout(timer);
});
</script>
<template>
  <Modal
    v-model:open="open"
    :title="selection ? `${selection.name} · 目录上传` : '视频版本目录上传'"
    get-container="body"
    width="min(960px,96vw)"
    :footer="null"
    :closable="!busy && !loading"
    :mask-closable="false"
    :keyboard="!busy && !loading"
  >
    <Alert
      type="info"
      message="扫描目录后先移除不需要的文件、设置并发，再确认本地上传。上传成功后核对集数并提交登记；已有分集不覆盖，替换请进入逐集审片。"
    />
    <p v-if="loading">正在检查目标版本…</p>
    <NativeUpload
      v-if="open && selection"
      :key="String(selection.id)"
      auto-pick-directory
      :scope="res"
      :version="selection.id"
      kind="film"
      :seq="target"
      @busy="busy = $event"
      @uploaded="uploaded"
      @cleared="entries = []"
    />
    <Table
      :data-source="entries"
      row-key="file_id"
      :pagination="false"
      :columns="[
        { title: '文件', dataIndex: 'file_name' },
        { title: '集数', key: 'seq' },
        { title: '标题', key: 'title' },
        { title: '操作', key: 'action', width: 80 },
      ]"
    >
      <template #bodyCell="{ column, record }">
        <InputNumber
          v-if="column.key === 'seq'"
          v-model:value="record.seq_no"
          :min="1"
          :max="selection?.planned || 1"
          :precision="0"
          :disabled="busy"
        />
        <Button
          v-if="column.key === 'action'"
          type="link"
          danger
          :disabled="busy"
          @click="entries = entries.filter((e) => e.file_id !== record.file_id)"
        >
          不提交此文件
        </Button>
        <Input
          v-else-if="column.key === 'title'"
          v-model:value="record.title"
          :maxlength="200"
          :disabled="busy"
        />
      </template>
    </Table>
    <Alert
      v-if="entries.length && !valid"
      type="warning"
      message="请填写计划内、不重复且尚未上传的集数与标题。"
      class="mt-3"
    />
    <Button
      class="mt-3"
      type="primary"
      :loading="busy"
      :disabled="!valid || loading"
      @click="submit"
      v-access:code="'api:res.review.imports.submit'"
    >
      提交分集登记
    </Button>
    <Button v-if="task" class="ml-2" @click="refresh">刷新登记结果</Button>
    <div v-if="task" class="mt-3">
      <Tag>{{ task.task_run?.status || '等待调度' }}</Tag>
      <p v-if="task.dispatch_error">{{ task.dispatch_error }}</p>
      <p v-for="r in task.results" :key="r.seq_no">
        第{{ r.seq_no }}集 · {{ r.state }} · {{ r.message }}
      </p>
    </div>
    <Alert v-if="errorText" class="mt-3" type="error" :message="errorText" />
  </Modal>
</template>
