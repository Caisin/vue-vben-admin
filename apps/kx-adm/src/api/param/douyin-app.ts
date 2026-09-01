import type { Page, PageQuery } from '#/api/request';

import { requestClient } from '#/api/request';

export interface DouyinAppConfig {
  acc_id: number | string;
  app_id: string;
  app_name: string;
  company: string;
  created_at: number | string;
  credential_code: string;
  deposit_info: Record<string, unknown>;
  enabled: boolean;
  icon_url: string;
  is_online: boolean;
  salt_credential_code: string;
  token_credential_code: string;
}

export type DouyinAppWrite = Omit<
  DouyinAppConfig,
  'app_id' | 'created_at' | 'deposit_info'
>;

export interface DouyinAppListQuery extends PageQuery {
  app_id_prefix?: string;
  app_name_prefix?: string;
  enabled?: boolean;
}

const basePath = '/param/douyin-apps';

export const DouyinAppApi = {
  list: (params?: DouyinAppListQuery) =>
    requestClient.get<Page<DouyinAppConfig>>(basePath, { params }),
  detail: (appId: string) =>
    requestClient.get<DouyinAppConfig>(
      `${basePath}/${encodeURIComponent(appId)}`,
    ),
  create: (data: DouyinAppWrite) =>
    requestClient.post<DouyinAppConfig>(basePath, data),
  update: (appId: string, data: DouyinAppWrite) =>
    requestClient.put<DouyinAppConfig>(
      `${basePath}/${encodeURIComponent(appId)}`,
      data,
    ),
  remove: (appId: string) =>
    requestClient.delete<boolean>(`${basePath}/${encodeURIComponent(appId)}`),
};
