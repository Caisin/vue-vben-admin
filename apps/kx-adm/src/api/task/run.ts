import type { Page, PageQuery } from '#/api/request';

import { requestClient } from '#/api/request';

export type TaskExecutorKind = 'business' | 'http' | 'shell';
export type TaskRunTrigger = 'cron' | 'dispatch' | 'manual';
export type TaskRunStatus =
  | 'cancelled'
  | 'failed'
  | 'partially_succeeded'
  | 'queued'
  | 'retrying'
  | 'running'
  | 'skipped'
  | 'succeeded';

export interface TaskRun {
  attempt: number;
  biz_key: string;
  cancel_requested_at?: null | number | string;
  created_by?: null | number | string;
  detail_label?: null | string;
  detail_path?: null | string;
  error_code?: null | string;
  error_message?: null | string;
  executor_code: string;
  executor_kind: TaskExecutorKind;
  failed_count: number | string;
  finished_at?: null | number | string;
  heartbeat_at?: null | number | string;
  id: number | string;
  max_attempts: number;
  message: string;
  next_retry_at?: null | number | string;
  queued_at: number | string;
  running_count: number | string;
  schedule_code?: null | string;
  schedule_id?: null | number | string;
  schedule_name?: null | string;
  scheduled_at: number | string;
  started_at?: null | number | string;
  status: TaskRunStatus;
  succeeded_count: number | string;
  total_count?: null | number | string;
  trigger: TaskRunTrigger;
  updated_at: number | string;
}

export interface TaskRunQuery extends PageQuery {
  biz_key?: string;
  created_by?: number | string;
  executor_code?: string;
  schedule_id?: number | string;
  scheduled_range?: [number | string, number | string] | string;
  status?: TaskRunStatus;
  trigger?: TaskRunTrigger;
}

export interface TaskRunFilterExecutorOption {
  display_name: string;
  executor_code: string;
}

export interface TaskRunFilterOptions {
  biz_keys: string[];
  executors: TaskRunFilterExecutorOption[];
}

export const TaskRunApi = {
  list: (params?: TaskRunQuery) =>
    requestClient.get<Page<TaskRun>>('/task/runs', { params }),
  detail: (id: number | string) =>
    requestClient.get<TaskRun>(`/task/runs/${id}`),
  cancel: (id: number | string) =>
    requestClient.post<TaskRun>(`/task/runs/${id}/actions/cancel`),
  filterOptions: (params?: { keyword?: string }) =>
    requestClient.get<TaskRunFilterOptions>('/task/runs/filter-options', {
      params,
    }),
};
