<script lang="ts" setup>
import type { DicRadioGroupProps } from './use-dictionary';

import type { JsonValue } from '#/api/request';

import { computed, watch } from 'vue';

import { RadioGroup } from 'antdv-next';

import { dictionaryValueKey, useDictionary } from './use-dictionary';

defineOptions({ name: 'DicRadioGroup', inheritAttrs: false });

const props = withDefaults(defineProps<DicRadioGroupProps>(), {
  autoSelect: true,
  buttonStyle: 'outline',
  disabled: false,
  optionType: 'default',
});
const modelValue = defineModel<JsonValue>();
const code = computed(() => props.code);
const { items, options } = useDictionary(code);

const selectedKey = computed({
  get: () =>
    modelValue.value === undefined
      ? undefined
      : dictionaryValueKey(modelValue.value),
  set: (key: string | undefined) => {
    modelValue.value = items.value.find(
      (item) => dictionaryValueKey(item.value) === key,
    )?.value;
  },
});

watch(items, (value) => {
  if (modelValue.value !== undefined || !props.autoSelect) return;
  const defaultItem = value.find((item) => item.is_def);
  if (defaultItem) modelValue.value = defaultItem.value;
});
</script>

<template>
  <RadioGroup
    v-model:value="selectedKey"
    v-bind="$attrs"
    :button-style="buttonStyle"
    :class="props.class"
    :disabled="disabled"
    :option-type="optionType"
    :options="options"
  />
</template>
