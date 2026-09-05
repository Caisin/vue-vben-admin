import type { Page, PageQuery } from '#/api/request';
import type { TaskRun } from '#/api/task/run';

import { requestClient } from '#/api/request';

export interface MetadataOptions {
  items: { label: string; value: string }[];
  has_more: boolean;
}
export interface WarehouseOptions extends MetadataOptions {
  availability: 'available' | 'license_unavailable' | 'unsupported';
}
export interface SourceColumn {
  name: string;
  data_type: string;
  nullable: boolean;
  primary_key: boolean;
  comment: string;
}

export interface Instance {
  code: string;
  ds_code: string;
  name: string;
  enabled: boolean;
  allow_insecure: boolean;
  version: number;
}
export interface TargetType {
  kind: string;
  precision?: number;
  scale?: number;
}
export interface FieldMapping {
  source: null | string;
  target: string;
  target_type?: null | TargetType;
  nullable?: boolean | null;
  transform: { kind: string; value?: unknown };
}
export interface Binding {
  instance_code: string;
  schema: string;
  table: string;
  id_column: null | string;
  updated_column: null | string;
  soft_delete_column: null | string;
  source_timezone: string;
  fields: FieldMapping[];
}
export interface SyncConfig {
  mode: 'full_table' | 'id_and_time' | 'id_append' | 'time_window';
  window?: null | {
    immutable_time_confirmed: boolean;
    include_open_window: boolean;
    lookback_windows: number;
    start_at: string;
    timezone: string;
    unit: 'day' | 'hour';
  };
  storage_code: string;
  sources: Binding[];
  limits: {
    id_span: number;
    max_bytes: number;
    max_rows: number;
    overlap_seconds: number;
    settle_delay_seconds: number;
    snapshot_max_bytes?: number;
    source_concurrency: number;
  };
}
export interface JobWrite {
  name: string;
  target_ds_code: string;
  target_database: string;
  target_table: string;
  warehouse?: null | string;
  allow_insecure: boolean;
  config: SyncConfig;
  version?: number;
}
export interface Job extends Omit<JobWrite, 'config'> {
  database_id?: null | number;
  id: number;
  code: string;
  state: string;
  version: number;
  draft_revision_id?: null | number;
  active_revision_id?: null | number;
  active_run_id?: null | number;
  last_error?: null | string;
}
export interface SchemaPlan {
  primary_key_column: null | string;
  schema_hash: string;
  ddl: string;
  warnings: string[];
  target_columns: {
    comment: string;
    data_type: TargetType;
    name: string;
    nullable: boolean;
  }[];
  bindings: {
    binding_id: number;
    instance_code: string;
    source_columns: {
      data_type: string;
      name: string;
      nullable: boolean;
      primary_key: boolean;
    }[];
  }[];
}
export interface Revision {
  id: number;
  revision_no: number;
  state: string;
  config: SyncConfig;
  plan_hash?: null | string;
  schema_plan?: null | SchemaPlan;
}
export interface Checkpoint {
  binding_id: number;
  confirmed_id: null | string;
  baseline_done: boolean;
  closed_time_end: null | string;
  next_seq: number;
}
export interface JobDetail {
  job: Job;
  draft: null | Revision;
  active: null | Revision;
  instances: Instance[];
  checkpoints: Checkpoint[];
}
export interface SyncRun {
  id: number;
  job_id: number;
  task_run_id: number;
  operation: string;
  state: string;
  read_rows: number;
  written_rows: number;
  bytes: number;
  error_code?: null | string;
  started_at: number;
  finished_at?: null | number;
}
export interface SourceProgress {
  id: number;
  binding_id: number;
  phase: string;
  state: string;
  read_rows: number;
  written_rows: number;
  batches: number;
  target_max_id: null | string;
  message: string;
}
export interface RunDetail {
  run: SyncRun;
  sources: SourceProgress[];
}
export interface Batch {
  id: string;
  binding_id: number;
  seq: number;
  state: string;
  read_rows: number;
  written_rows: number;
  bytes: number;
  error_code?: null | string;
}
export interface Schedule {
  id: number;
  cron_expr: string;
  timezone_offset_seconds: number;
  status: string;
  next_fire_at?: null | number;
}
const root = '/data-sync';
export const DataSyncApi = {
  targetWarehouses: (data: {
    allow_insecure: boolean;
    ds_code: string;
    keyword?: string;
  }) => requestClient.post<WarehouseOptions>(`${root}/target-warehouses`, data),
  sourceSchemas: (code: string, keyword = '') =>
    requestClient.get<MetadataOptions>(
      `${root}/instances/${encodeURIComponent(code)}/schemas`,
      { params: { keyword } },
    ),
  sourceTables: (code: string, schema: string, keyword = '') =>
    requestClient.get<MetadataOptions>(
      `${root}/instances/${encodeURIComponent(code)}/tables`,
      { params: { schema, keyword } },
    ),
  sourceColumns: (code: string, schema: string, table: string) =>
    requestClient.get<SourceColumn[]>(
      `${root}/instances/${encodeURIComponent(code)}/columns`,
      { params: { schema, table } },
    ),
  targetDatabases: (data: {
    allow_insecure: boolean;
    ds_code: string;
    keyword?: string;
    warehouse?: null | string;
  }) => requestClient.post<MetadataOptions>(`${root}/target-databases`, data),
  jobs: (params?: PageQuery & { keyword?: string }) =>
    requestClient.get<Page<Job>>(`${root}/jobs`, { params }),
  detail: (id: number) => requestClient.get<JobDetail>(`${root}/jobs/${id}`),
  save: (data: JobWrite, id?: number) =>
    id
      ? requestClient.put<Job>(`${root}/jobs/${id}`, data)
      : requestClient.post<Job>(`${root}/jobs`, data),
  instances: () => requestClient.get<Instance[]>(`${root}/instances`),
  createInstance: (data: {
    allow_insecure: boolean;
    code: string;
    ds_code: string;
    name: string;
  }) => requestClient.post<Instance>(`${root}/instances`, data),
  updateInstance: (
    code: string,
    data: { enabled: boolean; name: string; version: number },
  ) =>
    requestClient.put<Instance>(
      `${root}/instances/${encodeURIComponent(code)}`,
      data,
    ),
  state: (job: Job, paused: boolean) =>
    requestClient.put<Job>(`${root}/jobs/${job.id}/state`, {
      paused,
      version: job.version,
    }),
  dispatch: (
    id: number,
    action: 'activate' | 'inspect' | 'reconcile' | 'sync',
    request = {},
  ) => requestClient.post<TaskRun>(`${root}/jobs/${id}/${action}`, request),
  runs: (id: number, params?: PageQuery) =>
    requestClient.get<Page<SyncRun>>(`${root}/jobs/${id}/runs`, { params }),
  run: (id: number) => requestClient.get<RunDetail>(`${root}/runs/${id}`),
  batches: (id: number, params?: PageQuery) =>
    requestClient.get<Page<Batch>>(`${root}/runs/${id}/batches`, { params }),
  cancel: (id: number) =>
    requestClient.post<TaskRun>(`${root}/runs/${id}/cancel`, {}),
  schedule: (id: number) =>
    requestClient.get<null | Schedule>(`${root}/jobs/${id}/schedule`),
  saveSchedule: (
    id: number,
    data: {
      cron_expr: string;
      enabled: boolean;
      timezone_offset_seconds: number;
    },
  ) => requestClient.put<Schedule>(`${root}/jobs/${id}/schedule`, data),
};
