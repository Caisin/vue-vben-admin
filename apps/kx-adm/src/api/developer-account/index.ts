import type { Page, PageQuery } from '#/api/request';
import type { FileUploadView } from '#/api/storage';
import type { TaskRun } from '#/api/task';

import { plaintextRequestClient, requestClient } from '#/api/request';

export type DeveloperPlatform = 'apple' | 'google';

export interface DeveloperDevice {
  id?: number;
  device_no?: string;
  model: string;
  name: string;
  remark?: string;
  serial_number: string;
  user: string;
  screenshot_file_id?: null | number;
}

export interface DeveloperAccountListItem {
  account: string;
  access_group_count: number;
  access_user_count: number;
  app_count: number;
  certifier_id?: null | number;
  certifier_name: string;
  certifier_phone: string;
  device_count: number;
  id: number | string;
  platform: DeveloperPlatform;
  registered_at: number;
  renewal_due_at: number;
  subject_id?: null | number;
  status: string;
  subject_name_cn: string;
  subject_name_en: string;
  updated_at: number | string;
  version: number | string;
}

export interface DeveloperAccountDetail {
  account: string;
  apps: string[];
  certifier_id?: null | number;
  created_at: number | string;
  created_by: number | string;
  credential_code: string;
  devices: DeveloperDevice[];
  id: number | string;
  payment_account: string;
  platform: DeveloperPlatform;
  registered_at: number;
  renewal_due_at: number;
  small_business_status: string;
  small_business_applied_at: string;
  subject_id?: null | number;
  remark: string;
  screen_share_account: string;
  screen_share_ip: string;
  status: string;
  updated_at: number | string;
  version: number | string;
}

export interface DeveloperAccountWrite extends Omit<
  DeveloperAccountDetail,
  'created_at' | 'created_by' | 'id' | 'updated_at' | 'version'
> {
  expected_version?: number | string;
}

export interface DeveloperSubject {
  id: number;
  subject_name_cn: string;
  subject_name_en: string;
  country_or_region: string;
  company_address: string;
  unified_social_credit_code: string;
  registration_number: string;
  duns: string;
  website: string;
  certifier_name: string;
  certifier_id_no: string;
  certifier_address: string;
  certifier_phone: string;
  enterprise_email: string;
  business_license_file_id?: null | number;
  duns_file_id?: null | number;
  tiktok_us_registered: boolean;
  remark: string;
  created_at: number;
  updated_at: number;
}

export type DeveloperSubjectWrite = Omit<
  DeveloperSubject,
  'created_at' | 'id' | 'updated_at'
> & {
  expected_version?: number;
};

export interface DeveloperCertifier {
  id: number;
  name: string;
  id_no: string;
  address: string;
  phone: string;
  enterprise_email: string;
  document_file_id?: null | number;
  remark: string;
  created_at: number;
  updated_at: number;
}

export interface DeveloperCertifierWrite {
  name: string;
  id_no: string;
  address: string;
  phone: string;
  enterprise_email: string;
  document_file_id?: null | number;
  remark: string;
  expected_updated_at?: number;
}

export interface AppleDevice extends DeveloperDevice {
  id: number;
  developer_account_id: number;
  remark: string;
  created_at: number;
  updated_at: number;
}

export interface TikTokUser {
  avatar_url: string;
  follower_count: number;
  following_count: number;
  heart_count: number;
  id: string;
  nickname: string;
  sec_uid: string;
  signature: string;
  unique_id: string;
  verified: boolean;
  video_count: number;
}

export interface TikTokAccountListItem extends Omit<TikTokUser, 'id'> {
  country: string;
  developer_account_id?: null | number;
  id: string;
  registered_account: string;
  registered_via?: DeveloperPlatform | null;
  updated_at: number;
  username: string;
}

export interface TikTokAccountImportRequest {
  country: string;
  items: Array<{ country: string; username: string }>;
}

export interface DeveloperAccountOption {
  account: string;
  id: number;
  platform: DeveloperPlatform;
  subject_name_cn: string;
  tiktok_account_id?: null | string;
}

export interface DeveloperAccountAccessGroup {
  account_count: number;
  created_at: number;
  enabled: boolean;
  grp_code: string;
  grp_name: string;
  id: number;
  order_no: number;
  remark: string;
  updated_at: number;
  user_count: number;
}

export interface DeveloperAccountAccessGroupWrite {
  enabled: boolean;
  grp_code: string;
  grp_name: string;
  order_no: number;
  remark: string;
}

export interface DeveloperAccountAccessGroupAccounts {
  developer_account_ids: number[];
  grp_id: number;
}

export interface DeveloperAccountAccessUsers {
  developer_account_id?: number;
  grp_id?: number;
  uids: number[];
}

export interface TikTokMiniApp {
  app_id?: null | string;
  client_key: string;
  credential_code?: null | string;
  created_at: number | string;
  name: string;
  remark: string;
  updated_at: number | string;
  whitelist_count: number;
}

export interface TikTokMiniAppWrite {
  client_key: string;
  name: string;
  remark: string;
}

export interface TikTokMiniAppWhitelist {
  client_key: string;
  country: string;
  customer_group: string;
  mini_app_client_key: string;
  mini_app_name: string;
  row_key: string;
  submitted?: boolean | null;
  status: string;
  tiktok_account_id: number | string;
  updated_at: number | string;
  user_id: string;
  username: string;
}

export const DeveloperAccountApi = {
  accessGroups: (
    params?: PageQuery & { enabled?: boolean; keyword?: string },
  ) =>
    requestClient.get<Page<DeveloperAccountAccessGroup>>(
      '/developer-account/access-groups',
      { params },
    ),
  accessGroup: (id: number | string) =>
    requestClient.get<DeveloperAccountAccessGroup>(
      `/developer-account/access-groups/${id}`,
    ),
  createAccessGroup: (data: DeveloperAccountAccessGroupWrite) =>
    requestClient.post<DeveloperAccountAccessGroup>(
      '/developer-account/access-groups',
      data,
    ),
  updateAccessGroup: (
    id: number | string,
    data: DeveloperAccountAccessGroupWrite,
  ) =>
    requestClient.put<DeveloperAccountAccessGroup>(
      `/developer-account/access-groups/${id}`,
      data,
    ),
  removeAccessGroup: (id: number | string) =>
    requestClient.delete<boolean>(`/developer-account/access-groups/${id}`),
  accessGroupAccounts: (id: number | string) =>
    requestClient.get<DeveloperAccountAccessGroupAccounts>(
      `/developer-account/access-groups/${id}/accounts`,
    ),
  replaceAccessGroupAccounts: (
    id: number | string,
    developer_account_ids: number[],
  ) =>
    requestClient.put<DeveloperAccountAccessGroupAccounts>(
      `/developer-account/access-groups/${id}/accounts`,
      { developer_account_ids },
    ),
  accessGroupUsers: (id: number | string) =>
    requestClient.get<DeveloperAccountAccessUsers>(
      `/developer-account/access-groups/${id}/users`,
    ),
  replaceAccessGroupUsers: (id: number | string, uids: number[]) =>
    requestClient.put<DeveloperAccountAccessUsers>(
      `/developer-account/access-groups/${id}/users`,
      { uids },
    ),
  accountAccessUsers: (id: number | string) =>
    requestClient.get<DeveloperAccountAccessUsers>(
      `/developer-account/accounts/${id}/access`,
    ),
  replaceAccountAccessUsers: (id: number | string, uids: number[]) =>
    requestClient.put<DeveloperAccountAccessUsers>(
      `/developer-account/accounts/${id}/access`,
      { uids },
    ),
  certifiers: (params?: { keyword?: string }) =>
    requestClient.get<DeveloperCertifier[]>('/developer-account/certifiers', {
      params,
    }),
  certifier: (id: number | string) =>
    requestClient.get<DeveloperCertifier>(
      `/developer-account/certifiers/${id}`,
    ),
  createCertifier: (data: DeveloperCertifierWrite) =>
    requestClient.post<DeveloperCertifier>(
      '/developer-account/certifiers',
      data,
    ),
  updateCertifier: (id: number | string, data: DeveloperCertifierWrite) =>
    requestClient.put<DeveloperCertifier>(
      `/developer-account/certifiers/${id}`,
      data,
    ),
  removeCertifier: (id: number | string) =>
    requestClient.delete<boolean>(`/developer-account/certifiers/${id}`),
  subjects: (params?: {
    certifier_name?: string;
    country_or_region?: string;
    duns?: string;
    keyword?: string;
    subject_id?: number;
  }) =>
    requestClient.get<DeveloperSubject[]>('/developer-account/subjects', {
      params,
    }),
  subject: (id: number | string) =>
    requestClient.get<DeveloperSubject>(`/developer-account/subjects/${id}`),
  createSubject: (data: DeveloperSubjectWrite) =>
    requestClient.post<DeveloperSubject>('/developer-account/subjects', data),
  updateSubject: (id: number | string, data: DeveloperSubjectWrite) =>
    requestClient.put<DeveloperSubject>(
      `/developer-account/subjects/${id}`,
      data,
    ),
  removeSubject: (id: number | string) =>
    requestClient.delete<boolean>(`/developer-account/subjects/${id}`),
  uploadSubjectDocument: (file: File) =>
    plaintextRequestClient.upload<FileUploadView[]>(
      '/storage/file/upload/local_private',
      { file },
    ),
  downloadSubjectDocument: (id: number | string) =>
    plaintextRequestClient.download<Blob>(`/storage/file/content/${id}`),
  appleDevices: (params?: {
    developer_account_id?: number;
    keyword?: string;
  }) =>
    requestClient.get<AppleDevice[]>('/developer-account/apple-devices', {
      params,
    }),
  createAppleDevice: (data: {
    developer_account_id: number;
    device_no: string;
    model?: string;
    name?: string;
    remark?: string;
    screenshot_file_id?: number;
    serial_number?: string;
    user?: string;
  }) =>
    requestClient.post<AppleDevice>('/developer-account/apple-devices', data),
  updateAppleDevice: (
    id: number | string,
    data: {
      developer_account_id: number;
      device_no: string;
      model?: string;
      name?: string;
      remark?: string;
      screenshot_file_id?: number;
      serial_number?: string;
      user?: string;
    },
  ) =>
    requestClient.put<AppleDevice>(
      `/developer-account/apple-devices/${id}`,
      data,
    ),
  removeAppleDevice: (id: number | string) =>
    requestClient.delete<boolean>(`/developer-account/apple-devices/${id}`),
  create: (data: DeveloperAccountWrite) =>
    requestClient.post<DeveloperAccountDetail>(
      '/developer-account/accounts',
      data,
    ),
  detail: (id: number | string) =>
    requestClient.get<DeveloperAccountDetail>(
      `/developer-account/accounts/${id}`,
    ),
  list: (
    params?: PageQuery & {
      keyword?: string;
      platform?: DeveloperPlatform;
      status?: string;
    },
  ) =>
    requestClient.get<Page<DeveloperAccountListItem>>(
      '/developer-account/accounts',
      { params },
    ),
  remove: (id: number | string) =>
    requestClient.delete<boolean>(`/developer-account/accounts/${id}`),
  reindexSearch: () =>
    requestClient.post<{ indexed: number }>(
      '/developer-account/accounts/search/reindex',
    ),
  tiktokUser: (username: string) =>
    requestClient.get<TikTokUser>('/developer-account/tiktok/user', {
      params: { username },
    }),
  tiktokAccountOptions: () =>
    requestClient.get<DeveloperAccountOption[]>(
      '/developer-account/tiktok/accounts/options',
    ),
  tiktokAccounts: (
    params?: PageQuery & { keyword?: string; linked?: boolean },
  ) =>
    requestClient.get<Page<TikTokAccountListItem>>(
      '/developer-account/tiktok/accounts',
      { params },
    ),
  createTiktokAccount: (data: {
    country: string;
    developer_account_id?: number;
    username: string;
  }) =>
    requestClient.post<TikTokAccountListItem>(
      '/developer-account/tiktok/accounts',
      data,
    ),
  importTiktokAccounts: (data: TikTokAccountImportRequest) =>
    requestClient.post<TaskRun>(
      '/developer-account/tiktok/accounts/imports',
      data,
    ),
  updateTiktokAccountLink: (
    id: string,
    data: { country?: string; developer_account_id?: number },
  ) =>
    requestClient.put<TikTokAccountListItem>(
      `/developer-account/tiktok/accounts/${id}/link`,
      data,
    ),
  deleteTiktokAccount: (id: string) =>
    requestClient.delete<boolean>(`/developer-account/tiktok/accounts/${id}`),
  tiktokMiniApps: (params?: PageQuery & { keyword?: string }) =>
    requestClient.get<Page<TikTokMiniApp>>(
      '/developer-account/tiktok/mini-apps',
      { params },
    ),
  createTiktokMiniApp: (data: TikTokMiniAppWrite) =>
    requestClient.post<TikTokMiniApp>(
      '/developer-account/tiktok/mini-apps',
      data,
    ),
  updateTiktokMiniApp: (clientKey: string, data: TikTokMiniAppWrite) =>
    requestClient.put<TikTokMiniApp>(
      `/developer-account/tiktok/mini-apps/${encodeURIComponent(clientKey)}`,
      { name: data.name, remark: data.remark },
    ),
  deleteTiktokMiniApp: (clientKey: string) =>
    requestClient.delete<boolean>(
      `/developer-account/tiktok/mini-apps/${encodeURIComponent(clientKey)}`,
    ),
  syncTiktokMiniApps: (credentialCode: string) =>
    requestClient.post<TaskRun>('/developer-account/tiktok/mini-apps/sync', {
      credential_code: credentialCode,
    }),
  tiktokMiniAppSyncTask: (runId: number | string) =>
    requestClient.get<TaskRun>(
      `/developer-account/tiktok/mini-apps/sync/${runId}`,
    ),
  tiktokMiniAppWhitelists: (
    params?: PageQuery & {
      keyword?: string;
      mini_app_client_key?: string;
      status?: string;
      tiktok_account_id?: number | string;
    },
  ) =>
    requestClient.get<Page<TikTokMiniAppWhitelist>>(
      '/developer-account/tiktok/mini-app-whitelists',
      { params },
    ),
  update: (id: number | string, data: DeveloperAccountWrite) =>
    requestClient.put<DeveloperAccountDetail>(
      `/developer-account/accounts/${id}`,
      data,
    ),
};
