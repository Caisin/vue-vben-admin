import type { MaybeRefOrGetter } from 'vue';

import type { DicData } from '#/api/param/dictionary';

import { computed, ref, shallowRef, toValue, watch } from 'vue';

import { DictionaryApi } from '#/api/param/dictionary';

import { dictionaryValueKey } from './dictionary-value';

export {
  dictionaryValueKey,
  findDictionaryItem,
  formatDictionaryValue,
} from './dictionary-value';

export interface DicCommonProps {
  allowClear?: boolean;
  autoSelect?: boolean;
  class?: string;
  code: string;
  disabled?: boolean;
  placeholder?: string;
}

export interface DicSelectProps extends DicCommonProps {
  creatable?: boolean;
  createPlaceholder?: string;
  showSearch?: boolean;
}

export interface DicRadioGroupProps extends DicCommonProps {
  buttonStyle?: 'outline' | 'solid';
  optionType?: 'button' | 'default';
}

interface DictionarySnapshot {
  items: DicData[];
}

const cache = new Map<string, Promise<DictionarySnapshot>>();

function sortItems(items: DicData[]) {
  return items
    .filter((item) => item.enabled)
    .toSorted(
      (left, right) =>
        Number(left.sort_no) - Number(right.sort_no) ||
        Number(left.id) - Number(right.id),
    );
}

async function fetchDictionary(code: string) {
  const [dictionary, items] = await Promise.all([
    DictionaryApi.detail(code),
    DictionaryApi.dataList(code),
  ]);
  return { items: dictionary.enabled ? sortItems(items) : [] };
}

export function loadDictionary(code: string) {
  const normalizedCode = code.trim();
  if (!normalizedCode) return Promise.resolve({ items: [] });

  let request = cache.get(normalizedCode);
  if (!request) {
    request = fetchDictionary(normalizedCode).catch((error) => {
      cache.delete(normalizedCode);
      throw error;
    });
    cache.set(normalizedCode, request);
  }
  return request;
}

export function invalidateDictionary(code?: string) {
  if (code) cache.delete(code.trim());
  else cache.clear();
}

export function useDictionary(code: MaybeRefOrGetter<string>) {
  const items = shallowRef<DicData[]>([]);
  const loading = ref(false);
  const error = ref<unknown>();
  let requestId = 0;

  async function reload() {
    const value = toValue(code).trim();
    const currentRequest = ++requestId;
    items.value = [];
    error.value = undefined;
    if (!value) return;

    try {
      loading.value = true;
      const result = await loadDictionary(value);
      if (currentRequest === requestId) items.value = result.items;
    } catch (currentError) {
      if (currentRequest === requestId) error.value = currentError;
    } finally {
      if (currentRequest === requestId) loading.value = false;
    }
  }

  watch(() => toValue(code), reload, { immediate: true });

  const options = computed(() =>
    items.value.map((item) => ({
      disabled: !item.enabled,
      label: item.label,
      value: dictionaryValueKey(item.value),
    })),
  );

  return { error, items, loading, options, reload };
}
