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

export type AccountMergeProfileSource = 'current' | 'dingtalk';
export type AccountMergeKeepAccount = 'current' | 'dingtalk';
export type AccountMergeReauthMode = 'password' | 'step_up_grant' | 'totp';
export type AccountMergeStatus =
  | 'cancelled'
  | 'completed'
  | 'failed'
  | 'pending'
  | 'running';

export interface AccountMergeUserSummary {
  avatar_url?: string;
  created_at: number | string;
  display_name: string;
  email_masked?: string;
  login_types: string[];
  mobile_masked?: string;
  uid: number | string;
}

export interface AccountMergeDomainSummary {
  blocking: boolean;
  business_code: string;
  conflict_count: number | string;
  display_name: string;
  source_count: number | string;
  summary?: string;
  target_count: number | string;
}

export interface AccountMergeChallenge {
  app_key: string;
  challenge_id: string;
  current_user: AccountMergeUserSummary;
  dingtalk_user: AccountMergeUserSummary;
  domains: AccountMergeDomainSummary[];
  expires_at: number | string;
  reauth_modes: AccountMergeReauthMode[];
}

export interface AccountMergeCreateRequest {
  challenge_id: string;
  grant_token?: string;
  keep_account: AccountMergeKeepAccount;
  password?: string;
  profile_selection: Record<string, AccountMergeProfileSource>;
}

export interface AccountMergeStep {
  affected_count: number | string;
  business_code: string;
  error_summary?: string;
  finished_at?: number | string;
  id: number | string;
  started_at?: number | string;
  status: 'completed' | 'failed' | 'pending' | 'running' | 'skipped';
}

export interface AccountMerge {
  created_at: number | string;
  error_summary?: string;
  finished_at?: number | string;
  id: number | string;
  source_uid: number | string;
  status: AccountMergeStatus;
  steps: AccountMergeStep[];
  target_uid: number | string;
  task_run_id?: number | string;
  updated_at: number | string;
}

const basePath = '/auth/user/bindings';

export const AccountBindingApi = {
  bind_wechat: (data: WechatBindingRequest) =>
    requestClient.post<AccountBinding>(`${basePath}/wechat`, data),
  bindable_wechat_apps: () =>
    requestClient.get<WechatBindingApp[]>(`${basePath}/wechat/apps`),
  list: () => requestClient.get<AccountBinding[]>(basePath),
  remove: (id: number | string) =>
    requestClient.delete<boolean>(`${basePath}/${id}`),
  start_dingtalk: (data: DingTalkBindingStartRequest) =>
    requestClient.post<DingTalkBindingStartResponse>(
      `${basePath}/dingtalk/start`,
      data,
    ),
};

const mergePath = '/auth/user';

export const AccountMergeApi = {
  abandonChallenge: (challengeId: string) =>
    requestClient.delete<null>(
      `${mergePath}/merge-challenges/${encodeURIComponent(challengeId)}`,
    ),
  challenge: (challengeId: string) =>
    requestClient.get<AccountMergeChallenge>(
      `${mergePath}/merge-challenges/${encodeURIComponent(challengeId)}`,
    ),
  create: (data: AccountMergeCreateRequest) =>
    requestClient.post<AccountMerge>(`${mergePath}/merges`, data),
  detail: (id: number | string) =>
    requestClient.get<AccountMerge>(`${mergePath}/merges/${id}`),
  retry: (id: number | string) =>
    requestClient.post<AccountMerge>(`${mergePath}/merges/${id}/retry`),
};
