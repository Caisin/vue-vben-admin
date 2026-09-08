import type { Job, Schedule, SyncConfig } from './data-sync';
import type { TaskRun } from './task/run';

import type { Page, PageQuery } from '#/api/request';

import { requestClient } from '#/api/request';

export interface DatabaseTable {
  sync_interval_seconds?: null | number;
  existing_job_id?: null | number;
  source_comments?: {
    comment: string;
    instance_code: string;
    schema: string;
    table: string;
  }[];
  suggestion_error?: null | string;
  target_table: string;
  config: SyncConfig;
  confirmed: boolean;
  excluded_reason: null | string;
}
export interface DatabaseWrite {
  receipt_database?: null | string;
  name: string;
  target_ds_code: string;
  target_database: string;
  warehouse: null | string;
  allow_insecure: boolean;
  table_prefix: string;
  schema_prefix: boolean;
  storage_code: string;
  sources: { instance_code: string; schema: string }[];
  tables: DatabaseTable[];
  version?: null | number;
}
export interface DatabasePlanRow {
  target_table: string;
  job_id: null | number;
  revision_id: null | number;
  plan_hash: null | string;
  state: string;
  error: null | string;
}
export interface DatabaseSync {
  schedule_paused: boolean;
  id: number;
  name: string;
  config: DatabaseWrite;
  plan: DatabasePlanRow[];
  plan_hash: null | string;
  state: string;
  version: number;
  active_task_id: null | number;
  last_task_id: null | number;
  total_tables: number;
  completed_tables: number;
  failed_tables: number;
  last_error: null | string;
}
const root = '/data-sync/databases';
export interface TableRecord {
  id: number;
  version: number;
  definition: DatabaseTable;
  plan: DatabasePlanRow;
}
export interface TablePage {
  excluded: number;
  errors: number;
  page: Page<TableRecord>;
  confirmed: number;
  pending: number;
  frequencies: (null | number)[];
}
export const DatabaseSyncApi = {
  tables: (
    id: number,
    params: PageQuery & {
      keyword?: string;
      error_codes?: string;
      target_table?: string;
      confirmed?: boolean;
      mode?: string;
      frequency?: number;
      errors?: boolean;
    },
  ) => requestClient.get<TablePage>(`${root}/${id}/tables`, { params }),
  saveTable: (
    id: number,
    row: TableRecord,
    table: DatabaseTable,
    additional: DatabaseTable[] = [],
  ) =>
    requestClient.put<TableRecord>(`${root}/${id}/tables/${row.id}`, {
      version: row.version,
      table,
      additional,
    }),
  saveSettings: (id: number, data: DatabaseWrite) =>
    requestClient.put<TaskRun>(`${root}/${id}/settings`, {
      ...data,
      tables: [],
    }),
  forceStop: (id: number, taskId: number) =>
    requestClient.post<TaskRun>(`${root}/${id}/force-stop`, {
      task_id: taskId,
    }),
  task: (id: number, taskId: number | string) =>
    requestClient.get<TaskRun>(`${root}/${id}/tasks/${taskId}`),
  list: (params: PageQuery) =>
    requestClient.get<Page<DatabaseSync>>(root, { params }),
  detail: (id: number) => requestClient.get<DatabaseSync>(`${root}/${id}`),
  save: (data: DatabaseWrite, id?: number) =>
    id
      ? requestClient.put<DatabaseSync>(`${root}/${id}`, data)
      : requestClient.post<DatabaseSync>(root, data),
  dispatch: (
    id: number,
    operation: string,
    approved_plan_hash?: null | string,
    target_table?: string,
  ) =>
    requestClient.post<TaskRun>(`${root}/${id}/${operation}`, {
      approved_plan_hash,
      target_table,
    }),
  cancel: (id: number) => requestClient.post<TaskRun>(`${root}/${id}/cancel`),
  jobs: (id: number) => requestClient.get<Job[]>(`${root}/${id}/jobs`),
  pause: (id: number, paused: boolean, version: number) =>
    requestClient.put<DatabaseSync>(`${root}/${id}/state`, { paused, version }),
  schedule: (id: number) =>
    requestClient.get<null | Schedule>(`${root}/${id}/schedule`),
  saveSchedule: (
    id: number,
    data: {
      cron_expr: string;
      enabled: boolean;
      timezone_offset_seconds: number;
    },
  ) => requestClient.put<Schedule>(`${root}/${id}/schedule`, data),
};
