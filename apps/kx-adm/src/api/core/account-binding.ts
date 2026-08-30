import type { LoginType } from './auth';

import { requestClient } from '#/api/request';

export interface AccountBinding {
  app_id: string;
  created_at: number | string;
  id: number | string;
  identifier_masked: string;
  login_type: LoginType;
  removable: boolean;
  union_id_masked: string;
}

export interface DingTalkBindingStartRequest {
  app_key?: string;
  redirect_url: string;
}

export interface DingTalkBindingStartResponse {
  authorize_url: string;
}

export interface DingTalkBindingConfirmRequest {
  challenge_id: string;
  confirmed: true;
}

export interface WechatBindingRequest {
  app_id: string;
  code: string;
  login_type: 'wx_mini_app' | 'wx_mini_tel';
  os?: string;
  platform?: string;
}

export interface WechatBindingApp {
  app_id: string;
  app_name: string;
}

const basePath = '/auth/user/bindings';

export const AccountBindingApi = {
  bind_wechat: (data: WechatBindingRequest) =>
    requestClient.post<AccountBinding>(`${basePath}/wechat`, data),
  bindable_wechat_apps: () =>
    requestClient.get<WechatBindingApp[]>(`${basePath}/wechat/apps`),
  cancel_dingtalk_transfer: (challengeId: string) =>
    requestClient.delete<boolean>(
      `${basePath}/dingtalk/challenges/${encodeURIComponent(challengeId)}`,
    ),
  confirm_dingtalk_transfer: (data: DingTalkBindingConfirmRequest) =>
    requestClient.post<AccountBinding>(`${basePath}/dingtalk/confirm`, data),
  list: () => requestClient.get<AccountBinding[]>(basePath),
  remove: (id: number | string) =>
    requestClient.delete<boolean>(`${basePath}/${id}`),
  start_dingtalk: (data: DingTalkBindingStartRequest) =>
    requestClient.post<DingTalkBindingStartResponse>(
      `${basePath}/dingtalk/start`,
      data,
    ),
};
