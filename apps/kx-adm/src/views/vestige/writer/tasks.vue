<script setup lang="ts">
import type { RoleAccess } from '#/api/vestige';
import type { AgentTask } from '#/api/vestige/writer';

import { computed, onBeforeUnmount, ref, watch } from 'vue';

import { Alert, Button, message, Table, Tag } from 'antdv-next';

import { WriterApi } from '#/api/vestige/writer';
import { requestErrorMessage } from '#/request-errors';

import { useRoleConfirmation } from '../confirmation';
const props = defineProps<{ access: RoleAccess; refreshKey: number }>();
const emit = defineEmits<{ changed: [] }>();
const rows = ref<AgentTask[]>([]);
const page = ref(0);
const more = ref(false);
const loading = ref(false);
const errorText = ref('');
let generation = 0;
const confirm = useRoleConfirmation(() => [
  props.access.role.id,
  props.access.permission,
]);
const canContribute = computed(() => props.access.permission !== 'viewer');
const kinds: Record<string, string> = {
  extract: '素材提炼',
  role_chat: '角色调整',
  write: '剧本写作',
  review: '剧本审稿',
};
const states: Record<string, string> = {
  queued: '等待 Agent',
  leased: 'Agent 已领取',
  completed: '已完成',
  failed: '失败',
  cancelled: '已取消',
};
function label(task: AgentTask) {
  return task.status === 'leased' &&
    task.lease_until &&
    task.lease_until * 1000 < Date.now()
    ? '领取已过期，等待重新领取'
    : states[task.status] || task.status;
}
async function load() {
  const current = ++generation;
  loading.value = true;
  errorText.value = '';
  try {
    const data = await WriterApi.tasks(props.access.role.id, page.value * 25);
    if (current === generation) {
      rows.value = data.tasks.slice(0, 25);
      more.value = data.tasks.length > 25;
    }
  } catch (error) {
    if (current === generation)
      errorText.value = requestErrorMessage(error, '任务列表加载失败');
  } finally {
    if (current === generation) loading.value = false;
  }
}
function cancel(task: AgentTask) {
  const role = props.access.role.id;
  confirm({
    cancelText: '取消',
    title: '取消这个 Agent 任务？',
    content: '取消后旧领取令牌失效，Agent 不能再提交此任务结果。',
    okText: '取消任务',
    async onOk() {
      try {
        await WriterApi.cancelTask(role, task.id);
        await load();
        emit('changed');
      } catch (error) {
        message.error(requestErrorMessage(error, '取消失败'));
        throw error;
      }
    },
  });
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
    message="这些是交给外部 Agent 的创作任务。没有 Agent 领取时会保持等待，系统不会虚构分析或回复。"
    class="mb-3"
  />
  <Alert v-if="errorText" :message="errorText" type="error" class="mb-3" />
  <Table
    :data-source="rows"
    :loading="loading"
    :pagination="false"
    row-key="id"
    size="small"
    :scroll="{ x: 580 }"
    :columns="[
      { title: '任务', key: 'kind' },
      { title: '状态', key: 'status' },
      { title: '结果/说明', key: 'result' },
      { title: '操作', key: 'action' },
    ]"
  >
    <template #bodyCell="{ column, record }">
      <template v-if="column.key === 'kind'">
        {{ kinds[record.kind] || record.kind }}
        <p v-if="record.prompt_preview" class="text-xs text-muted-foreground">
          {{ record.prompt_preview }}
        </p>
      </template>
      <Tag v-else-if="column.key === 'status'">{{ label(record) }}</Tag>
      <template v-else-if="column.key === 'result'">
        <span v-if="record.candidate_version != null">
          候选 v{{ record.candidate_version }}，请到规则版本审核
        </span>
        <span v-else>{{ record.error || record.agent_id || '—' }}</span>
      </template>
      <Button
        v-else-if="
          column.key === 'action' &&
          canContribute &&
          ['queued', 'leased', 'failed'].includes(record.status)
        "
        type="link"
        @click="cancel(record)"
      >
        取消任务
      </Button>
    </template>
  </Table>
  <div class="mt-3 flex justify-between">
    <Button
      :disabled="loading || page === 0"
      @click="
        page--;
        load();
      "
    >
      上一页
    </Button>
    <span>第 {{ page + 1 }} 页</span>
    <Button
      :disabled="loading || !more"
      @click="
        page++;
        load();
      "
    >
      下一页
    </Button>
  </div>
</template>
