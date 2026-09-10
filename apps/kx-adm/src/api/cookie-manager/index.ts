import type { Page, PageQuery } from '#/api/request';

import { requestClient } from '#/api/request';
export type Id = number | string;
export interface CookieMeta {
  name: string;
  domain?: null | string;
  path: string;
  secure: boolean;
  http_only: boolean;
  same_site: string;
  expires_at?: Id | null;
}
export interface Site {
  id: Id;
  name: string;
  origin: string;
  account_label: string;
  credential_code?: null | string;
  cookies: CookieMeta[];
  allowed_uids: Id[];
  enabled: boolean;
  warning_hours: number;
  version: Id;
  refreshed_at: Id;
  status: string;
  expires_at?: Id | null;
}
export interface SiteWrite {
  name: string;
  origin: string;
  account_label: string;
  credential_code?: null | string;
  cookie_text?: string;
  format: 'cookie_header' | 'set_cookie';
  allowed_uids?: Id[];
  enabled: boolean;
  warning_hours: number;
  expected_version?: Id;
}
export interface Session {
  id: Id;
  uid: Id;
  expires_at: Id;
  revoked: boolean;
  created_at: Id;
}
export interface Login {
  id: Id;
  site_id: Id;
  state: string;
  task_run_id?: Id | null;
  captcha_data_url?: null | string;
  error_message: string;
  expires_at: Id;
}
export interface Audit {
  id: Id;
  uid: Id;
  site_id: Id;
  session_id?: Id | null;
  action: string;
  version: Id;
  cookie_count: number;
  created_at: Id;
}
const base = '/cookie-manager';
export interface AssignedUser {
  uid: Id;
  name: string;
  enabled: boolean;
  exists: boolean;
}
export interface Assignments extends Page<AssignedUser> {
  version: Id;
}
export const CookieApi = {
  mySites: () => requestClient.get<Site[]>(`${base}/my-sites`),
  assignments: (id: Id, params: PageQuery & { keyword?: string }) =>
    requestClient.get<Assignments>(`${base}/sites/${id}/assignments`, {
      params,
    }),
  assign: (
    id: Id,
    data: { expected_version: Id; add_uids?: Id[]; remove_uids?: Id[] },
  ) => requestClient.put<Id>(`${base}/sites/${id}/assignments`, data),
  quickDataeye: (data: {
    username: string;
    password: string;
    allowed_uids?: Id[];
  }) => requestClient.post<Site>(`${base}/sites/quick-dataeye`, data),
  sites: (params: PageQuery & { keyword?: string; status?: string }) =>
    requestClient.get<Page<Site>>(`${base}/sites`, { params }),
  save: (data: SiteWrite, id?: Id) =>
    id
      ? requestClient.put<Site>(`${base}/sites/${id}`, data)
      : requestClient.post<Site>(`${base}/sites`, data),
  preview: (origin: string, cookie_text: string, format: string) =>
    requestClient.post<CookieMeta[]>(`${base}/preview`, {
      origin,
      cookie_text,
      format,
    }),
  authorize: (challenge: string) =>
    requestClient.post<Session>(`${base}/sessions/authorize`, { challenge }),
  sessions: () => requestClient.get<Session[]>(`${base}/sessions`),
  revoke: (id: Id) => requestClient.delete<boolean>(`${base}/sessions/${id}`),
  audits: (params: PageQuery) =>
    requestClient.get<Page<Audit>>(`${base}/audits`, { params }),
  login: (id: Id) => requestClient.post<Login>(`${base}/sites/${id}/login`),
  loginStatus: (id: Id) => requestClient.get<Login>(`${base}/logins/${id}`),
  submitCaptcha: (id: Id, code: string) =>
    requestClient.post<Login>(`${base}/logins/${id}/submit`, { code }),
};
export const cookieStatus: Record<string, { label: string; color: string }> = {
  active: { label: '有效期内', color: 'success' },
  expiring: { label: '即将过期', color: 'warning' },
  expired: { label: '已过期', color: 'error' },
  unknown: { label: '含会话Cookie', color: 'orange' },
  disabled: { label: '停用', color: 'default' },
  missing: { label: '等待获取Cookie', color: 'warning' },
};
