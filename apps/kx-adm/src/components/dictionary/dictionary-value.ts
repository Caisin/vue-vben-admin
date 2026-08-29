import type { DicData } from '#/api/param/dictionary';
import type { JsonValue } from '#/api/request';

function normalizeJson(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map((item) => normalizeJson(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .toSorted(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, normalizeJson(child)]),
    );
  }
  return value;
}

export function dictionaryValueKey(value: JsonValue) {
  return JSON.stringify(normalizeJson(value));
}

export function findDictionaryItem(items: DicData[], value: JsonValue) {
  const key = dictionaryValueKey(value);
  return items.find((item) => dictionaryValueKey(item.value) === key);
}

export function formatDictionaryValue(value: JsonValue | undefined) {
  if (value === undefined) return '';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}
