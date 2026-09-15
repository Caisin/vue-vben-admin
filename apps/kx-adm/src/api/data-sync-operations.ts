import type { Page, PageQuery } from '#/api/request';

import { requestClient } from '#/api/request';
export type ObjectKind = 'database' | 'job';
export interface SyncTarget {
  kind: ObjectKind;
  id: number;
}
export interface SyncSummary extends SyncTarget {
  name: string;
  target: string;
  state: string;
  configuration: string;
  schedule_paused: boolean;
  version: number;
  active_id?: null | number;
  database_id?: null | number;
  plan_hash?: null | string;
  pending_batches: number;
  prepared_batches?: number;
  last_error?: null | string;
  actions: { action: string; allowed: boolean; reason?: null | string }[];
  stamp: string;
}
export interface SyncOperation {
  id: number;
  action: string;
  state: string;
  task_id?: null | number;
  total: number;
  succeeded: number;
  failed: number;
  created_at: number;
  finished_at?: null | number;
}
export interface SyncOperationItem {
  id: number;
  object_id: number;
  kind: ObjectKind;
  name: string;
  target: string;
  state: string;
  task_id?: null | number;
  error_code?: null | string;
}
const root = '/data-sync';
const objectPath = (target: SyncTarget) =>
  `${root}/${target.kind === 'job' ? 'jobs' : 'databases'}/${target.id}`;
export const SyncOperationsApi = {
  bulkPreflight: (targets: SyncTarget[], action: string) =>
    requestClient.post<{
      items: SyncSummary[];
      rejected: { kind: ObjectKind; id: number; reason: string }[];
    }>(`${root}/bulk/preflight`, { targets, action }),
  summary: (target: SyncTarget) =>
    requestClient.get<SyncSummary>(`${objectPath(target)}/status-summary`),
  preflight: (target: SyncTarget, action: string) =>
    requestClient.post<SyncSummary>(`${objectPath(target)}/preflight`, {
      action,
    }),
  submit: (
    request_id: string,
    action: string,
    targets: Array<SyncTarget & { stamp: string }>,
  ) =>
    requestClient.post<SyncOperation>(`${root}/bulk/actions`, {
      request_id,
      action,
      targets,
    }),
  list: (params: PageQuery & { state?: string }) =>
    requestClient.get<Page<SyncOperation>>(`${root}/operations`, { params }),
  get: (id: number) =>
    requestClient.get<SyncOperation>(`${root}/operations/${id}`),
  items: (
    id: number,
    params: PageQuery & { state?: string; keyword?: string },
  ) =>
    requestClient.get<Page<SyncOperationItem>>(
      `${root}/operations/${id}/items`,
      { params },
    ),
  cancel: (id: number) => requestClient.post(`${root}/operations/${id}/cancel`),
};
