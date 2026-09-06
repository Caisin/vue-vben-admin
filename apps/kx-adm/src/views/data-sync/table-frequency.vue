<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import { Checkbox, InputNumber, Select } from 'antdv-next';

const value = defineModel<null | number | undefined>('value');
const unit = ref(60);
const inherited = computed(
  () => value.value === null || value.value === undefined,
);
const count = computed(() => (value.value ?? unit.value) / unit.value);
watch(
  value,
  (seconds) => {
    if (seconds === null || seconds === undefined) return;
    unit.value = 60;
    if (seconds % 3600 === 0) unit.value = 3600;
    if (seconds % 86_400 === 0) unit.value = 86_400;
  },
  { immediate: true },
);
function changeUnit(next: number) {
  const amount = count.value;
  unit.value = next;
  value.value = Math.min(2_678_400, Math.max(60, Math.round(amount * next)));
}
</script>
<template>
  <div class="frequency-fields">
    <Checkbox
      :checked="inherited"
      @change="(event) => (value = event.target.checked ? null : 3600)"
    >
      跟随全库定时
    </Checkbox>
    <template v-if="!inherited">
      <InputNumber
        :value="count"
        :min="1"
        :max="2_678_400 / unit"
        :precision="0"
        aria-label="同步间隔"
        @update:value="(amount) => (value = Number(amount ?? 0) * unit)"
      />
      <label><span class="sr-only">同步间隔单位</span><Select
          :value="unit"
          aria-label="同步间隔单位"
          :options="[
            { label: '分钟', value: 60 },
            { label: '小时', value: 3600 },
            { label: '天', value: 86400 },
          ]"
          @change="(next) => changeUnit(Number(next))"
      /></label>
    </template>
  </div>
</template>
<style scoped>
.frequency-fields {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.frequency-fields :deep(.ant-input-number) {
  width: 100px;
}

.frequency-fields :deep(.ant-select) {
  width: 90px;
}
</style>
