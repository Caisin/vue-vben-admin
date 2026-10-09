import type { Page, PageQuery } from '#/api/request';

import { requestClient } from '#/api/request';

export interface DownloadGrant {
  can_download: boolean;
  seq_from: number;
  seq_until: number;
  id: number | string;
  res_id: number | string;
  res_name: string;
  uid: number | string;
  user_name: string;
  granted_by: number | string;
  granted_by_name: string;
  created_at: number;
  updated_at: number;
  valid_from: number;
  valid_until: number;
}
export type DownloadGrantWrite = Pick<
  DownloadGrant,
  | 'can_download'
  | 'seq_from'
  | 'seq_until'
  | 'uid'
  | 'valid_from'
  | 'valid_until'
>;
export interface DownloadBatchWrite {
  mode: 'code' | 'name';
  text: string;
  grant: DownloadGrantWrite;
  uids: number[];
  expected_res_ids?: Array<number | string>;
  selected_res_ids?: Array<number | string>;
}
export interface DownloadBatchView {
  revoked_count: number;
  granted_count: number;
  granted_user_count: number;
  matched_res_ids: Array<number | string>;
  lines: Array<{
    line: number;
    input: string;
    status: 'ambiguous' | 'duplicate' | 'matched' | 'not_found';
    message: string;
    matches: Array<{
      res_id: number | string;
      res_name: string;
      resource_code: string;
      seq_num: number;
    }>;
  }>;
}
export interface DownloadLog {
  bytes: number;
  client: string;
  file_name: string;
  id: number | string;
  ip: string;
  res_id: number | string;
  started_at: number;
  status: string;
  uid: number | string;
  user_name: string;
}
export interface DownloadUserOption {
  email: string;
  id: number | string;
  name: string;
  tel: string;
}
export interface DownloadUserTreeNode {
  value: string;
  title: string;
  selectable: boolean;
  disabled: boolean;
  children: DownloadUserTreeNode[];
}
export interface DownloadDimensionRow {
  key: string;
  label: string;
  download_count: number;
  bytes: number;
}
export interface DownloadStats {
  total_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
  active_tasks: number;
  daily: DownloadDimensionRow[];
  user_ranking: DownloadDimensionRow[];
  ip_ranking: DownloadDimensionRow[];
  client_ranking: DownloadDimensionRow[];
  from: number;
  ranking: Array<{
    bytes: number;
    download_count: number;
    last_download_at: number;
    res_id: number | string;
    resource_name: string;
  }>;
  to: number;
  total_bytes: number;
  total_downloads: number;
  unique_ips: number;
  unique_users: number;
}
export interface DownloadResourceOption {
  res_id: number | string;
  res_name: string;
  resource_code: string;
}
export interface DownloadTask {
  client: string;
  downloaded_count: number;
  error: string;
  finished_at: number;
  id: number | string;
  ip: string;
  res_id: number | string;
  res_name: string;
  started_at: number;
  status: string;
  total_count: number;
  uid: number | string;
  user_name: string;
  version_id: number | string;
  version_name: string;
}
export interface DownloadTaskItem {
  bytes: number;
  error: string;
  file_id: number | string;
  file_name: string;
  finished_at: number;
  id: number | string;
  item_name: string;
  seq_no: number;
  size: number;
  started_at: number;
  status: string;
  task_id: number | string;
}

// QsQuery 严格模式要求数组键中的括号保持字面形式，值仍按 URL 规则编码。
const grantQuerySerializer = {
  indexes: true,
  encode: (value: string) =>
    encodeURIComponent(value).replaceAll('%5B', '[').replaceAll('%5D', ']'),
};

export const ResDownloadApi = {
  userTree: () =>
    requestClient.get<DownloadUserTreeNode[]>('/adm/res/download-users/tree'),
  previewBatch: (data: DownloadBatchWrite) =>
    requestClient.post<DownloadBatchView>(
      '/adm/res/download-permissions/batch/preview',
      data,
    ),
  saveBatch: (data: DownloadBatchWrite) =>
    requestClient.post<DownloadBatchView>(
      '/adm/res/download-permissions/batch',
      data,
    ),
  grants: (
    resId: number | string,
    params?: PageQuery & { uid?: number; uids?: number[] },
  ) =>
    requestClient.get<Page<DownloadGrant>>(
      `/adm/res/${resId}/download-permissions`,
      { params, paramsSerializer: grantQuerySerializer },
    ),
  allGrants: (
    params?: PageQuery & { keyword?: string; uid?: number; uids?: number[] },
  ) =>
    requestClient.get<Page<DownloadGrant>>('/adm/res/download-permissions', {
      params,
      paramsSerializer: grantQuerySerializer,
    }),
  users: (params?: PageQuery & { keyword?: string }) =>
    requestClient.get<Page<DownloadUserOption>>('/adm/res/download-users', {
      params,
    }),
  saveGrants: (resId: number | string, grants: DownloadGrantWrite[]) =>
    requestClient.put<DownloadGrant[]>(
      `/adm/res/${resId}/download-permissions`,
      grants,
    ),
  removeGrant: (resId: number | string, uid: number | string) =>
    requestClient.delete(`/adm/res/${resId}/download-permissions/${uid}`),
  logs: (
    params?: PageQuery & {
      from?: number;
      res_id?: number;
      to?: number;
      uid?: number;
    },
  ) =>
    requestClient.get<Page<DownloadLog>>('/adm/res/download-logs', { params }),
  taskUsers: (params: PageQuery & { keyword?: string }) =>
    requestClient.get<Page<DownloadUserOption>>(
      '/adm/res/download-tasks/users',
      { params },
    ),
  taskResources: (params: PageQuery & { keyword?: string }) =>
    requestClient.get<Page<DownloadResourceOption>>(
      '/adm/res/download-tasks/resources',
      { params },
    ),
  tasks: (
    params?: PageQuery & {
      from?: number;
      ip?: string;
      keyword?: string;
      res_id?: number;
      status?: string;
      to?: number;
      uid?: number;
      user_keyword?: string;
      resource_code?: string;
      version_keyword?: string;
      version_id?: number;
    },
  ) =>
    requestClient.get<Page<DownloadTask>>('/adm/res/download-tasks', {
      params,
    }),
  taskItems: (taskId: number | string, params?: PageQuery) =>
    requestClient.get<Page<DownloadTaskItem>>(
      `/adm/res/download-tasks/${taskId}/items`,
      { params },
    ),
  stats: (params?: {
    from?: number;
    limit?: number;
    to?: number;
    uid?: number;
    res_id?: number;
    resource_code?: string;
  }) => requestClient.get<DownloadStats>('/adm/res/download-stats', { params }),
  mine: (params?: PageQuery) =>
    requestClient.get<Page<DownloadLog>>('/api/res/downloads', { params }),
  mineTasks: (params?: PageQuery) =>
    requestClient.get<Page<DownloadTask>>('/api/res/download-tasks', {
      params,
    }),
  mineTaskItems: (taskId: number | string, params?: PageQuery) =>
    requestClient.get<Page<DownloadTaskItem>>(
      `/api/res/download-tasks/${taskId}/items`,
      { params },
    ),
};
