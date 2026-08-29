import type {
  ListParams,
  PageResult,
  PhoneAccount,
  PhoneAccountFilterOptions,
  PhoneAccountStatus,
  PhoneAccountType,
} from './types';

import { requestClient } from '#/api/request';

export interface PhoneAccountInput {
  account_name: string;
  account_type: PhoneAccountType;
  login_url: string;
  note: string;
  password?: string;
  phone_number: string;
  platform: string;
  purpose: string;
  status: PhoneAccountStatus;
}

export interface UpdatePhoneAccountInput extends PhoneAccountInput {
  clear_password: boolean;
}

export const PhoneAccountApi = {
  list: (params: ListParams = {}) =>
    requestClient.get<PageResult<PhoneAccount>>('/msg/phone-accounts', {
      params,
    }),
  filterOptions: () =>
    requestClient.get<PhoneAccountFilterOptions>(
      '/msg/phone-accounts/filter-options',
    ),
  create: (data: PhoneAccountInput) =>
    requestClient.post<PhoneAccount>('/msg/phone-accounts', data),
  update: (accountKey: string, data: UpdatePhoneAccountInput) =>
    requestClient.put<PhoneAccount>(`/msg/phone-accounts/${accountKey}`, data),
  remove: (accountKey: string) =>
    requestClient.delete<boolean>(`/msg/phone-accounts/${accountKey}`),
};
