import type { DicData, DicDataWrite } from '#/api';
import type { JsonValue } from '#/api/request';

export interface EditableDicData extends DicData {
  __dirty?: boolean;
  __is_new?: boolean;
  __value_text: string;
}

export type DicDataBuildResult =
  | { data: DicDataWrite; ok: true }
  | { message: string; ok: false };

export function formatDicDataValue(value: JsonValue): string {
  return JSON.stringify(value, null, 2);
}

export function toEditableDicDataRows(items: DicData[]): EditableDicData[] {
  return items.map((item) => ({
    ...item,
    __dirty: false,
    __is_new: false,
    __value_text: formatDicDataValue(item.value),
  }));
}

export function createDicDataDraft(
  dic_code: string,
  sort_no: number,
  timestamp = Date.now(),
): EditableDicData {
  return {
    __dirty: true,
    __is_new: true,
    __value_text: '""',
    created_at: '',
    dic_code,
    enabled: true,
    id: `new-${timestamp}`,
    is_def: false,
    label: '',
    remark: '',
    sort_no,
    value: '',
  };
}

export function buildDicDataWrite(row: EditableDicData): DicDataBuildResult {
  if (!row.dic_code.trim()) {
    return { message: '字典编码不能为空', ok: false };
  }
  if (!row.label.trim()) {
    return { message: '显示文本不能为空', ok: false };
  }

  let value: JsonValue;
  try {
    value = JSON.parse(row.__value_text) as JsonValue;
  } catch {
    return { message: '字典值必须是合法 JSON', ok: false };
  }

  return {
    data: {
      dic_code: row.dic_code,
      enabled: Boolean(row.enabled),
      is_def: Boolean(row.is_def),
      label: row.label,
      remark: row.remark ?? '',
      sort_no: Number(row.sort_no || 0),
      value,
    },
    ok: true,
  };
}
