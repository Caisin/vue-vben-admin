import type { DicData } from '#/api';

import { describe, expect, it } from 'vitest';

import {
  buildDicDataWrite,
  createDicDataDraft,
  toEditableDicDataRows,
} from './dictionary-data-edit';

describe('dictionary data inline edit helpers', () => {
  it('maps backend rows to editable rows with JSON text', () => {
    const rows = toEditableDicDataRows([
      {
        created_at: 1,
        dic_code: 'state',
        enabled: true,
        id: 10,
        is_def: false,
        label: '启用',
        remark: '',
        sort_no: 1,
        value: { color: 'success', value: true },
      },
    ] satisfies DicData[]);

    expect(rows[0]).toMatchObject({
      __dirty: false,
      __is_new: false,
      __value_text: '{\n  "color": "success",\n  "value": true\n}',
    });
  });

  it('builds write payload from edited row JSON text', () => {
    const row = createDicDataDraft('state', 2, 123);
    row.label = '停用';
    row.__value_text = 'false';

    expect(buildDicDataWrite(row)).toEqual({
      data: {
        dic_code: 'state',
        enabled: true,
        is_def: false,
        label: '停用',
        remark: '',
        sort_no: 2,
        value: false,
      },
      ok: true,
    });
  });

  it('rejects invalid JSON value text', () => {
    const row = createDicDataDraft('state', 1, 123);
    row.label = '坏值';
    row.__value_text = '{bad';

    expect(buildDicDataWrite(row)).toEqual({
      message: '字典值必须是合法 JSON',
      ok: false,
    });
  });
});
