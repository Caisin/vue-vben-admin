import type { Page, PageQuery } from '#/api/request';

import { requestClient } from '#/api/request';
export interface DingtalkAppConfig {
  app_key: string;
  app_name: string;
  created_at: number | string;
  credentials_configured: boolean;
  credential_code: string;
  enabled: boolean;
  is_def: boolean;
  remark: string;
}
export interface DingtalkCallbackBase {
  callback_base_url: string;
}
export interface DingtalkAppListQuery extends PageQuery {
  app_key_prefix?: string;
  app_name_prefix?: string;
  enabled?: boolean;
  is_def?: boolean;
}
export interface DingtalkAppCreate {
  app_name: string;
  credential_code: string;
  enabled: boolean;
  is_def: boolean;
  remark: string;
}
export type DingtalkAppUpdate = DingtalkAppCreate;
const basePath = '/auth/login-app/dingtalk';
export const DingtalkAppApi = {
  callbackBase: () =>
    requestClient.get<DingtalkCallbackBase>(`${basePath}/callback-base`),
  saveCallbackBase: (data: DingtalkCallbackBase) =>
    requestClient.put<DingtalkCallbackBase>(`${basePath}/callback-base`, data),
  list: (params?: DingtalkAppListQuery) =>
    requestClient.get<Page<DingtalkAppConfig>>(basePath, { params }),
  detail: (appKey: string) =>
    requestClient.get<DingtalkAppConfig>(
      `${basePath}/${encodeURIComponent(appKey)}`,
    ),
  create: (data: DingtalkAppCreate) =>
    requestClient.post<DingtalkAppConfig>(basePath, data),
  update: (appKey: string, data: DingtalkAppUpdate) =>
    requestClient.put<DingtalkAppConfig>(
      `${basePath}/${encodeURIComponent(appKey)}`,
      data,
    ),
  remove: (appKey: string) =>
    requestClient.delete<boolean>(`${basePath}/${encodeURIComponent(appKey)}`),
};
