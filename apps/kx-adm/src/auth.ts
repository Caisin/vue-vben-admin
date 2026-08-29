import type { UserInfo } from '@vben/types';

export interface AdminCurrentUserRole {
  enabled: boolean;
  role_id: string;
  role_name: string;
}

/** 认证服务当前用户原始响应；扩展字段兼容尚未提供完整信息的后端。 */
export interface AdminCurrentUserResponse {
  avatar: string;
  created_at?: number | string;
  dept_id?: number | string;
  dept_name?: null | string;
  email: string;
  enabled: boolean;
  home_path?: null | string;
  home_perm_id?: null | number | string;
  id: number | string;
  is_guest?: boolean;
  name: string;
  os?: string;
  permission_count?: number;
  platform?: string;
  reg_ip?: string;
  remark?: null | string;
  roles?: AdminCurrentUserRole[];
  tel: string;
  updated_at?: number | string;
}

export interface AdminCurrentUser {
  avatar: string;
  created_at: number | string;
  dept_id: number | string;
  dept_name: null | string;
  email: string;
  enabled: boolean;
  home_path: string;
  home_perm_id: null | number | string;
  id: number | string;
  is_guest: boolean;
  name: string;
  os: string;
  permission_count: number;
  platform: string;
  reg_ip: string;
  remark: null | string;
  roles: AdminCurrentUserRole[];
  tel: string;
  updated_at: number | string;
}

export function adminPasswordLoginRequest(userName: string, password: string) {
  return {
    app_id: 'admin',
    login_type: 'user_name' as const,
    password,
    user_name: userName,
  };
}

export function normalizeAdminCurrentUser(
  user: AdminCurrentUserResponse,
): AdminCurrentUser {
  const homePath = user.home_path ?? '';
  return {
    avatar: user.avatar,
    created_at: user.created_at ?? 0,
    dept_id: user.dept_id ?? 0,
    dept_name: user.dept_name ?? null,
    email: user.email,
    enabled: user.enabled,
    home_path:
      homePath === '/overview' || homePath === '/override' ? '' : homePath,
    home_perm_id: user.home_perm_id ?? null,
    id: user.id,
    is_guest: user.is_guest ?? false,
    name: user.name,
    os: user.os ?? '',
    permission_count: user.permission_count ?? 0,
    platform: user.platform ?? '',
    reg_ip: user.reg_ip ?? '',
    remark: user.remark ?? null,
    roles: user.roles ?? [],
    tel: user.tel,
    updated_at: user.updated_at ?? 0,
  };
}

export function toVbenUserInfo(user: AdminCurrentUserResponse): UserInfo {
  const normalized = normalizeAdminCurrentUser(user);
  return {
    avatar: normalized.avatar,
    desc: normalized.email || normalized.tel || '',
    homePath: normalized.home_path,
    realName: normalized.name,
    roles: normalized.roles
      .filter((role) => role.enabled)
      .map((role) => role.role_id),
    token: '',
    userId: String(normalized.id),
    username: normalized.name,
  };
}
