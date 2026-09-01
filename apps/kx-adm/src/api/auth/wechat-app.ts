import type { Page, PageQuery } from '#/api/request';

import { requestClient } from '#/api/request';
export interface WechatAppConfig {
  app_id: string;
  app_name: string;
  company: string;
  created_at: number | string;
  credentials_configured: boolean;
  credential_code: string;
  enabled: boolean;
  mch_id: number | string;
  offer_id: string;
  remark: string;
}
export interface WechatAppListQuery extends PageQuery {
  app_id_prefix?: string;
  app_name_prefix?: string;
  enabled?: boolean;
}
export interface WechatAppCreate {
  app_name: string;
  company: string;
  credential_code: string;
  enabled: boolean;
  mch_id: number | string;
  offer_id: string;
  remark: string;
}
export type WechatAppUpdate = WechatAppCreate;
const basePath = '/auth/login-app/wechat';
export const WechatAppApi = {
  list: (params?: WechatAppListQuery) =>
    requestClient.get<Page<WechatAppConfig>>(basePath, { params }),
  detail: (appId: string) =>
    requestClient.get<WechatAppConfig>(
      `${basePath}/${encodeURIComponent(appId)}`,
    ),
  create: (data: WechatAppCreate) =>
    requestClient.post<WechatAppConfig>(basePath, data),
  update: (appId: string, data: WechatAppUpdate) =>
    requestClient.put<WechatAppConfig>(
      `${basePath}/${encodeURIComponent(appId)}`,
      data,
    ),
  remove: (appId: string) =>
    requestClient.delete<boolean>(`${basePath}/${encodeURIComponent(appId)}`),
};
