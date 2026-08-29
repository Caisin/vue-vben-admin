import type { EnabledStatus, WmxtRecord, WmxtRole } from './admin';
import type { WmxtMiniProgramPageOption } from './home-entry';

import type { Page, PageQuery } from '#/api/request';

import { requestClient } from '#/api/request';

export interface WmxtProfileEntry extends WmxtRecord {
  code: string;
  group_name: string;
  icon_file_id: number | string;
  icon_name: string;
  icon_url: string;
  id: number | string;
  page_id: number | string;
  page_title: string;
  route: string;
  sort_order: number;
  status: EnabledStatus;
  subtitle: string;
  target: WmxtRole;
  title: string;
}

export interface WmxtProfileEntryWrite {
  code: string;
  group_name: string;
  icon_file_id: number | string;
  icon_name: string;
  page_id: number | string;
  sort_order: number;
  status: EnabledStatus;
  subtitle: string;
  target: WmxtRole;
  title: string;
}

export interface WmxtProfileEntryOrderItem {
  id: number | string;
  sort_order: number;
}

export interface WmxtProfileEntryListQuery extends PageQuery {
  code?: string;
  group_name?: string;
  is_del?: boolean;
  status?: EnabledStatus;
  target?: WmxtRole;
  title?: string;
}

const basePath = '/wmxt/admin/profile-entries';

export const WmxtProfileEntryAdminApi = {
  create_profile_entry: (data: WmxtProfileEntryWrite) =>
    requestClient.post<WmxtProfileEntry>(basePath, data),
  profile_entries: (params?: WmxtProfileEntryListQuery) =>
    requestClient.get<Page<WmxtProfileEntry>>(basePath, { params }),
  profile_entry: (id: number | string) =>
    requestClient.get<WmxtProfileEntry>(`${basePath}/${id}`),
  profile_entry_pages: (params: { target: WmxtRole }) =>
    requestClient.get<WmxtMiniProgramPageOption[]>(`${basePath}/pages`, {
      params,
    }),
  order_profile_entries: (data: {
    items: WmxtProfileEntryOrderItem[];
    target: WmxtRole;
  }) => requestClient.put<WmxtProfileEntry[]>(`${basePath}/order`, data),
  remove_profile_entry: (id: number | string) =>
    requestClient.delete<boolean>(`${basePath}/${id}`),
  update_profile_entry: (id: number | string, data: WmxtProfileEntryWrite) =>
    requestClient.put<WmxtProfileEntry>(`${basePath}/${id}`, data),
};
