<script setup lang="ts">
import type { Evidence, SourcePage, WriterMessage } from '#/api/vestige/writer';

import { onBeforeUnmount, ref, watch } from 'vue';

import { Alert, Button, Modal, Spin } from 'antdv-next';

import { WriterApi } from '#/api/vestige/writer';
import { requestErrorMessage } from '#/request-errors';
const props = defineProps<{
  open: boolean;
  roleId: string;
  evidence?: Evidence;
  sourceId?: string;
}>();
const emit = defineEmits<{ 'update:open': [boolean] }>();
const source = ref<SourcePage>();
const feedback = ref<WriterMessage>();
const loading = ref(false);
const errorText = ref('');
const offset = ref(0);
let generation = 0;
async function load(start = 0) {
  const current = ++generation;
  loading.value = true;
  errorText.value = '';
  source.value = undefined;
  feedback.value = undefined;
  try {
    if (props.evidence?.message_id) {
      const result = await WriterApi.messages(
        props.roleId,
        0,
        props.evidence.message_id,
      );
      if (current === generation) {
        feedback.value = result.messages[0];
        if (!feedback.value) errorText.value = '原始反馈已不可用';
      }
    } else {
      const id = props.sourceId || props.evidence?.source_id;
      if (!id) throw new Error('缺少来源');
      const result = await WriterApi.source(
        props.roleId,
        id,
        start,
        props.evidence?.segment_id,
      );
      if (current === generation) {
        source.value = result;
        offset.value = start;
      }
    }
  } catch (error) {
    if (current === generation)
      errorText.value = requestErrorMessage(error, '证据读取失败');
  } finally {
    if (current === generation) loading.value = false;
  }
}
watch(
  () => [props.open, props.roleId, props.evidence, props.sourceId],
  () => {
    generation++;
    if (props.open) void load();
    else {
      source.value = undefined;
      feedback.value = undefined;
    }
  },
);
onBeforeUnmount(() => {
  generation++;
});
</script>
<template>
  <Modal
    :open="open"
    :title="
      source?.source.title ||
      (evidence?.message_id ? '原始用户反馈' : '素材原文')
    "
    :footer="null"
    :width="760"
    @cancel="emit('update:open', false)"
  >
    <Spin v-if="loading" />
    <Alert v-if="errorText" :message="errorText" type="error" />
    <p
      v-if="evidence"
      class="my-3 whitespace-pre-wrap border-l-4 border-blue-500 pl-3"
    >
      引用：{{ evidence.quote }}
    </p>
    <p v-if="feedback" class="whitespace-pre-wrap break-words">
      {{ feedback.content }}
    </p>
    <template v-if="source">
      <div v-for="segment in source.segments" :key="segment.id" class="mb-4">
        <p class="mb-2 text-xs text-muted-foreground">
          第 {{ segment.start_line }}—{{ segment.end_line }} 行
        </p>
        <pre class="whitespace-pre-wrap break-words font-sans">{{
          segment.text
        }}</pre>
      </div>
      <div v-if="!evidence?.segment_id" class="flex justify-between">
        <Button
          :disabled="loading || offset === 0"
          @click="load(Math.max(0, offset - 5))"
        >
          上一页
        </Button>
        <Button
          :disabled="loading || !source.has_more"
          @click="load(source.next_offset || 0)"
        >
          下一页
        </Button>
      </div>
    </template>
  </Modal>
</template>
