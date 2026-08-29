import type { TaskExecutorKind, TaskRun } from './run';

import type { Page, PageQuery } from '#/api/request';

import { requestClient } from '#/api/request';

export type TaskScheduleStatus = 'disabled' | 'enabled' | 'error';
export type TaskScheduleSource = 'builtin' | 'user';
export type TaskScheduleOverlapPolicy = 'allow' | 'wait';
export type TaskScheduleMisfirePolicy = 'fire_once' | 'skip';

export interface TaskSchedule {
  biz_key: string;
  created_at: number | string;
  cron_expr: string;
  empty_fire_count: number | string;
  error_message?: null | string;
  executor_code: string;
  executor_kind: TaskExecutorKind;
  id: number | string;
  instance_key: string;
  last_fire_at?: null | number | string;
  last_manual_trigger_at?: null | number | string;
  last_run_id?: null | number | string;
  max_retries: number;
  misfire_grace_seconds: number | string;
  misfire_policy: TaskScheduleMisfirePolicy;
  next_fire_at?: null | number | string;
  overlap_policy: TaskScheduleOverlapPolicy;
  params_summary: string;
  params_version: number;
  pending_fire_at?: null | number | string;
  retry_delay_seconds: number | string;
  runtime_running: boolean;
  runtime_task_id?: null | number | string;
  schedule_code: string;
  schedule_name: string;
  source: TaskScheduleSource;
  status: TaskScheduleStatus;
  timeout_seconds?: null | number | string;
  timezone_offset_seconds: number;
  updated_at: number | string;
}

export interface TaskScheduleDetail extends Omit<
  TaskSchedule,
  'params_summary'
> {
  created_by?: null | number | string;
  first_fire_at?: null | number | string;
  load_claimed_by?: null | string;
  load_fencing_token?: number | string;
  load_fire_key?: null | string;
  load_lease_until?: null | number | string;
  params: unknown;
}

export interface TaskScheduleWrite {
  biz_key: string;
  cron_expr: string;
  executor_code: string;
  instance_key?: string;
  max_retries: number;
  misfire_grace_seconds: number;
  misfire_policy: TaskScheduleMisfirePolicy;
  overlap_policy: TaskScheduleOverlapPolicy;
  params: unknown;
  params_version?: number;
  retry_delay_seconds: number;
  schedule_code?: string;
  schedule_name: string;
  status: TaskScheduleStatus;
  timeout_seconds?: null | number;
  timezone_offset_seconds: number;
}

export interface TaskScheduleQuery extends PageQuery {
  executor_code?: string;
  executor_kind?: TaskExecutorKind;
  schedule_code?: string;
  source?: TaskScheduleSource;
  status?: TaskScheduleStatus;
}

export interface TaskScheduleTriggerResult {
  duplicate: boolean;
  empty: boolean;
  message: string;
  task_run?: null | TaskRun;
}

export interface CronPreviewRequest {
  cron_expr: string;
  limit?: number;
  timezone_offset_seconds?: number;
}

export interface CronPreviewView {
  cron_expr: string;
  fire_times: Array<number | string>;
  timezone_offset_seconds: number;
}

export const TaskScheduleApi = {
  list: (params?: TaskScheduleQuery) =>
    requestClient.get<Page<TaskSchedule>>('/task/schedules', { params }),
  detail: (id: number | string) =>
    requestClient.get<TaskScheduleDetail>(`/task/schedules/${id}`),
  create: (data: TaskScheduleWrite) =>
    requestClient.post<TaskSchedule>('/task/schedules', data),
  update: (id: number | string, data: TaskScheduleWrite) =>
    requestClient.put<TaskSchedule>(`/task/schedules/${id}`, data),
  remove: (id: number | string) =>
    requestClient.delete<boolean>(`/task/schedules/${id}`),
  enable: (id: number | string) =>
    requestClient.post<TaskSchedule>(`/task/schedules/${id}/actions/enable`),
  disable: (id: number | string) =>
    requestClient.post<TaskSchedule>(`/task/schedules/${id}/actions/disable`),
  trigger: (id: number | string) =>
    requestClient.post<TaskScheduleTriggerResult>(
      `/task/schedules/${id}/actions/trigger`,
    ),
  cron_preview: (data: CronPreviewRequest) =>
    requestClient.post<CronPreviewView>('/task/cron/preview', data),
  cron_validate: (data: CronPreviewRequest) =>
    requestClient.post<CronPreviewView>('/task/cron/validate', data),
};
