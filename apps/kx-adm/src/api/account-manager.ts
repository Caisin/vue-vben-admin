import type { Page, PageQuery } from '#/api/request';

import { requestClient } from '#/api/request';

export type FieldKind =
  | 'boolean'
  | 'date'
  | 'email'
  | 'number'
  | 'password'
  | 'select'
  | 'text'
  | 'textarea'
  | 'url';
export type FieldValue = boolean | null | number | string;
export interface AccountField {
  key: string;
  label: string;
  kind: FieldKind;
  required: boolean;
  sensitive: boolean;
  enabled: boolean;
  options: string[];
}
export interface AccountType {
  id: number;
  code: string;
  name: string;
  enabled: boolean;
  fields: AccountField[];
  version: number;
  created_at: number;
  updated_at: number;
}
export interface AccountTypeWrite {
  code: string;
  name: string;
  enabled: boolean;
  fields: AccountField[];
  expected_version?: number;
}
export interface ManagedAccount {
  id: number;
  type_id: number;
  name: string;
  owner_uid: number;
  version: number;
  created_at: number;
  updated_at: number;
}
export interface AccountDetail extends ManagedAccount {
  values: Record<string, FieldValue>;
  configured_secrets: string[];
  account_type: AccountType;
}
export interface AccountWrite {
  type_id: number;
  type_version: number;
  name: string;
  values: Record<string, FieldValue>;
  expected_version?: number;
}
const root = '/account-manager';
export const AccountManagerApi = {
  types: () => requestClient.get<AccountType[]>(`${root}/types`),
  type: (id: number) => requestClient.get<AccountType>(`${root}/types/${id}`),
  createType: (data: AccountTypeWrite) =>
    requestClient.post<AccountType>(`${root}/types`, data),
  updateType: (id: number, data: AccountTypeWrite) =>
    requestClient.put<AccountType>(`${root}/types/${id}`, data),
  list: (params: PageQuery & { type_id?: number; keyword?: string }) =>
    requestClient.get<Page<ManagedAccount>>(`${root}/accounts`, { params }),
  detail: (id: number) =>
    requestClient.get<AccountDetail>(`${root}/accounts/${id}`),
  create: (data: AccountWrite) =>
    requestClient.post<AccountDetail>(`${root}/accounts`, data),
  update: (id: number, data: AccountWrite) =>
    requestClient.put<AccountDetail>(`${root}/accounts/${id}`, data),
  remove: (id: number, version: number) =>
    requestClient.delete<boolean>(`${root}/accounts/${id}`, {
      data: { expected_version: version },
    }),
  reveal: (id: number, field: string, token: string) =>
    requestClient.post<{ value: FieldValue }>(
      `${root}/accounts/${id}/secrets/${encodeURIComponent(field)}/reveal`,
      undefined,
      { headers: { 'X-Kx-Step-Up-Token': token } },
    ),
};
