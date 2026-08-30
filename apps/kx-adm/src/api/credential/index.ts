import type { Page, PageQuery } from '#/api/request';

import { requestClient } from '#/api/request';

export type CredentialKind =
  | 'access_key'
  | 'dingtalk'
  | 'douyin'
  | 'google_service_account'
  | 'http_header'
  | 'http_token'
  | 'json_secret'
  | 'kuaishou'
  | 'password'
  | 'ssh_key'
  | 'tiktok'
  | 'tt_web'
  | 'username_password'
  | 'wechat'
  | 'wechat_merchant';
export type CredentialState = 'active' | 'disabled' | 'retired';
export type CredentialFieldType = 'password' | 'select' | 'text' | 'textarea';

export interface CredentialFieldSpec {
  field_type: CredentialFieldType;
  label: string;
  max_length: number;
  name: string;
  required: boolean;
}

export interface CredentialProfileSpec {
  allowed_headers: string[];
  fields: CredentialFieldSpec[];
  kind: CredentialKind;
  label: string;
  profile: string;
}

export interface CredentialTypesView {
  profiles: CredentialProfileSpec[];
}

export interface CredentialFieldSummary {
  configured: boolean;
  field: string;
  masked_hint: string;
}

export interface CredentialSummary {
  fields: CredentialFieldSummary[];
}

export type CredentialPayload =
  | {
      access_key_id: string;
      kind: 'access_key';
      secret_access_key: string;
      session_token?: string;
    }
  | {
      base_url: string;
      header_name: string;
      kind: 'http_header';
      value: string;
    }
  | {
      base_url: string;
      header_name: string;
      kind: 'http_token';
      scheme: string;
      token: string;
    }
  | {
      base_url: string;
      kind: 'username_password';
      password: string;
      username: string;
    }
  | {
      cookie?: string;
      curl: string;
      kind: 'tt_web';
      user_agent?: string;
    }
  | { json: string; kind: 'json_secret' }
  | {
      kind: 'google_service_account';
      service_account_json: string;
    }
  | { kind: 'password'; password: string }
  | {
      kind: 'ssh_key';
      passphrase?: string;
      private_key: string;
      public_key?: string;
      username: string;
    };

export type CredentialPayloadFormValues = Record<string, unknown>;

function textValue(values: CredentialPayloadFormValues, field: string) {
  return String(values[`payload_${field}`] ?? '');
}

export function buildCredentialPayload(
  kind: CredentialKind,
  values: CredentialPayloadFormValues,
  profile = '',
): CredentialPayload {
  if (
    kind === 'access_key' ||
    (['dingtalk', 'douyin', 'kuaishou', 'wechat'].includes(kind) &&
      profile === 'app') ||
    (kind === 'tiktok' && profile === 'mini_app')
  ) {
    return {
      access_key_id: textValue(values, 'access_key_id'),
      kind: 'access_key',
      secret_access_key: textValue(values, 'secret_access_key'),
      session_token: textValue(values, 'session_token'),
    };
  }
  if (kind === 'username_password') {
    return {
      base_url: textValue(values, 'base_url'),
      kind,
      password: textValue(values, 'password'),
      username: textValue(values, 'username'),
    };
  }
  if (kind === 'password') {
    return { kind, password: textValue(values, 'password') };
  }
  if (['dingtalk', 'douyin', 'wechat', 'wechat_merchant'].includes(kind)) {
    return { kind: 'password', password: textValue(values, 'password') };
  }
  if (kind === 'http_token') {
    return {
      base_url: textValue(values, 'base_url'),
      header_name: textValue(values, 'header_name'),
      kind,
      scheme: textValue(values, 'scheme'),
      token: textValue(values, 'token'),
    };
  }
  if (kind === 'http_header') {
    return {
      base_url: textValue(values, 'base_url'),
      header_name: textValue(values, 'header_name'),
      kind,
      value: textValue(values, 'value'),
    };
  }
  if (kind === 'tt_web') {
    return { curl: textValue(values, 'curl'), kind };
  }
  if (kind === 'google_service_account') {
    return {
      kind,
      service_account_json: textValue(values, 'service_account_json'),
    };
  }
  if (kind === 'json_secret') {
    return { json: textValue(values, 'json'), kind };
  }
  if (kind === 'ssh_key') {
    return {
      kind,
      passphrase: textValue(values, 'passphrase'),
      private_key: textValue(values, 'private_key'),
      public_key: textValue(values, 'public_key'),
      username: textValue(values, 'username'),
    };
  }
  throw new Error(`不支持的凭证类型与用途组合: ${kind}/${profile}`);
}

export interface CredentialView {
  binding_count: number;
  failed_binding_count: number;
  code: string;
  created_at: number | string;
  created_by: number | string;
  expires_at: number | string;
  kind: CredentialKind;
  last_error: string;
  last_used_at: number | string;
  name: string;
  not_before: number | string;
  profile: string;
  remark: string;
  retired_at: number | string;
  state: CredentialState;
  summary: CredentialSummary;
  updated_at: number | string;
}

export interface CredentialQuery extends PageQuery {
  code_prefix?: string;
  created_by?: number | string;
  expiring_within_days?: number;
  has_recent_failure?: boolean;
  kind?: CredentialKind;
  name_prefix?: string;
  profile?: string;
  state?: CredentialState;
}

export interface CredentialCreateWrite {
  code?: string;
  expires_at?: number | string;
  kind: CredentialKind;
  name: string;
  not_before?: number | string;
  payload: CredentialPayload;
  profile: string;
  remark?: string;
}

export interface CredentialUpdateWrite {
  name: string;
  remark?: string;
}

export interface CredentialReplaceWrite {
  expires_at?: number | string;
  kind: CredentialKind;
  not_before?: number | string;
  payload: CredentialPayload;
  profile: string;
}

export interface CredentialRetireWrite {
  confirmed: boolean;
}

export interface CredentialRevealField {
  field: string;
  label: string;
  multiline: boolean;
  secret: boolean;
  value: string;
}

export interface CredentialRevealView {
  fields: CredentialRevealField[];
}

export interface CredentialBindingView {
  consumer: string;
  created_at: number | string;
  expected_kind: CredentialKind;
  expected_profile: string;
  id: number | string;
  last_error: string;
  last_used_at: number | string;
  owner_key: string;
  owner_type: string;
  slot: string;
  updated_at: number | string;
}

function stepUpHeaders(stepUpToken: string) {
  return { headers: { 'X-Kx-Step-Up-Token': stepUpToken } };
}

export const CredentialApi = {
  bindings: (code: string) =>
    requestClient.get<CredentialBindingView[]>(
      `/credential/items/${code}/bindings`,
    ),
  create: (data: CredentialCreateWrite) =>
    requestClient.post<CredentialView>('/credential/items', data),
  detail: (code: string) =>
    requestClient.get<CredentialView>(`/credential/items/${code}`),
  disable: (code: string, stepUpToken: string) =>
    requestClient.post<CredentialView>(
      `/credential/items/${code}/actions/disable`,
      undefined,
      stepUpHeaders(stepUpToken),
    ),
  enable: (code: string, stepUpToken: string) =>
    requestClient.post<CredentialView>(
      `/credential/items/${code}/actions/enable`,
      undefined,
      stepUpHeaders(stepUpToken),
    ),
  list: (params?: CredentialQuery) =>
    requestClient.get<Page<CredentialView>>('/credential/items', { params }),
  all: (params?: CredentialQuery) =>
    requestClient.get<CredentialView[]>('/credential/items/all', { params }),
  retire: (code: string, data: CredentialRetireWrite, stepUpToken: string) =>
    requestClient.post<CredentialView>(
      `/credential/items/${code}/actions/retire`,
      data,
      stepUpHeaders(stepUpToken),
    ),
  reveal: (code: string, stepUpToken: string) =>
    requestClient.post<CredentialRevealView>(
      `/credential/items/${code}/reveal`,
      undefined,
      stepUpHeaders(stepUpToken),
    ),
  replace: (code: string, data: CredentialReplaceWrite, stepUpToken: string) =>
    requestClient.put<CredentialView>(
      `/credential/items/${code}/payload`,
      data,
      stepUpHeaders(stepUpToken),
    ),
  types: () => requestClient.get<CredentialTypesView>('/credential/types'),
  update: (code: string, data: CredentialUpdateWrite) =>
    requestClient.put<CredentialView>(`/credential/items/${code}`, data),
};
