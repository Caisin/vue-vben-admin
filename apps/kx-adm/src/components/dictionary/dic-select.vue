<script lang="ts" setup>
import type { DicSelectProps } from './use-dictionary';

import type { JsonValue } from '#/api/request';

import { computed, ref, watch } from 'vue';

import { Button, Input, message, Select } from 'antdv-next';

import { DictionaryApi } from '#/api/param/dictionary';

import {
  dictionaryValueKey,
  invalidateDictionary,
  useDictionary,
} from './use-dictionary';

defineOptions({ name: 'DicSelect', inheritAttrs: false });

const props = withDefaults(defineProps<DicSelectProps>(), {
  allowClear: true,
  autoSelect: true,
  createPlaceholder: '输入新选项名称',
  creatable: false,
  disabled: false,
  placeholder: '请选择',
  showSearch: true,
});
const modelValue = defineModel<JsonValue>();
const code = computed(() => props.code);
const { items, loading, options, reload } = useDictionary(code);
const creating = ref(false);
const createLabel = ref('');

const selectedKey = computed({
  get: () =>
    modelValue.value === undefined
      ? undefined
      : dictionaryValueKey(modelValue.value),
  set: (key: string | undefined) => {
    if (key === undefined) {
      modelValue.value = undefined;
      return;
    }
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

function handleSearch(input: string) {
  if (props.creatable) createLabel.value = input;
}

function filterOption(input: string, option?: { label?: unknown }) {
  return String(option?.label ?? '')
    .toLocaleLowerCase()
    .includes(input.toLocaleLowerCase());
}

function nextSortNo() {
  return (
    Math.max(
      0,
      ...items.value
        .map((item) => Number(item.sort_no))
        .filter((value) => Number.isFinite(value)),
    ) + 1
  );
}

async function createOption() {
  const label = createLabel.value.trim();
  const dicCode = props.code.trim();
  if (!label || !dicCode) return;

  const value = label;
  const existing = items.value.find(
    (item) =>
      item.label.trim() === label ||
      dictionaryValueKey(item.value) === dictionaryValueKey(value),
  );
  if (existing) {
    modelValue.value = existing.value;
    createLabel.value = '';
    message.info('已选择已有选项');
    return;
  }

  creating.value = true;
  try {
    await DictionaryApi.createData({
      dic_code: dicCode,
      enabled: true,
      is_def: false,
      label,
      remark: '从下拉框新增',
      sort_no: nextSortNo(),
      value,
    });
    invalidateDictionary(dicCode);
    await reload();
    modelValue.value = value;
    createLabel.value = '';
    message.success('选项已新增');
  } finally {
    creating.value = false;
  }
}
</script>

<template>
  <Select
    v-model:value="selectedKey"
    v-bind="$attrs"
    :allow-clear="allowClear"
    :class="props.class ?? 'w-full'"
    :disabled="disabled"
    :filter-option="filterOption"
    :loading="loading"
    :options="options"
    :placeholder="placeholder"
    :show-search="showSearch"
    @search="handleSearch"
  >
    <template v-if="creatable" #popupRender="menuNode">
      <component :is="menuNode" />
      <div class="dic-select-create" @mousedown.prevent.stop>
        <Input
          v-model:value="createLabel"
          :placeholder="createPlaceholder"
          size="small"
          @press-enter="createOption"
        />
        <Button
          :disabled="!createLabel.trim()"
          :loading="creating"
          size="small"
          type="link"
          @click="createOption"
        >
          新增
        </Button>
      </div>
    </template>
  </Select>
</template>

<style scoped>
.dic-select-create {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 8px;
  border-top: 1px solid hsl(var(--border));
}
</style>
