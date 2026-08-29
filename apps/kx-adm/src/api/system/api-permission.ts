import type { AdminPermission } from '#/api/auth/admin';
import type { Page, PageQuery } from '#/api/request';

import { requestClient } from '#/api/request';

export type ApiAccessMode = 'custom' | 'login' | 'menu' | 'public';
export type ApiClientScope = 'backend' | 'mobile' | 'public';
export type ApiOperationType =
  | 'action'
  | 'create'
  | 'delete'
  | 'detail'
  | 'list'
  | 'modify';

export interface ApiPermission {
  access_mode: ApiAccessMode;
  api_code: string;
  api_key: string;
  api_method: string;
  api_name: string;
  api_path: string;
  audit_debug?: boolean;
  audit_enabled?: boolean;
  auth_exempt: boolean;
  cfg_hash: string;
  client_scope: ApiClientScope;
  created_at: number | string;
  enabled: boolean;
  id: number | string;
  menu_perm_id: number | string;
  operation_type: ApiOperationType;
  permission_count: number;
  permission_ids: Array<number | string>;
  security_exempt: boolean;
  updated_at: number | string;
}

export interface ApiPermissionPageQuery extends PageQuery {
  access_mode?: ApiAccessMode;
  api_code_prefix?: string;
  api_key_prefix?: string;
  api_method?: string;
  api_path_prefix?: string;
  auth_exempt?: boolean;
  enabled?: boolean;
  ids?: number[];
  menu_perm_id?: number | string;
  operation_type?: ApiOperationType;
  security_exempt?: boolean;
}

export interface ApiPermissionWrite {
  access_mode: ApiAccessMode;
  api_name: string;
  audit_debug: boolean;
  audit_enabled: boolean;
  auth_exempt?: boolean;
  enabled: boolean;
  menu_perm_id: number | string;
  operation_type: ApiOperationType;
  security_exempt: boolean;
}

export interface ApiPermissionAssign {
  permission_ids: Array<number | string>;
}

export interface ApiPermissionBatchUpdate {
  access_mode?: ApiAccessMode;
  audit_debug?: boolean;
  audit_enabled?: boolean;
  ids: Array<number | string>;
  menu_perm_id?: number | string;
  operation_type?: ApiOperationType;
  security_exempt?: boolean;
}

export interface ApiPermissionCount {
  api_count: number;
  api_ids: Array<number | string>;
  perm_id: number | string;
}

export interface ApiPermissionCountSummary {
  items: ApiPermissionCount[];
  total: number;
}

export const ApiPermissionApi = {
  list: (data?: ApiPermissionPageQuery) =>
    requestClient.post<Page<ApiPermission>>('/auth/api', data ?? {}),
  detail: (id: number | string) =>
    requestClient.get<ApiPermission>(`/auth/api/${id}`),
  update: (id: number | string, data: ApiPermissionWrite) =>
    requestClient.put<ApiPermission>(`/auth/api/${id}`, data),
  assign: (id: number | string, data: ApiPermissionAssign) =>
    requestClient.put<ApiPermission>(`/auth/api/${id}/permissions`, data),
  batchUpdate: (data: ApiPermissionBatchUpdate) =>
    requestClient.put<number>('/auth/api/batch', data),
  sync: () => requestClient.post<number>('/auth/api/sync'),
  permissionCounts: () =>
    requestClient.get<ApiPermissionCountSummary>('/auth/api/permission-counts'),
  async permissionOptions() {
    const response = await requestClient.get<
      AdminPermission[] | { items?: AdminPermission[] }
    >('/auth/menu/all');
    return Array.isArray(response) ? response : (response.items ?? []);
  },
  async allGrantOptions() {
    const query = {
      auth_exempt: false,
      enabled: true,
      size: 200,
    };
    const firstPage = await requestClient.post<Page<ApiPermission>>(
      '/auth/api',
      {
        ...query,
        page: 1,
      },
    );
    const items = [...firstPage.items];
    for (let page = 2; page <= firstPage.total_pages; page += 1) {
      const result = await requestClient.post<Page<ApiPermission>>(
        '/auth/api',
        {
          ...query,
          page,
        },
      );
      items.push(...result.items);
    }
    return items;
  },
  async unboundOptions() {
    const query = {
      auth_exempt: false,
      enabled: true,
      menu_perm_id: 0,
      size: 100,
    };
    const firstPage = await requestClient.post<Page<ApiPermission>>(
      '/auth/api',
      {
        ...query,
        page: 1,
      },
    );
    const items = [...firstPage.items];
    for (let page = 2; page <= firstPage.total_pages; page += 1) {
      const result = await requestClient.post<Page<ApiPermission>>(
        '/auth/api',
        {
          ...query,
          page,
        },
      );
      items.push(...result.items);
    }
    return items;
  },
};
