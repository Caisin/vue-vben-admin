import type { Job, Schedule, SyncConfig } from './data-sync';
import type { TaskRun } from './task/run';

import type { Page, PageQuery } from '#/api/request';

import { requestClient } from '#/api/request';

export interface DatabaseTable {
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
export const DatabaseSyncApi = {
  task: (id: number, taskId: number) =>
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
  ) =>
    requestClient.post<TaskRun>(`${root}/${id}/${operation}`, {
      approved_plan_hash,
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
