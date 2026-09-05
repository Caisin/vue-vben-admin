<script setup lang="ts">
import type { SyncConfig } from '#/api/data-sync';

import { Checkbox, Input, InputNumber, Select } from 'antdv-next';

import { setStrategy, strategyOptions } from './data';
defineProps<{ disabled?: boolean }>();
const config = defineModel<SyncConfig>('config', { required: true });
</script>
<template>
  <div class="strategy-fields">
    <label class="field">同步策略<Select
        :value="config.mode"
        :options="strategyOptions"
        :disabled="disabled"
        @change="(value) => setStrategy(config, value as SyncConfig['mode'])"
    /></label>
    <template v-if="config.mode === 'time_window' && config.window">
      <label class="field">窗口粒度<Select
          v-model:value="config.window.unit"
          :disabled="disabled"
          :options="[
            { value: 'day', label: '按天' },
            { value: 'hour', label: '按小时' },
          ]"
      /></label>
      <label class="field">窗口时区<Input
          v-model:value="config.window.timezone"
          :disabled="disabled"
          placeholder="Asia/Shanghai"
      /></label>
      <label class="field">首次同步起点<Input
          v-model:value="config.window.start_at"
          :disabled="disabled"
          placeholder="2026-01-01T00:00:00+08:00"
      /></label>
      <label class="field">回看窗口数<InputNumber
          v-model:value="config.window.lookback_windows"
          :min="1"
          :max="168"
          :disabled="disabled"
      /></label>
      <Checkbox
        v-model:checked="config.window.include_open_window"
        :disabled="disabled"
      >
        包含当前未关闭窗口
      </Checkbox>
      <Checkbox
        v-model:checked="config.window.immutable_time_confirmed"
        :disabled="disabled"
      >
        确认分桶时间字段不可修改
      </Checkbox>
    </template>
    <label
      v-if="['full_table', 'time_window'].includes(config.mode)"
      class="field"
      >单快照字节上限<InputNumber
        v-model:value="config.limits.snapshot_max_bytes"
        :min="1024"
        :max="17179869184"
    /></label>
  </div>
</template>
<style scoped>
.strategy-fields {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  align-items: center;
  margin: 16px 0;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field :deep(.ant-input-number) {
  width: 100%;
}

@media (max-width: 700px) {
  .strategy-fields {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
