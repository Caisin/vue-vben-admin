import type { JsonValue, PageQuery } from '#/api/request';

import JsonBigint from 'json-bigint';

const jsonParser = JsonBigint({ storeAsString: true, strict: true });

export const enabledTagOptions = [
  { color: 'success', label: '启用', value: true },
  { color: 'error', label: '停用', value: false },
];

export const enabledSelectOptions = [
  { label: '启用', value: true },
  { label: '停用', value: false },
];

export function formatJsonEditorValue(value: unknown) {
  if (typeof value === 'string') return value;
  return JsonBigint.stringify(value ?? null, null, 2) ?? 'null';
}

export function parseJsonEditorValue(value: unknown): JsonValue {
  if (typeof value !== 'string') return value as JsonValue;
  return jsonParser.parse(value) as JsonValue;
}

export function localPageResult<T extends object>(
  items: T[],
  params: PageQuery,
) {
  const page = Number(params.page ?? 1);
  const size = Number(params.size ?? 20);
  const start = Math.max(page - 1, 0) * size;
  return {
    items: items.slice(start, start + size),
    total: items.length,
  };
}

export function optionalString(value: unknown) {
  const text = String(value ?? '').trim();
  return text.length > 0 ? text : undefined;
}

export function toNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.map(Number).filter((item) => Number.isFinite(item));
}
