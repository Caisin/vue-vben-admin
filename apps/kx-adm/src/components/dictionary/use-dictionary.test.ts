import type { DicData } from '#/api/param/dictionary';

import { describe, expect, it } from 'vitest';

import {
  dictionaryValueKey,
  findDictionaryItem,
  formatDictionaryValue,
} from './dictionary-value';

function item(value: DicData['value'], label: string): DicData {
  return {
    created_at: 0,
    dic_code: 'test',
    enabled: true,
    id: 1,
    is_def: false,
    label,
    remark: '',
    sort_no: 1,
    value,
  };
}

describe('字典值工具', () => {
  it('对象键顺序不影响内部选择键', () => {
    expect(dictionaryValueKey({ enabled: true, order: 1 })).toBe(
      dictionaryValueKey({ order: 1, enabled: true }),
    );
  });

  it('按原始 JSON 类型匹配字典项', () => {
    const items = [item(true, '启用'), item('true', '文本 true')];

    expect(findDictionaryItem(items, true)?.label).toBe('启用');
    expect(findDictionaryItem(items, 'true')?.label).toBe('文本 true');
  });

  it('未知对象值回退为 JSON 文本', () => {
    expect(formatDictionaryValue({ code: 'unknown' })).toBe(
      '{"code":"unknown"}',
    );
  });
});
