import type { Page, PageQuery } from '#/api/request';

import { requestClient } from '#/api/request';

export interface DownloadGrant {
  can_download: boolean;
  id: number | string;
  res_id: number | string;
  res_name: string;
  uid: number | string;
  user_name: string;
  valid_from: number;
  valid_until: number;
}
export type DownloadGrantWrite = Pick<
  DownloadGrant,
  'can_download' | 'uid' | 'valid_from' | 'valid_until'
>;
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
export interface DownloadStats {
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

export const ResDownloadApi = {
  grants: (resId: number | string, params?: PageQuery & { uid?: number }) =>
    requestClient.get<Page<DownloadGrant>>(
      `/adm/res/${resId}/download-permissions`,
      { params },
    ),
  allGrants: (params?: PageQuery & { keyword?: string; uid?: number }) =>
    requestClient.get<Page<DownloadGrant>>('/adm/res/download-permissions', {
      params,
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
  stats: (params?: { from?: number; limit?: number; to?: number }) =>
    requestClient.get<DownloadStats>('/adm/res/download-stats', { params }),
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
