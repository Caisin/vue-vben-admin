<script setup lang="ts">
import type { SimCardView } from '#/api/msg';
import type { TaskRun } from '#/api/task/run';

import { computed, ref, watch } from 'vue';

import { useAccess } from '@vben/access';

import { Alert, Button, message, Modal, Spin } from 'antdv-next';

import { SimCardApi } from '#/api/msg';
import { requestErrorMessage } from '#/request-errors';
import { useTaskPolling } from '#/task-polling';

const emit = defineEmits<{
  busy: [value: boolean, iccid: string];
  finished: [];
}>();
const { hasAccessByCodes } = useAccess();
const open = ref(false);
const sending = ref(false);
const task = ref<TaskRun>();
const target = ref('');
const iccid = ref('');
const errorMessage = ref('');
const active = computed(
  () =>
    !!task.value &&
    ['queued', 'retrying', 'running'].includes(task.value.status),
);
const busy = computed(() => sending.value || active.value);
watch(busy, (value) => emit('busy', value, iccid.value), { flush: 'sync' });
let completed = false;

function explainError(error: unknown) {
  const code = requestErrorMessage(
    error,
    '请求未完成，请稍后核对短信记录或重试',
  );
  const messages: Record<string, string> = {
    msg_balance_query_carrier_unsupported: '该运营商尚未配置余额查询协议。',
    msg_balance_refresh_empty: '当前没有可查询余额的电话卡。',
    msg_sim_not_in_device: 'SIM 卡不在设备中，请确认插卡状态后重试。',
    msg_balance_query_forbidden: '没有权限查看这次余额查询。',
  };
  return messages[code] ?? code;
}

const resultType = computed(() => {
  if (errorMessage.value) return 'error';
  if (!task.value || active.value) return 'info';
  if (
    task.value.status === 'succeeded' &&
    Number(task.value.failed_count ?? 0) === 0
  )
    return 'success';
  return task.value.status === 'partially_succeeded' ? 'warning' : 'error';
});
const resultText = computed(() => {
  if (errorMessage.value) return errorMessage.value;
  if (sending.value) return '正在提交余额查询，请稍候…';
  if (!task.value) return '';
  if (active.value)
    return task.value.message || '查询已受理，正在发送查询指令…';
  if (resultType.value === 'success')
    return '余额查询指令提交成功，等待设备发送及运营商回复；收到回复后可刷新查看余额。';
  if (task.value.status === 'cancelled') return '余额查询任务已取消。';
  return `余额查询${resultType.value === 'warning' ? '部分失败' : '失败'}：${task.value.error_message || task.value.message || '请检查设备在线状态和运营商查询协议'}`;
});

function accept(value: TaskRun) {
  task.value = value;
  errorMessage.value = '';
  if (!active.value && !completed) {
    completed = true;
    if (resultType.value === 'success')
      message.success(`${target.value}：查询指令提交成功`);
    else if (resultType.value === 'warning') message.warning(resultText.value);
    else message.error(resultText.value);
    emit('finished');
  }
}
const polling = useTaskPolling({
  delay: 1000,
  load: () => {
    if (!task.value) throw new Error('余额查询尚未受理');
    return SimCardApi.balanceQuery(task.value.id);
  },
  accept,
  done: () => !active.value,
  onError: (error) => {
    errorMessage.value = `查询进度暂时不可用，正在重试：${explainError(error)}`;
  },
});

async function start(card?: SimCardView) {
  if (!hasAccessByCodes(['sim_cards:manage'])) return;
  open.value = true;
  if (busy.value) return;
  polling.stop();
  task.value = undefined;
  completed = false;
  iccid.value = card?.iccid ?? '';
  target.value = card ? card.phone_number || card.iccid : '批量查询余额';
  errorMessage.value = '';
  sending.value = true;
  try {
    const value = card
      ? await SimCardApi.refreshBalance(card.iccid)
      : await SimCardApi.refreshBalances();
    sending.value = false;
    accept(value);
    if (active.value) {
      message.info(`${target.value}：查询已受理`);
      polling.start();
    }
  } catch (error) {
    errorMessage.value = `余额查询提交失败：${explainError(error)}`;
    message.error(errorMessage.value);
  } finally {
    sending.value = false;
  }
}
defineExpose({ start });
</script>
<template>
  <Button v-if="task && !open" class="mb-2" @click="open = true">
    查看余额查询进度
  </Button>
  <Modal
    v-model:open="open"
    title="余额查询进度"
    :z-index="2500"
    :footer="null"
  >
    <p>{{ target }}</p>
    <Spin v-if="busy" size="small" class="mb-3" />
    <Alert :type="resultType" :message="resultText" show-icon />
    <p v-if="task" class="mt-3">
      指令提交成功 {{ task.succeeded_count ?? 0 }} 张，失败
      {{ task.failed_count ?? 0 }} 张。
    </p>
    <p v-if="task" class="mt-2 text-sm">
      任务 #{{
        task.id
      }}；任务完成仅代表查询指令提交结束，余额以运营商回复为准。
    </p>
  </Modal>
</template>
