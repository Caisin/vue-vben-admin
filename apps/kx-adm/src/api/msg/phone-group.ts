import type { ListParams, PageResult, PhoneGroup, SimCard } from './types';

import { requestClient } from '#/api/request';

export interface PhoneGroupWrite {
  enabled: boolean;
  grp_code: string;
  grp_name: string;
  order_no: number;
  remark: string;
}

export interface PhoneGroupOption {
  grp_code: string;
  label: string;
  value: number;
}

export interface PhoneGroupSimsView {
  iccids: string[];
  items: SimCard[];
}

export interface PhoneGroupSimsQueryAddRequest {
  query: ListParams;
}

export interface PhoneGroupSimsQueryAddResult {
  existing: number;
  grp_id: number;
  inserted: number;
  matched: number;
  total: number;
}

export interface PhoneGroupUsersView {
  uids: number[];
}

export const PhoneGroupApi = {
  list: (params: ListParams = {}) =>
    requestClient.get<PageResult<PhoneGroup>>('/msg/phone-groups', {
      params,
    }),
  options: () =>
    requestClient.get<PhoneGroupOption[]>('/msg/phone-groups/options'),
  detail: (id: number) =>
    requestClient.get<PhoneGroup>(`/msg/phone-groups/${id}`),
  create: (data: PhoneGroupWrite) =>
    requestClient.post<PhoneGroup>('/msg/phone-groups', data),
  update: (id: number, data: PhoneGroupWrite) =>
    requestClient.put<PhoneGroup>(`/msg/phone-groups/${id}`, data),
  remove: (id: number) =>
    requestClient.delete<boolean>(`/msg/phone-groups/${id}`),
  sims: (id: number) =>
    requestClient.get<PhoneGroupSimsView>(`/msg/phone-groups/${id}/sims`),
  replaceSims: (id: number, iccids: string[]) =>
    requestClient.put<PhoneGroupSimsView>(`/msg/phone-groups/${id}/sims`, {
      iccids,
    }),
  addSimsByQuery: (id: number, data: PhoneGroupSimsQueryAddRequest) =>
    requestClient.post<PhoneGroupSimsQueryAddResult>(
      `/msg/phone-groups/${id}/sims/actions/add-by-query`,
      data,
    ),
  users: (id: number) =>
    requestClient.get<PhoneGroupUsersView>(`/msg/phone-groups/${id}/users`),
  replaceUsers: (id: number, uids: number[]) =>
    requestClient.put<PhoneGroupUsersView>(`/msg/phone-groups/${id}/users`, {
      uids,
    }),
};
