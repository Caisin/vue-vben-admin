<script setup lang="ts">
import type { TaskRun } from '#/api/task/run';

import { computed, ref, watch } from 'vue';

import { useAccess } from '@vben/access';

import { Alert, Button, Modal, Progress, Spin } from 'antdv-next';

import { DataSyncApi } from '#/api/data-sync';
import { DatabaseSyncApi } from '#/api/data-sync-database';
import { requestErrorMessage } from '#/request-errors';
import { useTaskPolling } from '#/task-polling';

const props = defineProps<{
  id: number;
  expectedId?: null | number;
  target: string;
  database?: boolean;
  compact?: boolean;
  disabled?: boolean;
  hidden?: boolean;
}>();
const emit = defineEmits<{ finished: [] }>();
const { hasAccessByCodes } = useAccess();
const allowed = computed(() => hasAccessByCodes(['data-sync:execute']));
const open = ref(false);
const sending = ref(false);
const task = ref<TaskRun>();
const error = ref('');
const active = computed(
  () =>
    task.value && ['queued', 'retrying', 'running'].includes(task.value.status),
);
const percent = computed(() => {
  const total = Number(task.value?.total_count ?? 0);
  return total > 0
    ? Math.min(
        100,
        Math.round((Number(task.value?.succeeded_count ?? 0) / total) * 100),
      )
    : 0;
});
const needsReconcile = computed(
  () =>
    task.value?.status === 'succeeded' && task.value.message.includes('待对账'),
);
let completed: number | string | undefined;
const polling = useTaskPolling({
  delay: 1000,
  load: () => {
    const current = task.value;
    if (!current) throw new Error('强停任务尚未提交');
    return props.database
      ? DatabaseSyncApi.task(props.id, current.id)
      : DataSyncApi.jobTask(props.id, current.id);
  },
  accept: (value) => {
    task.value = value;
    error.value = '';
    if (
      !['queued', 'retrying', 'running'].includes(value.status) &&
      completed !== value.id
    ) {
      completed = value.id;
      emit('finished');
    }
  },
  done: (value) => !['queued', 'retrying', 'running'].includes(value.status),
  onError: (value) => {
    error.value = requestErrorMessage(value, '强停进度暂时不可用，正在重试');
  },
});
watch(
  () => props.id,
  () => {
    polling.stop();
    task.value = undefined;
    open.value = false;
  },
);
watch(open, (value) => {
  if (value && active.value) polling.start();
  else if (!value) polling.stop();
});
function confirm() {
  if (!allowed.value) return;
  if (active.value) {
    open.value = true;
    return;
  }
  const expected = props.expectedId;
  if (!expected) return;
  Modal.confirm({
    title: props.database ? '强制停止全库同步？' : '强制停止本表同步？',
    content: `${props.target}：撤销本轮后续发布权并暂停调度。已提交数据保留，未确认批次保留待对账；正在执行的外部调用可能需要等待退出。${props.database ? '' : '不会取消其它表的共享 worker。'}`,
    okText: '强制停止',
    okType: 'danger',
    cancelText: '取消',
    zIndex: 2400,
    onOk: async () => {
      sending.value = true;
      try {
        task.value = props.database
          ? await DatabaseSyncApi.forceStop(props.id, expected)
          : await DataSyncApi.forceStop(props.id, expected);
        error.value = '';
        open.value = true;
      } finally {
        sending.value = false;
      }
    },
  });
}
defineExpose({ confirm });
</script>
<template>
  <Button
    v-if="!hidden && allowed && (expectedId || active)"
    danger
    :size="compact ? 'small' : 'middle'"
    :disabled="disabled"
    :loading="sending"
    :aria-label="database ? '强制停止全库同步' : '强制停止本表同步'"
    @click="confirm"
  >
    {{ active ? '强停进度' : compact ? '强停' : '强制停止' }}
  </Button>
  <Modal
    v-model:open="open"
    title="强制停止进度"
    :footer="null"
    :z-index="2500"
  >
    <p>{{ target }}</p>
    <Alert v-if="error" type="error" :message="error" show-icon />
    <template v-if="task">
      <p>任务 #{{ task.id }}</p>
      <Spin v-if="active" size="small" />
      <Progress
        :percent="percent"
        :status="
          task.status === 'failed' ? 'exception' : active ? 'active' : 'normal'
        "
      />
      <Alert
        :type="
          active
            ? 'info'
            : needsReconcile
              ? 'warning'
              : task.status === 'succeeded'
                ? 'success'
                : 'error'
        "
        :message="
          task.error_message ||
          task.message ||
          (active ? '正在清理运行占用' : '强停任务已结束')
        "
        show-icon
      />
      <p v-if="needsReconcile">
        请在同步配置中执行“回执对账”，核实批次后再启动同步。
      </p>
    </template>
  </Modal>
</template>
