import type { Job, RunListItem } from '#/api/data-sync';

export const schemaConflictErrors: Record<string, string> = {
  data_sync_source_schema_drift: '源表结构与已启用快照不一致',
  data_sync_target_schema_drift: '目标表结构与已启用计划不一致',
  data_sync_target_schema_mismatch: '目标表结构与待启用计划不一致',
  data_sync_schema_changed_since_inspect: '表结构在检查后再次发生变化',
  data_sync_batch_schema_mismatch: '未完成批次与当前结构不一致',
  data_sync_schema_reinspection_required: '结构冲突需要重新检查并批准新版本',
};

export function isSchemaConflict(code?: null | string) {
  return !!code && Object.hasOwn(schemaConflictErrors, code);
}

export function schemaSettingsQuery(row: Job | RunListItem, edit = false) {
  const jobId = 'job_id' in row ? row.job_id : row.id;
  return {
    ...(row.database_id
      ? { database_id: String(row.database_id), target_table: row.target_table }
      : { job_id: String(jobId) }),
    ...(edit ? { edit: '1' } : {}),
  };
}
