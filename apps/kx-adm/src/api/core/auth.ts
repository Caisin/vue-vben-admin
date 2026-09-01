import type {
  AdminCurrentUser,
  AdminCurrentUserResponse,
  BusinessContact,
} from '#/auth';

import { apiURL, encryptedRequestClient, requestClient } from '#/api/request';
import { normalizeAdminCurrentUser, toVbenUserInfo } from '#/auth';

export type LoginType =
  | 'ding_talk'
  | 'user_name'
  | 'wx_mini_app'
  | 'wx_mini_tel';

/** 本地账号或第三方登录请求，字段与 Rust `LoginRequest` 保持 snake_case。 */
export interface LoginParams {
  android_id?: string;
  app_id?: string;
  avatar?: string;
  code?: string;
  device_id?: string;
  email?: string;
  guest_id?: string;
  idfa_id?: string;
  login_type?: LoginType;
  open_id?: string;
  os?: string;
  password?: string;
  platform?: string;
  tel?: string;
  union_id?: string;
  user_confirm?: boolean;
  user_name?: string;
}

/** kx-axum `AuthBody` 原始响应，字段保持 snake_case。 */
export interface AuthBody {
  access_token: string;
  exp_at: number | string;
  exp_in: number | string;
  token_type: string;
  uid: number | string;
}

/** 登录已通过账号密码校验，但还需要输入 TOTP 验证码的一次性 challenge。 */
export interface MfaLoginChallenge {
  challenge_id: string;
  expires_at: number | string;
  methods: string[];
  mfa_required: true;
}

export type LoginResponse = AuthBody | MfaLoginChallenge;

export interface MfaLoginRequest {
  challenge_id: string;
  totp_code: string;
}

export interface MfaStatusView {
  account_label: string;
  confirmed_at?: null | number | string;
  issuer: string;
  password_required: boolean;
  setup_allowed: boolean;
  totp_enabled: boolean;
  updated_at?: null | number | string;
}

export interface TotpSetupView {
  account_label: string;
  expires_at: number | string;
  issuer: string;
  otpauth_uri: string;
  secret: string;
}

export interface TotpConfirmRequest {
  totp_code: string;
}

export interface TotpDisableRequest {
  password?: string;
  totp_code: string;
}

export interface StepUpRequest {
  action: string;
  totp_code: string;
}

export interface StepUpGrantView {
  action: string;
  expires_at: number | string;
  grant_token: string;
}

export type AuthUser = AdminCurrentUser;

/** 登录页可展示的钉钉应用信息，不包含凭据。 */
export interface DingTalkLoginApp {
  app_key: string;
  app_name: string;
  is_default: boolean;
}

export interface DingTalkExchangeRequest {
  exchange_code: string;
}

/** 前端会话模型，供 Vben store 使用。 */
export interface AuthSession {
  accessToken: string;
  raw: AuthBody;
}

export function isAuthBody(body: LoginResponse): body is AuthBody {
  return Object.hasOwn(body, 'access_token');
}

export function isMfaLoginChallenge(
  body: LoginResponse,
): body is MfaLoginChallenge {
  return (
    'mfa_required' in body &&
    body.mfa_required === true &&
    Object.hasOwn(body, 'challenge_id')
  );
}

export function toAuthSession(body: AuthBody): AuthSession {
  return {
    accessToken: body.access_token,
    raw: body,
  };
}

export const AuthApi = {
  accessToken: (data: LoginParams) =>
    encryptedRequestClient.post<LoginResponse>('/auth/user/access_token', data),
  refreshToken: () =>
    encryptedRequestClient.post<AuthBody>('/auth/user/refresh_token'),
  logout: () => encryptedRequestClient.post<null>('/auth/user/logout'),
  currentUser: async () =>
    normalizeAdminCurrentUser(
      await requestClient.get<AdminCurrentUserResponse>('/auth/user/user_info'),
    ),
  updateBusinessContact: async (data: BusinessContact) =>
    normalizeAdminCurrentUser(
      await requestClient.put<AdminCurrentUserResponse>(
        '/auth/user/user_info/business-contact',
        data,
      ),
    ),
  userInfo: async () => toVbenUserInfo(await AuthApi.currentUser()),
  accessCodes: () => requestClient.get<string[]>('/auth/per/codes'),
};

export const MfaApi = {
  status: () => requestClient.get<MfaStatusView>('/auth/user/mfa'),
  login: (data: MfaLoginRequest) =>
    encryptedRequestClient.post<LoginResponse>('/auth/user/mfa/login', data),
  setup: () => requestClient.post<TotpSetupView>('/auth/user/mfa/totp/setup'),
  confirm: (data: TotpConfirmRequest) =>
    requestClient.post<MfaStatusView>('/auth/user/mfa/totp/confirm', data),
  disable: (data: TotpDisableRequest) =>
    requestClient.post<MfaStatusView>('/auth/user/mfa/totp/disable', data),
  stepUp: (data: StepUpRequest) =>
    requestClient.post<StepUpGrantView>('/auth/user/mfa/step-up', data),
};

function browserApiUrl(path: string, params?: Record<string, string>) {
  const normalizedBase = apiURL.replace(/\/$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(
    `${normalizedBase}${normalizedPath}`,
    window.location.origin,
  );
  for (const [key, value] of Object.entries(params ?? {})) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

export const DingTalkApi = {
  apps: () => encryptedRequestClient.get<DingTalkLoginApp[]>('/auth/dt/apps'),
  loginUrl: (app_key: string | undefined, redirect_url: string) =>
    browserApiUrl(`/auth/dt/login${app_key ? `/${app_key}` : ''}`, {
      redirect_url,
    }),
  exchange: (data: DingTalkExchangeRequest) =>
    encryptedRequestClient.post<LoginResponse>('/auth/dt/exchange', data),
};
