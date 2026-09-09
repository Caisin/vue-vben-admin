<script setup lang="ts">
import type { TaskRun } from '#/api/task/run';

import { computed, ref, watch } from 'vue';

import { useAccess } from '@vben/access';

import {
  Alert,
  App,
  Button,
  Checkbox,
  Form,
  FormItem,
  Input,
  Modal,
  Radio,
  RadioGroup,
} from 'antdv-next';

import { DeviceEventApi } from '#/api/msg';
import { requestErrorMessage } from '#/request-errors';
import { useTaskPolling } from '#/task-polling';

const emit = defineEmits<{ finished: [] }>();
const { hasAccessByCodes } = useAccess();
const { message } = App.useApp();
const open = ref(false);
const range = ref('period');
const start = ref('');
const end = ref('');
const normalOnly = ref(true);
const confirmed = ref(false);
const sending = ref(false);
const errorMessage = ref('');
const task = ref<TaskRun>();
watch([range, start, end, normalOnly], () => {
  confirmed.value = false;
});
const active = computed(
  () =>
    !!task.value &&
    ['queued', 'retrying', 'running'].includes(task.value.status),
);
const busy = computed(() => sending.value || active.value);
let finished = false;
const successful = computed(() => task.value?.status === 'succeeded');
const result = computed(
  () =>
    errorMessage.value ||
    task.value?.error_message ||
    task.value?.message ||
    '清理已提交，正在处理',
);
function accept(value: TaskRun) {
  task.value = value;
  errorMessage.value = '';
  if (!active.value && !finished) {
    finished = true;
    if (successful.value) message.success(value.message || '事件清理完成');
    else
      message.error(value.error_message || value.message || '事件清理未完成');
    emit('finished');
  }
}
const polling = useTaskPolling({
  delay: 1000,
  load: () => {
    if (!task.value) throw new Error('清理任务尚未提交');
    return DeviceEventApi.cleanupStatus(task.value.id);
  },
  accept,
  done: () => !active.value,
  onError: (error) => {
    errorMessage.value = `获取进度失败，正在重试：${requestErrorMessage(error, '请求失败，请稍后重试')}`;
  },
});
function show() {
  open.value = true;
  confirmed.value = false;
}
function again() {
  polling.stop();
  task.value = undefined;
  confirmed.value = false;
  errorMessage.value = '';
}
async function submit() {
  if (
    !confirmed.value ||
    busy.value ||
    !hasAccessByCodes(['device_events:cleanup'])
  )
    return;
  errorMessage.value = '';
  const startAt =
    range.value === 'all'
      ? null
      : Math.floor(new Date(start.value).getTime() / 1000);
  const endAt =
    range.value === 'all'
      ? null
      : Math.floor(new Date(end.value).getTime() / 1000);
  if (
    range.value !== 'all' &&
    (!Number.isFinite(startAt) ||
      !Number.isFinite(endAt) ||
      startAt === null ||
      endAt === null ||
      startAt < 0 ||
      endAt < startAt)
  ) {
    errorMessage.value =
      '请选择有效的开始和结束时间，结束时间不能早于开始时间。';
    return;
  }
  sending.value = true;
  finished = false;
  try {
    accept(
      await DeviceEventApi.cleanup({
        all_time: range.value === 'all',
        start_at: startAt,
        end_at: endAt,
        normal_queries_only: normalOnly.value,
      }),
    );
    if (active.value) {
      message.info('事件清理已受理');
      polling.start();
    }
  } catch (error) {
    errorMessage.value = `提交清理失败：${requestErrorMessage(error, '请求失败，请稍后重试')}`;
  } finally {
    sending.value = false;
  }
}
</script>

<template>
  <Button
    v-if="hasAccessByCodes(['device_events:cleanup'])"
    danger
    @click="show"
  >
    {{ task ? '查看清理进度' : '清理事件' }}
  </Button>
  <Modal
    v-model:open="open"
    title="清理设备事件"
    :footer="null"
    :mask-closable="false"
    width="min(680px, calc(100vw - 32px))"
  >
    <template v-if="!task">
      <Alert
        class="mb-4"
        type="warning"
        message="清理不可恢复。仅删除您可管理的设备事件，不删除设备、SIM 卡或短信。清理范围由下方设置决定，不使用列表筛选。"
        show-icon
      />
      <Form layout="vertical">
        <FormItem label="接收时间范围">
          <RadioGroup v-model:value="range" :disabled="sending">
            <Radio value="period">指定时间段</Radio>
            <Radio value="all">全部时间</Radio>
          </RadioGroup>
        </FormItem>
        <div
          v-if="range === 'period'"
          class="grid grid-cols-1 gap-3 sm:grid-cols-2"
        >
          <FormItem label="开始时间（当前浏览器时区）">
            <Input
              v-model:value="start"
              aria-label="清理开始时间"
              type="datetime-local"
              step="1"
              :disabled="sending"
            />
          </FormItem>
          <FormItem label="结束时间（含该秒）">
            <Input
              v-model:value="end"
              aria-label="清理结束时间"
              type="datetime-local"
              step="1"
              :disabled="sending"
            />
          </FormItem>
        </div>
        <FormItem label="事件范围">
          <Checkbox v-model:checked="normalOnly" :disabled="sending">
            仅清理正常的设备信息、号码状态查询事件（保留错误）
          </Checkbox>
          <p v-if="!normalOnly" class="mt-2 text-red-600">
            将清理所选时间内的所有事件类型，包括错误和手动操作记录。
          </p>
        </FormItem>
        <Checkbox v-model:checked="confirmed" :disabled="sending">
          我确认清理以上范围的事件，删除后无法恢复
        </Checkbox>
        <Alert
          v-if="errorMessage"
          class="mt-3"
          type="error"
          :message="errorMessage"
          show-icon
        />
        <Button
          class="mt-4"
          danger
          type="primary"
          :disabled="!confirmed"
          :loading="sending"
          @click="submit"
        >
          确认清理
        </Button>
      </Form>
    </template>
    <template v-else>
      <Alert
        :type="
          errorMessage
            ? 'error'
            : active
              ? 'info'
              : successful
                ? 'success'
                : 'error'
        "
        :message="result"
        show-icon
      />
      <p class="mt-3">
        任务 #{{ task.id }}；后台分批清理，提交后新增的事件不会被此任务删除。
      </p>
      <p class="mt-2">若任务中断后重试，删除数量按当前执行轮次重新统计。</p>
      <Button v-if="!busy" class="mt-4" @click="again">发起新的清理</Button>
    </template>
  </Modal>
</template>
