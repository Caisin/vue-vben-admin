import type { Page, PageQuery } from '#/api/request';

import { requestClient } from '#/api/request';

export interface StorageCredentialSpec {
  kind: string;
  profile: string;
}

export interface StorageTypeSpec {
  access_key_label: string;
  code: string;
  credential_specs: StorageCredentialSpec[];
  description: string;
  endpoint_hint: string;
  label: string;
  requires_credentials: boolean;
  requires_endpoint: boolean;
  requires_region: boolean;
  requires_root: boolean;
  requires_s3: boolean;
  secret_key_label: string;
  supports_virtual_host: boolean;
}

export interface StorageConfigView {
  bucket: string;
  cdn_domain: string;
  code: string;
  create_time: number | string;
  credential_code?: null | string;
  enable_virtual_host: boolean;
  endpoint: string;
  is_public: boolean;
  order_no: number | string;
  region: string;
  root: string;
  storage_name: string;
  storage_type: string;
  upload_dir: string;
}

export interface StorageConfigWrite {
  bucket?: string;
  cdn_domain?: string;
  credential_code?: null | string;
  enable_virtual_host?: boolean;
  endpoint?: string;
  is_public?: boolean;
  order_no?: number | string;
  region?: string;
  root?: string;
  storage_name: string;
  storage_type: string;
  upload_dir?: string;
}

export interface StorageConfigCopyWrite {
  bucket?: string;
  cdn_domain?: string;
  code: string;
  credential_code?: null | string;
  enable_virtual_host?: boolean;
  endpoint?: string;
  is_public?: boolean;
  order_no?: number | string;
  region?: string;
  root?: string;
  storage_name: string;
  upload_dir?: string;
}

export interface StorageOptionView {
  code: string;
  storage_name: string;
  storage_type: string;
}

export interface BusinessStorageDefaults {
  article_private?: null | StorageOptionView;
  article_public?: null | StorageOptionView;
  developer_account_private: StorageOptionView;
  file_share_upload: StorageOptionView;
  import_export_private: StorageOptionView;
  invoice_private?: null | StorageOptionView;
  mall_private?: null | StorageOptionView;
  mall_public?: null | StorageOptionView;
  wmxt_private?: null | StorageOptionView;
  wmxt_public?: null | StorageOptionView;
}

export interface BusinessStorageDefaultsWrite {
  article_private?: string;
  article_public?: string;
  developer_account_private: string;
  file_share_upload: string;
  import_export_private: string;
  invoice_private: string;
  mall_private?: string;
  mall_public?: string;
  wmxt_private?: string;
  wmxt_public?: string;
}

export interface StorageConfigPageQuery extends PageQuery {
  code_prefix?: string;
  is_public?: boolean;
  name_prefix?: string;
  storage_type?: string;
}

export const StorageConfigApi = {
  list: (params?: StorageConfigPageQuery) =>
    requestClient.get<Page<StorageConfigView>>('/storage/cfg', { params }),
  types: () => requestClient.get<StorageTypeSpec[]>('/storage/cfg/types'),
  fileShareDefault: () =>
    requestClient.get<StorageOptionView>('/storage/cfg/file-share-default'),
  setFileShareDefault: (storage_code: string) =>
    requestClient.put<StorageOptionView>('/storage/cfg/file-share-default', {
      storage_code,
    }),
  businessDefaults: () =>
    requestClient.get<BusinessStorageDefaults>(
      '/storage/cfg/business-defaults',
    ),
  setBusinessDefaults: (data: BusinessStorageDefaultsWrite) =>
    requestClient.put<BusinessStorageDefaults>(
      '/storage/cfg/business-defaults',
      data,
    ),
  detail: (code: string) =>
    requestClient.get<StorageConfigView>(`/storage/cfg/${code}`),
  save: (code: string, data: StorageConfigWrite) =>
    requestClient.post<StorageConfigView>(`/storage/cfg/${code}`, data),
  copy: (code: string, data: StorageConfigCopyWrite) =>
    requestClient.post<StorageConfigView>(`/storage/cfg/${code}/copies`, data),
  remove: (code: string) =>
    requestClient.delete<boolean>(`/storage/cfg/${code}`),
};
