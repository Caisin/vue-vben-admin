import type { JsonValue, Page, PageQuery } from '#/api/request';
import type { TaskRun } from '#/api/task';

import { requestClient } from '#/api/request';

export type OrgProvider = 'dingtalk' | 'feishu';
export type OrgSyncStatus = 'failed' | 'running' | 'succeeded';
export type OrgEntityType = 'department' | 'user';
export type OrgSnapshotEvent =
  | 'joined'
  | 'left'
  | 'rejoined'
  | 'unchanged'
  | 'updated';

export interface OrgSyncSource {
  code: string;
  enabled: boolean;
  name: string;
}

export interface OrgSyncRequest {
  source: string;
}

export interface OrgSyncRun {
  department_created: number;
  department_left: number;
  department_total: number;
  department_updated: number;
  error_message?: null | string;
  finished_at?: null | number | string;
  id: number | string;
  provider: OrgProvider;
  source_id: string;
  started_at: number | string;
  status: OrgSyncStatus;
  user_created: number;
  user_left: number;
  user_rejoined: number;
  user_total: number;
  user_updated: number;
}

export interface OrgSyncRunQuery extends PageQuery {
  source?: string;
  status?: OrgSyncStatus;
}

export interface OrgUserLink {
  active: boolean;
  display_name: string;
  email: string;
  first_seen_at: number | string;
  id: number | string;
  last_seen_at: number | string;
  last_sync_id: number | string;
  left_at?: null | number | string;
  mobile: string;
  provider: OrgProvider;
  rejoin_count: number;
  source_id: string;
  uid: number | string;
}

export interface OrgUserLinkQuery extends PageQuery {
  active?: boolean;
  display_name_prefix?: string;
  source?: string;
}

export interface DingtalkOperatorOption {
  display_name: string;
  mobile: string;
  uid: number | string;
  union_id: string;
}

export interface DingtalkOperatorQuery extends PageQuery {
  display_name_prefix?: string;
  keyword?: string;
  uid?: number | string;
}

export interface DingtalkOperatorTreeNode {
  children: DingtalkOperatorTreeNode[];
  dept_id: number | string;
  dept_name: string;
  users: DingtalkOperatorOption[];
}

export interface OrgSnapshotRecord {
  captured_at: number | string;
  entity_type: OrgEntityType;
  event: OrgSnapshotEvent;
  external_id: string;
  id: number | string;
  link_id: number | string;
  payload: JsonValue;
  provider: OrgProvider;
  source_id: string;
  sync_id: number | string;
}

export interface OrgUserHistoryQuery extends PageQuery {
  event?: OrgSnapshotEvent;
}

export interface OrgUserSystemSyncResult {
  created: boolean;
  uid: number | string;
}

export const OrgSyncApi = {
  dingtalk_operators: (appKey: string, params?: DingtalkOperatorQuery) =>
    requestClient.get<Page<DingtalkOperatorOption>>(
      `/auth/dingtalk-operators/${appKey}`,
      { params },
    ),
  dingtalk_operator_tree: (appKey: string) =>
    requestClient.get<DingtalkOperatorTreeNode[]>(
      `/auth/dingtalk-operators/tree/${appKey}`,
    ),
  sources: () => requestClient.get<OrgSyncSource[]>('/auth/org-sync/sources'),
  runs: (params?: OrgSyncRunQuery) =>
    requestClient.get<Page<OrgSyncRun>>('/auth/org-sync/runs', { params }),
  run: (data: OrgSyncRequest) =>
    requestClient.post<TaskRun>('/auth/org-sync/run', data),
  users: (params?: OrgUserLinkQuery) =>
    requestClient.get<Page<OrgUserLink>>('/auth/org-sync/users', { params }),
  user_history: (id: number | string, params?: OrgUserHistoryQuery) =>
    requestClient.get<Page<OrgSnapshotRecord>>(
      `/auth/org-sync/users/${id}/history`,
      { params },
    ),
  sync_system_user: (id: number | string) =>
    requestClient.post<OrgUserSystemSyncResult>(
      `/auth/org-sync/users/${id}/sync-system-user`,
    ),
};
