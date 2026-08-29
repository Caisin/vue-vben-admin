import type { JsonValue, Page, PageQuery } from '#/api/request';
import type { ApiPermission } from '#/api/system/api-permission';

import { requestClient } from '#/api/request';

export interface AdminUser {
  avatar: string;
  created_at: number | string;
  dept_id?: number | string;
  email: string;
  enabled: boolean;
  home_perm_id?: null | number | string;
  id: number | string;
  is_guest: boolean;
  name: string;
  os: string;
  platform: string;
  reg_ip: string;
  remark?: null | string;
  tel: string;
  updated_at: number | string;
}

export interface AdminUserDetail extends AdminUser {
  api_ids: Array<number | string>;
  permission_ids?: Array<number | string>;
  role_ids: string[];
}

export interface AdminUserWrite {
  api_ids?: Array<number | string>;
  avatar?: string;
  dept_id?: number | string;
  email?: string;
  enabled?: boolean;
  home_perm_id?: null | number | string;
  is_guest?: boolean;
  name: string;
  os?: string;
  password?: string;
  permission_ids?: Array<number | string>;
  platform?: string;
  reg_ip?: string;
  remark?: null | string;
  role_ids?: string[];
  tel?: string;
}

export interface AdminUserPageQuery extends PageQuery {
  dept_id?: number | string;
  enabled?: boolean;
  ids?: Array<number | string>;
  name_prefix?: string;
}

export interface AdminRole {
  api_ids?: Array<number | string>;
  created_at: number | string;
  enabled: boolean;
  home_perm_id?: null | number | string;
  order_no: number;
  permission_ids?: Array<number | string>;
  remark?: null | string;
  role_id: string;
  role_name: string;
}

export interface AdminRoleDetail extends AdminRole {
  api_ids: Array<number | string>;
  api_details: Array<ApiPermission & { permission_titles: string[] }>;
  permission_ids: Array<number | string>;
  permission_details: Array<{
    api_count: number;
    auth_code: string;
    enabled?: boolean;
    id: number | string;
    missing: boolean;
    order_no: number;
    path: string;
    perm_type?: PermissionType;
    title: string;
  }>;
}

export interface AdminRoleWrite {
  api_ids?: Array<number | string>;
  enabled?: boolean;
  home_perm_id?: null | number | string;
  order_no?: number;
  permission_ids?: Array<number | string>;
  remark?: null | string;
  role_id: string;
  role_name: string;
}

export interface AdminRolePageQuery extends PageQuery {
  enabled?: boolean;
  role_name_prefix?: string;
}

export type PermissionType =
  | 'button'
  | 'catalog'
  | 'embedded'
  | 'link'
  | 'menu';

export interface PermissionMeta extends Record<string, JsonValue | undefined> {
  affix_tab?: boolean;
  authority?: string[];
  badge?: string;
  badge_type?: string;
  badge_variants?: string;
  icon?: string;
  iframe_src?: string;
  keep_alive?: boolean;
  link?: string;
  menu_visible_with_forbidden?: boolean;
  order?: number;
  title?: string;
}

export interface AdminPermission {
  auth_code: string;
  component: string;
  created_at: number | string;
  enabled: boolean;
  id: number | string;
  meta: PermissionMeta;
  name: string;
  order_no: number;
  path: string;
  perm_type: PermissionType;
  pid: number | string;
  redirect?: null | string;
  remark?: null | string;
  title: string;
}

export interface AdminPermissionWrite {
  auth_code?: string;
  component?: string;
  enabled?: boolean;
  meta: PermissionMeta;
  name: string;
  order_no?: number;
  path: string;
  perm_type: PermissionType;
  pid: number | string;
  redirect?: null | string;
  remark?: null | string;
  title: string;
}

export const AdminUserApi = {
  list: (params?: AdminUserPageQuery) =>
    requestClient.get<Page<AdminUser>>('/auth/user-admin', { params }),
  detail: (id: number | string) =>
    requestClient.get<AdminUserDetail>(`/auth/user-admin/${id}`),
  create: (data: AdminUserWrite) =>
    requestClient.post<AdminUser>('/auth/user-admin', data),
  update: (id: number | string, data: AdminUserWrite) =>
    requestClient.put<AdminUser>(`/auth/user-admin/${id}`, data),
  remove: (id: number | string) =>
    requestClient.delete<boolean>(`/auth/user-admin/${id}`),
  resetMfa: (id: number | string) =>
    requestClient.delete<boolean>(`/auth/user-admin/${id}/mfa/totp`),
};

export const AdminRoleApi = {
  list: (params?: AdminRolePageQuery) =>
    requestClient.get<Page<AdminRole>>('/auth/role', { params }),
  all: () => requestClient.get<AdminRole[]>('/auth/role/all'),
  detail: (role_id: string) =>
    requestClient.get<AdminRoleDetail>(`/adm/role/${role_id}/detail`),
  create: (data: AdminRoleWrite) =>
    requestClient.post<AdminRole>('/auth/role', data),
  update: (role_id: string, data: AdminRoleWrite) =>
    requestClient.put<AdminRole>(`/auth/role/${role_id}`, data),
  remove: (role_id: string) =>
    requestClient.delete<boolean>(`/auth/role/${role_id}`),
};

export const AdminPermissionApi = {
  list: () => requestClient.get<AdminPermission[]>('/auth/menu/all'),
  detail: (id: number | string) =>
    requestClient.get<AdminPermission>(`/auth/menu/${id}`),
  create: (data: AdminPermissionWrite) =>
    requestClient.post<AdminPermission>('/auth/menu', data),
  update: (id: number | string, data: AdminPermissionWrite) =>
    requestClient.put<AdminPermission>(`/auth/menu/${id}`, data),
  remove: (id: number | string) =>
    requestClient.delete<boolean>(`/auth/menu/${id}`),
};
