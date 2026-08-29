<script lang="ts" setup>
import { computed, ref } from 'vue';

import {
  Button,
  Input,
  InputNumber,
  message,
  Select,
  Space,
  Tag,
} from 'antdv-next';

import { TaskScheduleApi } from '#/api/task';
import { Times } from '#/times';

const props = withDefaults(
  defineProps<{
    limit?: number;
    timezoneOffsetSeconds?: number;
    value?: string;
  }>(),
  {
    limit: 5,
    timezoneOffsetSeconds: 28_800,
    value: '0 0 2 * * *',
  },
);

const emit = defineEmits<{
  'update:timezoneOffsetSeconds': [value: number];
  'update:value': [value: string];
}>();

const previewLoading = ref(false);
const fireTimes = ref<Array<number | string>>([]);

const cronValue = computed({
  get: () => props.value,
  set: (value) => emit('update:value', value),
});
const timezoneOffset = computed({
  get: () => props.timezoneOffsetSeconds,
  set: (value) => emit('update:timezoneOffsetSeconds', Number(value ?? 28_800)),
});

const presetOptions = [
  { label: '每秒', value: '* * * * * *' },
  { label: '每 5 秒', value: '*/5 * * * * *' },
  { label: '每 10 秒', value: '*/10 * * * * *' },
  { label: '每 30 秒', value: '*/30 * * * * *' },
  { label: '每 5 分钟', value: '0 0/5 * * * *' },
  { label: '每小时', value: '0 0 * * * *' },
  { label: '每天 02:00', value: '0 0 2 * * *' },
  { label: '工作日 09:00', value: '0 0 9 * * 1-5' },
  { label: '每周一 09:00', value: '0 0 9 * * 1' },
  { label: '每月 1 日 09:00', value: '0 0 9 1 * *' },
];

function applyPreset(value: string) {
  cronValue.value = value;
  fireTimes.value = [];
}

async function previewCron() {
  const cron_expr = cronValue.value.trim();
  if (!cron_expr) {
    message.warning('请填写 cron 表达式');
    return;
  }
  previewLoading.value = true;
  try {
    const result = await TaskScheduleApi.cron_preview({
      cron_expr,
      limit: props.limit,
      timezone_offset_seconds: timezoneOffset.value,
    });
    fireTimes.value = result.fire_times;
    message.success('cron 表达式可用');
  } finally {
    previewLoading.value = false;
  }
}
</script>

<template>
  <div class="cron-expression-select">
    <Space class="w-full" direction="vertical" :size="8">
      <Select
        allow-clear
        class="w-full"
        :options="presetOptions"
        placeholder="选择常用 cron 表达式"
        @change="(value) => value && applyPreset(String(value))"
      />
      <Input v-model:value="cronValue" placeholder="例如：0 0 2 * * *" />
      <div class="cron-inline">
        <InputNumber
          v-model:value="timezoneOffset"
          class="timezone-input"
          :step="3600"
        />
        <Button :loading="previewLoading" @click="previewCron">预览</Button>
      </div>
      <div v-if="fireTimes.length" class="cron-preview">
        <Tag v-for="time in fireTimes" :key="String(time)" color="processing">
          {{ Times.formatUnix(time) }}
        </Tag>
      </div>
    </Space>
  </div>
</template>

<style scoped>
.cron-inline {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.timezone-input {
  flex: 1 1 180px;
  min-width: 0;
}

.cron-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.cron-inline :deep(.ant-btn) {
  flex: 0 0 auto;
}
</style>
