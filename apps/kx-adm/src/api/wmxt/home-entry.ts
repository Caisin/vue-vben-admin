import type { EnabledStatus, WmxtRecord, WmxtRole } from './admin';

import type { Page, PageQuery } from '#/api/request';

import { requestClient } from '#/api/request';

export type WmxtMiniProgramPageScope = 'admin' | 'common' | 'org' | 'personal';

export interface WmxtMiniProgramPageOption {
  code: string;
  id: number | string;
  requires_params: boolean;
  route: string;
  scope: WmxtMiniProgramPageScope;
  selectable: boolean;
  status: EnabledStatus;
  title: string;
}

export interface WmxtHomeEntry extends WmxtRecord {
  code: string;
  icon_file_id: number | string;
  icon_name: string;
  icon_url: string;
  id: number | string;
  page_id: number | string;
  page_title: string;
  route: string;
  sort_order: number;
  status: EnabledStatus;
  target: WmxtRole;
  title: string;
}

export interface WmxtHomeEntryWrite {
  code: string;
  icon_file_id: number | string;
  icon_name: string;
  page_id: number | string;
  sort_order: number;
  status: EnabledStatus;
  target: WmxtRole;
  title: string;
}

export interface WmxtHomeEntryOrderItem {
  id: number | string;
  sort_order: number;
}

export interface WmxtHomeEntryListQuery extends PageQuery {
  code?: string;
  is_del?: boolean;
  status?: EnabledStatus;
  target?: WmxtRole;
  title?: string;
}

const basePath = '/wmxt/admin/home-entries';

export const WmxtHomeEntryAdminApi = {
  create_home_entry: (data: WmxtHomeEntryWrite) =>
    requestClient.post<WmxtHomeEntry>(basePath, data),
  home_entries: (params?: WmxtHomeEntryListQuery) =>
    requestClient.get<Page<WmxtHomeEntry>>(basePath, { params }),
  home_entry: (id: number | string) =>
    requestClient.get<WmxtHomeEntry>(`${basePath}/${id}`),
  home_entry_pages: (params: { target: WmxtRole }) =>
    requestClient.get<WmxtMiniProgramPageOption[]>(`${basePath}/pages`, {
      params,
    }),
  order_home_entries: (data: {
    items: WmxtHomeEntryOrderItem[];
    target: WmxtRole;
  }) => requestClient.put<WmxtHomeEntry[]>(`${basePath}/order`, data),
  remove_home_entry: (id: number | string) =>
    requestClient.delete<boolean>(`${basePath}/${id}`),
  update_home_entry: (id: number | string, data: WmxtHomeEntryWrite) =>
    requestClient.put<WmxtHomeEntry>(`${basePath}/${id}`, data),
};
