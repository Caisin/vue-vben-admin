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

import NativeUpload from './native-upload.vue';
const props = defineProps<{
  res: Id;
  version: Id;
  items: VersionItem[];
  planned: number;
  disabled: boolean;
}>();
const emit = defineEmits<{ refresh: [] }>();
const open = ref(false);
const busy = ref(false);
const errorText = ref('');
const entries = ref<ReviewImport['entries']>([]);
const task = ref<ReviewImport>();
let timer: ReturnType<typeof setTimeout> | undefined;
const target = computed(
  () =>
    Array.from({ length: props.planned }, (_, i) => i + 1).find(
      (n) => !props.items.some((i) => Number(i.seq_no) === n),
    ) ?? 1,
);
const valid = computed(
  () =>
    entries.value.length > 0 &&
    entries.value.every(
      (e) =>
        e.seq_no > 0 &&
        e.seq_no <= props.planned &&
        e.title.trim() &&
        !props.items.some((i) => Number(i.seq_no) === e.seq_no),
    ) &&
    new Set(entries.value.map((e) => e.seq_no)).size === entries.value.length,
);
function uploaded(files: { file_id: number; name: string }[]) {
  entries.value = files.map((f) => {
    const seq = Number(
      f.name.replace(/\.[^.]+$/, '').match(/(\d+)\D*$/)?.[1] || 0,
    );
    return {
      seq_no: seq,
      title: seq ? `第${seq}集` : '',
      file_id: f.file_id,
      file_name: f.name,
    };
  });
}
async function refresh() {
  try {
    task.value =
      (await reviewApi.latestImport(props.res, props.version)) ?? undefined;
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
  if (!valid.value) return;
  busy.value = true;
  errorText.value = '';
  try {
    task.value = await reviewApi.submitImport(
      props.res,
      props.version,
      entries.value,
    );
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
onBeforeUnmount(() => clearTimeout(timer));
</script>
<template>
  <Button :disabled="disabled" @click="open = true">成片整版 / 补集上传</Button><Modal
    v-model:open="open"
    title="成片整版 / 补集上传"
    width="min(960px,96vw)"
    :footer="null"
    :closable="!busy"
    :mask-closable="!busy"
  >
    <Alert
      type="info"
      message="客户端多选视频上传后，核对集数再提交后台登记；已有分集不覆盖，替换请进入逐集审片。每批最多30个文件，可分批补集。"
    /><NativeUpload
      :scope="res"
      :version="version"
      kind="film"
      :seq="target"
      @busy="busy = $event"
      @uploaded="uploaded"
    /><Table
      :data-source="entries"
      row-key="file_id"
      :pagination="false"
      :columns="[
        { title: '文件', dataIndex: 'file_name' },
        { title: '集数', key: 'seq' },
        { title: '标题', key: 'title' },
      ]"
    >
      <template #bodyCell="{ column, record }">
        <InputNumber
          v-if="column.key === 'seq'"
          v-model:value="record.seq_no"
          :min="1"
          :max="planned"
          :precision="0"
          :disabled="busy"
        /><Input
          v-else-if="column.key === 'title'"
          v-model:value="record.title"
          :maxlength="200"
          :disabled="busy"
        />
      </template>
</Table><Alert
      v-if="entries.length && !valid"
      type="warning"
      message="请填写计划内、不重复且尚未上传的集数与标题。"
      class="mt-3"
    /><Button
      class="mt-3"
      type="primary"
      :loading="busy"
      :disabled="!valid"
      @click="submit"
    >
      提交分集登记
</Button><Button v-if="task" class="ml-2" @click="refresh">刷新登记结果</Button>
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
