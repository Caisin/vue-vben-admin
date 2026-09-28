import { requestClient } from '#/api/request';

export interface AppShortSyncRunWrite {
  cdn_base: string;
  resource_ids?: number[];
  concurrency?: number;
}

export interface AppShortSyncRunRecord {
  id: number;
  created_by: number;
  state: string;
  total: number;
  processed: number;
  failed: number;
  error_code: string;
  config: {
    cdn_base?: string;
    resource_ids?: number[];
    concurrency?: number;
  };
  created_at: number;
  updated_at: number;
}

export interface AppShortSyncRunView {
  run: AppShortSyncRunRecord;
}

export interface AppShortSyncVideoRecord {
  id: number;
  source_id: number;
  res_id: number;
  version_id: number;
  seq_no: number;
  state: string;
  stage: string;
  progress_current: number;
  progress_total: null | number;
  progress_unit: string;
  attempts: number;
  error_code: string;
  updated_at: number;
}

export interface AppShortSyncVideoPage {
  items: Array<{ video: AppShortSyncVideoRecord }>;
  total: number;
  pages: number;
  page_no: number;
  page_size: number;
  counts: Record<string, number>;
}
export interface AppShortSyncResourceSummary {
  res_id: number;
  res_name: string;
  resource_code: string;
  cover_synced: boolean;
  cover_error: string;
  source_id: string;
  languages: string[];
  version_count: number;
  state: string;
  paused: number;
  updated_at: number;
  total: number;
  pending: number;
  running: number;
  succeeded: number;
  failed: number;
  conflict: number;
  failure_reasons: string[];
}

export interface AppShortSyncSettings {
  concurrency: number;
}

export interface SyncTask {
  id: number;
  status: string;
  cancel_requested_at: null | number;
  total_count: null | number;
  succeeded_count: number;
  failed_count: number;
  message: string;
  error_message?: null | string;
}

export const AppShortSyncApi = {
  getSettings: () =>
    requestClient.get<AppShortSyncSettings>('/adm/res/app-short-sync/settings'),
  saveSettings: (data: AppShortSyncSettings) =>
    requestClient.put<AppShortSyncSettings>(
      '/adm/res/app-short-sync/settings',
      data,
    ),
  createRun: (data: AppShortSyncRunWrite) =>
    requestClient.post<AppShortSyncRunView>(
      '/adm/res/app-short-sync/runs',
      data,
    ),
  listRuns: (params?: { page?: number; size?: number }) =>
    requestClient.get<{
      items: AppShortSyncRunRecord[];
      total: number;
      pages: number;
      page_no: number;
      page_size: number;
    }>('/adm/res/app-short-sync/runs', { params }),
  getRun: (id: number) =>
    requestClient.get<AppShortSyncRunView>(
      `/adm/res/app-short-sync/runs/${id}`,
    ),
  listVideos: (params?: {
    page?: number;
    size?: number;
    res_id?: number;
    version_id?: number;
    source_id?: number;
    state?: string;
  }) =>
    requestClient.get<AppShortSyncVideoPage>('/adm/res/app-short-sync/videos', {
      params,
    }),
  resourceSummary: (params?: {
    keyword?: string;
    res_id?: number;
    state?: string;
  }) =>
    requestClient.get<AppShortSyncResourceSummary[]>(
      '/adm/res/app-short-sync/videos/resources',
      { params },
    ),
  retryVideos: (ids: number[]) =>
    requestClient.post<{ updated: number }>(
      '/adm/res/app-short-sync/videos/retry',
      { ids },
    ),
  migrationStatus: (cover_only = false, res_id?: number) =>
    requestClient.get<null | SyncTask>(
      '/adm/res/app-short-sync/videos/migrate',
      { params: { cover_only, res_id } },
    ),
  migrateVideos: (res_id?: number, cover_only = false) =>
    requestClient.post<SyncTask>('/adm/res/app-short-sync/videos/migrate', {
      res_id,
      cover_only,
    }),
  stopResource: (resId: number) =>
    requestClient.post(`/adm/res/app-short-sync/resources/${resId}/stop`),
  stopMigration: (taskId: number) =>
    requestClient.post<SyncTask>(
      `/adm/res/app-short-sync/videos/migrate/${taskId}/stop`,
    ),
};
