<script lang="ts" setup>
import type { JsonValue } from '#/api/request';

import { computed } from 'vue';

import {
  findDictionaryItem,
  formatDictionaryValue,
  useDictionary,
} from './use-dictionary';

defineOptions({ name: 'DicLabel' });

const props = defineProps<{
  code: string;
  value?: JsonValue;
}>();
const code = computed(() => props.code);
const { items } = useDictionary(code);
const label = computed(() => {
  if (props.value === undefined) return '';
  return (
    findDictionaryItem(items.value, props.value)?.label ??
    formatDictionaryValue(props.value)
  );
});
</script>

<template>
  <span>{{ label }}</span>
</template>
