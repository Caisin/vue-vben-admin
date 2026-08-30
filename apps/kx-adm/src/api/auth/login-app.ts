import type { Page, PageQuery } from '#/api/request';

import { requestClient } from '#/api/request';

export interface DingtalkAppConfig {
  app_key: string;
  app_name: string;
  created_at: number | string;
  credentials_configured: boolean;
  app_secret_credential_code: string;
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
  app_key: string;
  app_name: string;
  app_secret: string;
  app_secret_credential_code?: string;
  enabled: boolean;
  is_def: boolean;
  remark: string;
}

export interface DingtalkAppUpdate {
  app_name: string;
  app_secret: string;
  app_secret_credential_code?: string;
  enabled: boolean;
  is_def: boolean;
  remark: string;
}

export interface WechatAppConfig {
  app_id: string;
  app_key: string;
  app_name: string;
  company: string;
  created_at: number | string;
  credentials_configured: boolean;
  app_secret_credential_code: string;
  token_credential_code: string;
  msg_aes_key_credential_code: string;
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
  app_id: string;
  app_key: string;
  app_name: string;
  app_secret: string;
  app_secret_credential_code?: string;
  company: string;
  enabled: boolean;
  mch_id: number | string;
  msg_aes_key: string;
  offer_id: string;
  remark: string;
  token: string;
  token_credential_code?: string;
  msg_aes_key_credential_code?: string;
}

export type WechatAppUpdate = Omit<WechatAppCreate, 'app_id'>;

const basePath = '/auth/login-app';

export const LoginAppApi = {
  dingtalk_callback_base: () =>
    requestClient.get<DingtalkCallbackBase>(
      `${basePath}/dingtalk/callback-base`,
    ),
  dingtalk_callback_base_save: (data: DingtalkCallbackBase) =>
    requestClient.put<DingtalkCallbackBase>(
      `${basePath}/dingtalk/callback-base`,
      data,
    ),
  dingtalk_list: (params?: DingtalkAppListQuery) =>
    requestClient.get<Page<DingtalkAppConfig>>(`${basePath}/dingtalk`, {
      params,
    }),
  dingtalk_detail: (app_key: string) =>
    requestClient.get<DingtalkAppConfig>(
      `${basePath}/dingtalk/${encodeURIComponent(app_key)}`,
    ),
  dingtalk_create: (data: DingtalkAppCreate) =>
    requestClient.post<DingtalkAppConfig>(`${basePath}/dingtalk`, data),
  dingtalk_update: (app_key: string, data: DingtalkAppUpdate) =>
    requestClient.put<DingtalkAppConfig>(
      `${basePath}/dingtalk/${encodeURIComponent(app_key)}`,
      data,
    ),
  dingtalk_remove: (app_key: string) =>
    requestClient.delete<boolean>(
      `${basePath}/dingtalk/${encodeURIComponent(app_key)}`,
    ),
  wechat_list: (params?: WechatAppListQuery) =>
    requestClient.get<Page<WechatAppConfig>>(`${basePath}/wechat`, {
      params,
    }),
  wechat_detail: (app_id: string) =>
    requestClient.get<WechatAppConfig>(
      `${basePath}/wechat/${encodeURIComponent(app_id)}`,
    ),
  wechat_create: (data: WechatAppCreate) =>
    requestClient.post<WechatAppConfig>(`${basePath}/wechat`, data),
  wechat_update: (app_id: string, data: WechatAppUpdate) =>
    requestClient.put<WechatAppConfig>(
      `${basePath}/wechat/${encodeURIComponent(app_id)}`,
      data,
    ),
  wechat_remove: (app_id: string) =>
    requestClient.delete<boolean>(
      `${basePath}/wechat/${encodeURIComponent(app_id)}`,
    ),
};
