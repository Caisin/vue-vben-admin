<script setup lang="ts">
import type { WarehouseOptions } from '#/api/data-sync';

import { computed, onBeforeUnmount, ref, watch } from 'vue';

import { DataSyncApi } from '#/api/data-sync';

import MetadataSelect from './metadata-select.vue';

const props = defineProps<{
  active: boolean;
  allowInsecure: boolean;
  disabled?: boolean;
  dsCode: string;
  value?: null | string;
}>();
const emit = defineEmits<{ 'update:value': [null | string] }>();
const availability = ref<WarehouseOptions['availability']>();
const contextKey = computed(() =>
  props.active && props.dsCode
    ? JSON.stringify([props.dsCode, props.allowInsecure])
    : '',
);
let request = 0;
onBeforeUnmount(() => {
  ++request;
});
watch(
  () => [contextKey.value, props.disabled],
  () => {
    ++request;
    availability.value = undefined;
  },
);
async function load(keyword: string) {
  const current = ++request;
  availability.value = undefined;
  const result = await DataSyncApi.targetWarehouses({
    ds_code: props.dsCode,
    allow_insecure: props.allowInsecure,
    keyword,
  });
  if (current === request) availability.value = result.availability;
  return result;
}
</script>
<template>
  <div class="warehouse-selector">
    <MetadataSelect
      :value="value"
      label="计算仓库"
      placeholder="默认连接（不指定仓库）"
      allow-clear
      :context-key="contextKey"
      :disabled="disabled || !contextKey"
      :load="load"
      @update:value="(value) => emit('update:value', value || null)"
    />
    <span
      v-if="availability === 'unsupported'"
      class="text-muted-foreground text-xs"
      >当前服务不支持仓库列表</span>
    <span
      v-else-if="availability === 'license_unavailable'"
      class="text-muted-foreground text-xs"
      >当前许可未开放仓库列表</span>
  </div>
</template>
