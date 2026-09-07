import type { Job, RunListItem } from '#/api/data-sync';

import { describe, expect, it } from 'vitest';

import {
  isSchemaConflict,
  schemaConflictErrors,
  schemaSettingsQuery,
} from '../../schema-conflict';

describe('同步结构冲突', () => {
  it('只识别稳定结构错误码', () => {
    for (const code of Object.keys(schemaConflictErrors))
      expect(isSchemaConflict(code)).toBe(true);
    for (const code of [
      null,
      undefined,
      '',
      'data_sync_source_query_timeout',
      'data_sync_source_schema_drift_extra',
    ])
      expect(isSchemaConflict(code)).toBe(false);
  });
  it('全库子表精确定位目标表，不用运行 ID 代替任务 ID', () => {
    const run = {
      id: 99,
      job_id: 7,
      database_id: 3,
      target_table: 'orders',
    } as RunListItem;
    expect(schemaSettingsQuery(run, true)).toEqual({
      database_id: '3',
      target_table: 'orders',
      edit: '1',
    });
    expect(schemaSettingsQuery({ ...run, database_id: null })).toEqual({
      job_id: '7',
    });
    expect(schemaSettingsQuery({ id: 7 } as Job, true)).toEqual({
      job_id: '7',
      edit: '1',
    });
  });
});
