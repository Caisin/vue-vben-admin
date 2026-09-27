<script setup lang="ts">
import type { RoleAccess } from '#/api/vestige';
import type { WriterMessage } from '#/api/vestige/writer';

import { computed, onBeforeUnmount, ref, watch } from 'vue';

import { Alert, Button, Input, message } from 'antdv-next';

import { WriterApi } from '#/api/vestige/writer';
import { requestErrorMessage } from '#/request-errors';
const props = defineProps<{ access: RoleAccess; refreshKey: number }>();
const emit = defineEmits<{ created: [] }>();
const items = ref<WriterMessage[]>([]);
const text = ref('');
const loading = ref(false);
const saving = ref(false);
const errorText = ref('');
const next = ref<null | number>(null);
let generation = 0;
const canContribute = computed(() => props.access.permission !== 'viewer');
async function load(older = false) {
  const current = ++generation;
  loading.value = true;
  errorText.value = '';
  try {
    const result = await WriterApi.messages(
      props.access.role.id,
      older ? next.value || 0 : 0,
    );
    if (current !== generation) return;
    items.value = older
      ? [
          ...result.messages.filter(
            (m) => !items.value.some((v) => v.id === m.id),
          ),
          ...items.value,
        ]
      : result.messages;
    next.value = result.next_offset;
  } catch (error) {
    if (current === generation)
      errorText.value = requestErrorMessage(error, '反馈记录加载失败');
  } finally {
    if (current === generation) loading.value = false;
  }
}
async function send() {
  if (!canContribute.value || saving.value || !text.value.trim()) return;
  const content = text.value.trim();
  if (new TextEncoder().encode(content).length > 10_000) {
    message.error('反馈过长，请分段提交');
    return;
  }
  const role = props.access.role.id;
  saving.value = true;
  try {
    await WriterApi.chat(role, content);
    if (role !== props.access.role.id) return;
    text.value = '';
    await load();
    emit('created');
    message.success('调整意见已记录，等待 Agent 回复和提交候选');
  } catch (error) {
    message.error(requestErrorMessage(error, '调整意见提交失败'));
  } finally {
    saving.value = false;
  }
}
watch(
  () => [props.access.role.id, props.refreshKey],
  () => {
    generation++;
    void load();
  },
  { immediate: true },
);
onBeforeUnmount(() => {
  generation++;
});
</script>
<template>
  <Alert
    type="info"
    message="告诉角色哪些方法需要保留或改变。已授权成员可查看本角色的反馈；Agent 回复和候选规则不会自动发布。"
    class="mb-3"
  />
  <Alert v-if="errorText" :message="errorText" type="error" class="mb-3" />
  <Button v-if="next !== null" :loading="loading" @click="load(true)">
    加载更早的反馈
  </Button>
  <p v-if="!items.length && !loading" class="my-4 text-muted-foreground">
    还没有调整意见。可以从你希望的叙事节奏、冲突强度或人物选择开始。
  </p>
  <article v-for="item in items" :key="item.id" class="my-4 rounded border p-3">
    <div class="mb-2 text-xs text-muted-foreground">
      {{ item.speaker === 'user' ? '成员反馈' : 'Agent 回复' }} ·
      {{ new Date(item.created_at).toLocaleString('zh-CN') }}
    </div>
    <p class="whitespace-pre-wrap break-words">{{ item.content }}</p>
  </article>
  <template v-if="canContribute">
    <Input.TextArea
      v-model:value="text"
      aria-label="角色调整意见"
      :rows="4"
      :disabled="saving"
      placeholder="例如：保留强悬念，但减少旁白，让关键信息通过角色行动揭示。"
    />
    <Button
      type="primary"
      class="mt-3"
      :loading="saving"
      :disabled="!text.trim()"
      @click="send"
    >
      提交调整意见
    </Button>
  </template>
</template>
