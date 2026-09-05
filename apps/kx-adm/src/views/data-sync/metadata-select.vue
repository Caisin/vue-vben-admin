<script setup lang="ts">
import type { MetadataOptions } from '#/api/data-sync';

import { computed, onBeforeUnmount, ref, watch } from 'vue';

import { createIconifyIcon } from '@vben/icons';

import { Button, Select, Tooltip } from 'antdv-next';

const props = defineProps<{
  allowClear?: boolean;
  contextKey: string;
  disabled?: boolean;
  label: string;
  load: (keyword: string) => Promise<MetadataOptions>;
  placeholder?: string;
  value?: null | string;
}>();
const emit = defineEmits<{ change: [string]; 'update:value': [string] }>();
const Refresh = createIconifyIcon('lucide:refresh-cw');
const result = ref<MetadataOptions>({ items: [], has_more: false });
const loading = ref(false);
const failed = ref(false);
let keyword = '';
let request = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
const options = computed(() =>
  props.value && !result.value.items.some((item) => item.value === props.value)
    ? [{ value: props.value, label: props.value }, ...result.value.items]
    : result.value.items,
);
async function reload() {
  const current = ++request;
  if (props.disabled || !props.contextKey) {
    loading.value = false;
    return;
  }
  loading.value = true;
  failed.value = false;
  try {
    const response = await props.load(keyword);
    if (current === request) result.value = response;
  } catch {
    if (current === request) {
      failed.value = true;
      result.value = { items: [], has_more: false };
    }
  } finally {
    if (current === request) loading.value = false;
  }
}
function search(value: string) {
  keyword = value;
  clearTimeout(timer);
  ++request;
  timer = setTimeout(reload, 250);
}
watch(
  () => [props.contextKey, props.disabled],
  () => {
    clearTimeout(timer);
    keyword = '';
    result.value = { items: [], has_more: false };
    void reload();
  },
  { immediate: true },
);
onBeforeUnmount(() => {
  ++request;
  clearTimeout(timer);
});
</script>
<template>
  <div class="metadata-control">
    <div class="flex min-w-0 gap-1">
      <Select
        :value="value || undefined"
        :aria-label="label"
        :options="options"
        :loading="loading"
        :disabled="disabled"
        :filter-option="false"
        :allow-clear="allowClear"
        show-search
        class="min-w-0 flex-1"
        :placeholder="placeholder ?? `选择${label}`"
        :not-found-content="
          loading ? '加载中' : failed ? '加载失败' : '无匹配结果'
        "
        @search="search"
        @change="
          (value) => {
            const selected = value == null ? '' : String(value);
            emit('update:value', selected);
            emit('change', selected);
          }
        "
      />
      <Tooltip :title="`刷新${label}`">
        <Button
          :aria-label="`刷新${label}`"
          :disabled="disabled || loading"
          @click="reload"
        >
          <Refresh class="size-4" />
        </Button>
      </Tooltip>
    </div>
    <span v-if="failed" class="text-xs text-red-500">{{ label }}加载失败</span>
    <span v-else-if="result.has_more" class="text-muted-foreground text-xs">仅显示前 200 项</span>
  </div>
</template>
