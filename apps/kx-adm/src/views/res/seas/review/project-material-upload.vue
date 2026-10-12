<script setup lang="ts">
import type { DeliveryFile, DeliveryView } from '#/api/res/delivery';
import type { Id } from '#/api/res/versions';

import { computed, ref } from 'vue';

import {
  Alert,
  Button,
  Input,
  InputNumber,
  Modal,
  Progress,
  Select,
  Table,
} from 'antdv-next';

import { deliveryApi } from '#/api/res/delivery';
import { requestErrorMessage } from '#/request-errors';

import { deliveryEpisode } from './delivery-files';
import NativeUpload from './native-upload.vue';
const props = defineProps<{
  scope: Id;
  version: Id;
  view: DeliveryView;
  planned: number;
}>();
const emit = defineEmits<{ changed: [] }>();
const open = ref(false);
const kind = ref('prompt');
const entries = ref<(DeliveryFile & { seq: number })[]>([]);
const busy = ref(false);
const errorText = ref('');
const completed = ref(0);
const reason = ref('目录批量提交项目资料');
const kinds = [
  { value: 'prompt', label: '提示词（前6集）' },
  { value: 'project_image', label: '工程截图（前6集）' },
  { value: 'srt', label: 'SRT 字幕' },
];
const maximum = computed(() =>
  kind.value === 'srt' ? props.planned : Math.min(props.planned, 6),
);
const valid = computed(
  () =>
    entries.value.length > 0 &&
    entries.value.every((f) => f.seq >= 1 && f.seq <= maximum.value) &&
    !!reason.value.trim(),
);
function uploaded(files: DeliveryFile[]) {
  completed.value = 0;
  entries.value = files.map((file) => {
    const seq = deliveryEpisode(file.name);
    return { ...file, seq };
  });
}
async function submit() {
  if (busy.value || !valid.value) return;
  busy.value = true;
  errorText.value = '';
  const groups = [...new Set(entries.value.map((f) => f.seq))].toSorted(
    (a, b) => a - b,
  );
  try {
    for (let i = completed.value; i < groups.length; i++) {
      const seq = groups[i];
      const current = await deliveryApi.materials(props.scope);
      const old = current.view.slots.find(
        (s) => s.kind === kind.value && s.seq_no === seq,
      )?.asset;
      const files = [...(old?.files || [])];
      for (const file of entries.value.filter((f) => f.seq === seq))
        if (!files.some((f) => String(f.file_id) === String(file.file_id)))
          files.push({ file_id: file.file_id, name: file.name });
      if (files.length !== old?.files.length)
        await deliveryApi.save(props.scope, props.version, {
          expected_revision: current.view.revision,
          kind: kind.value,
          seq_no: Number(seq),
          files,
          text: old?.text || '',
          reason: reason.value,
          restore_from: null,
        });
      completed.value = i + 1;
    }
    emit('changed');
    open.value = false;
  } catch (error) {
    errorText.value = requestErrorMessage(
      error,
      '提交失败，已完成的集数保留，可以重试剩余项',
    );
    emit('changed');
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <Button
    v-access:code="'api:res.delivery.assets.save'"
    :disabled="!view.can_edit"
    @click="
      open = true;
      entries = [];
      completed = 0;
      errorText = '';
    "
  >
    项目资料目录上传
  </Button>
  <Modal
    v-model:open="open"
    title="按目录提交项目资料"
    get-container="body"
    :width="900"
    :footer="null"
    :closable="!busy"
    :mask-closable="false"
    :keyboard="!busy"
  >
    <Alert
      type="info"
      message="资料属于项目，与成片、无字幕版和无音乐版共享。选择目录后核对文件对应集数；提交会追加文件，替换及历史恢复可在项目资料详情操作。"
      class="mb-4"
    />
    <Select
      v-model:value="kind"
      :options="kinds"
      class="w-full"
      :disabled="busy"
      @change="
        entries = [];
        completed = 0;
      "
    />
    <NativeUpload
      :key="kind"
      :scope="scope"
      :version="version"
      :kind="kind"
      :seq="0"
      :disabled="busy"
      @busy="busy = $event"
      @uploaded="uploaded"
      @cleared="
        entries = [];
        completed = 0;
      "
    />
    <Table
      :data-source="entries"
      row-key="file_id"
      :pagination="{ pageSize: 20 }"
      :columns="[
        { title: '相对文件名', dataIndex: 'name' },
        { title: '对应集数', key: 'seq' },
        { title: '操作', key: 'action' },
      ]"
    >
      <template #bodyCell="{ column, record }">
        <Button
          v-if="column.key === 'action'"
          type="link"
          danger
          :disabled="busy || completed > 0"
          @click="entries = entries.filter((f) => f.file_id !== record.file_id)"
        >
          不提交此文件
        </Button>
        <InputNumber
          v-if="column.key === 'seq'"
          v-model:value="record.seq"
          :min="1"
          :max="maximum"
          :precision="0"
          :disabled="busy || completed > 0"
        />
      </template>
    </Table>
    <Input
      v-model:value="reason"
      placeholder="本次上传说明"
      :disabled="busy"
      class="my-3"
    />
    <Progress
      v-if="completed"
      :percent="
        Math.round((completed * 100) / new Set(entries.map((f) => f.seq)).size)
      "
    />
    <Alert v-if="errorText" type="error" :message="errorText" class="my-3" />
    <Button type="primary" :disabled="!valid" :loading="busy" @click="submit">
      {{ completed ? '继续提交剩余资料' : '确认集数并提交资料' }}
    </Button>
  </Modal>
</template>
