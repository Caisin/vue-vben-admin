import type { TaskExecutorKind } from './run';

import type { JsonValue } from '#/api/request';

import { requestClient } from '#/api/request';

export type TaskExecutorCardinality = 'multiple' | 'singleton';

export interface TaskPayloadOption {
  disabled?: boolean;
  help_msg?: null | string;
  label: string;
  value: JsonValue;
}

export interface TaskPayloadPropertySchema {
  const?: JsonValue;
  description?: string;
  enum?: JsonValue[];
  help_msg?: string;
  maximum?: number;
  minimum?: number;
  minLength?: number;
  title?: string;
  type?: string | string[];
  x_options?: TaskPayloadOption[];
  x_options_source?: boolean | string;
}

export interface TaskPayloadSchema {
  properties?: Record<string, TaskPayloadPropertySchema>;
  required?: string[];
  type?: string;
}

export interface TaskPayloadSchemaLoadRequest {
  params?: Record<string, unknown>;
}

export interface TaskExecutor {
  allow_cron: boolean;
  cardinality: TaskExecutorCardinality;
  description: string;
  display_name: string;
  executor_code: string;
  executor_kind: TaskExecutorKind;
  has_detail: boolean;
  minimum_interval_seconds: number;
  params_version: number;
  payload_schema: TaskPayloadSchema;
}

export const TaskExecutorApi = {
  list: () => requestClient.get<TaskExecutor[]>('/task/executors'),
  schema: (executorCode: string, data: TaskPayloadSchemaLoadRequest = {}) =>
    requestClient.post<TaskExecutor>(
      `/task/executors/${encodeURIComponent(executorCode)}/schema`,
      data,
    ),
};
