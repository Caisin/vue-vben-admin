<script lang="ts" setup>
import type { SimCardView } from '#/api/msg';

import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { RotateCw } from '@vben/icons';

import { Button, Select, SpaceCompact, Tooltip } from 'antdv-next';

import { SimCardApi } from '#/api/msg';

import { simCardOptionLabel } from './sim-card-select-options';

interface Props {
  carrier?: string;
  mode?: 'multiple' | 'tags';
  modelValue?: string | string[];
  placeholder?: string;
  requirePhoneNumber?: boolean;
  valueField?: 'iccid' | 'phone_number';
}

const props = withDefaults(defineProps<Props>(), {
  carrier: undefined,
  mode: undefined,
  modelValue: undefined,
  placeholder: '按号码、实名、ICCID 或 IMSI 搜索电话卡',
  requirePhoneNumber: false,
  valueField: 'iccid',
});

const emit = defineEmits<{
  'update:modelValue': [value: string | string[] | undefined];
}>();

const cards = ref<SimCardView[]>([]);
const loading = ref(false);
const options = ref<
  { disabled: boolean; label: string; title: string; value: string }[]
>([]);
const searchKeyword = ref('');
let requestSequence = 0;

function cardSearchText(card: SimCardView) {
  return Object.values(card)
    .map((value) => String(value ?? ''))
    .join(' ')
    .toLowerCase();
}

function selectedValue(card: SimCardView) {
  return props.valueField === 'phone_number'
    ? card.phone_number || card.iccid
    : card.iccid;
}

function applyLocalFilter(keyword = searchKeyword.value) {
  const normalizedKeyword = keyword.trim().toLowerCase();
  const seen = new Set<string>();
  options.value = cards.value.flatMap((card) => {
    if (
      normalizedKeyword &&
      !cardSearchText(card).includes(normalizedKeyword)
    ) {
      return [];
    }
    const missingNumber = !card.phone_number;
    const value = selectedValue(card);
    if (seen.has(value)) return [];
    seen.add(value);
    return [
      {
        disabled:
          props.valueField === 'phone_number' && missingNumber
            ? true
            : props.requirePhoneNumber && missingNumber,
        label: simCardOptionLabel(card),
        title: simCardOptionLabel(card),
        value,
      },
    ];
  });
}

async function loadOptions() {
  const sequence = ++requestSequence;
  loading.value = true;
  try {
    const pageSize = 100;
    const loaded: SimCardView[] = [];
    let page = 1;
    let total = Number.POSITIVE_INFINITY;
    while (loaded.length < total) {
      if (sequence !== requestSequence) break;
      const result = await SimCardApi.list({
        carrier: props.carrier || undefined,
        page,
        size: pageSize,
      });
      loaded.push(...result.items);
      total = result.total;
      if (result.items.length === 0) break;
      page += 1;
    }
    if (sequence === requestSequence) {
      cards.value = loaded;
      applyLocalFilter();
    }
  } finally {
    if (sequence === requestSequence) {
      loading.value = false;
    }
  }
}

function search(keyword: string) {
  searchKeyword.value = keyword;
  applyLocalFilter(keyword);
}

function updateValue(value: unknown) {
  if (Array.isArray(value)) {
    emit(
      'update:modelValue',
      value.filter((item): item is string => typeof item === 'string'),
    );
  } else {
    emit('update:modelValue', typeof value === 'string' ? value : undefined);
  }
}

onMounted(() => loadOptions());
watch(
  () => props.carrier,
  () => loadOptions(),
);
onBeforeUnmount(() => {
  requestSequence += 1;
});

defineExpose({ reload: loadOptions });
</script>

<template>
  <SpaceCompact block>
    <Select
      allow-clear
      class="min-w-0 flex-1"
      :filter-option="false"
      :loading="loading"
      :mode="mode"
      :options="options"
      :placeholder="placeholder"
      option-label-prop="label"
      :popup-match-select-width="true"
      show-search
      :value="modelValue"
      @search="search"
      @update:value="updateValue"
    />
    <Tooltip title="刷新电话卡列表">
      <Button
        aria-label="刷新电话卡列表"
        :loading="loading"
        @click="loadOptions"
      >
        <template #icon><RotateCw /></template>
      </Button>
    </Tooltip>
  </SpaceCompact>
</template>
