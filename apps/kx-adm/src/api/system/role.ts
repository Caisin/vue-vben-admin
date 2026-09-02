import type { LegacyPage, LegacyPageQuery, StatusValue } from './shared';

import type {
  AdminRole,
  AdminRoleDetail,
  AdminRoleWrite,
} from '#/api/auth/admin';

import { requestClient } from '#/api/request';

import { enabledFromStatus, pageParams, statusFromEnabled } from './shared';

export interface SystemRole {
  apiIds?: string[];
  createTime?: number | string;
  homePermId?: null | string;
  id: string;
  name: string;
  permissions: string[];
  remark?: null | string;
  status: StatusValue;
}

export type SystemRoleWrite = Partial<Omit<SystemRole, 'createTime' | 'id'>> & {
  id?: string;
  name?: string;
};

function homePermissionId(value: null | string | undefined) {
  return value ? Number(value) : null;
}

function toSystemRole(
  role: AdminRole,
  permissions: Array<number | string> = [],
): SystemRole {
  return {
    apiIds: [],
    createTime: role.created_at,
    id: role.role_id,
    homePermId:
      role.home_perm_id === null || role.home_perm_id === undefined
        ? null
        : String(role.home_perm_id),
    name: role.role_name,
    permissions: permissions.map(String),
    remark: role.remark,
    status: statusFromEnabled(role.enabled),
  };
}

function toRoleWrite(id: string, data: SystemRoleWrite): AdminRoleWrite {
  return {
    api_ids: (data.apiIds ?? []).map(Number),
    enabled: enabledFromStatus(data.status),
    home_perm_id: homePermissionId(data.homePermId),
    order_no: 0,
    permission_ids: (data.permissions ?? []).map(Number),
    remark: data.remark,
    role_id: id,
    role_name: data.name ?? id,
  };
}

export const SystemRoleApi = {
  async all(): Promise<SystemRole[]> {
    const roles = await requestClient.get<AdminRole[]>('/auth/role/all');
    return roles.map((role) => ({
      ...toSystemRole(role, role.permission_ids),
      apiIds: role.api_ids?.map(String) ?? [],
    }));
  },
  async detail(id: string): Promise<SystemRole> {
    const role = await requestClient.get<AdminRoleDetail>(`/auth/role/${id}`);
    return {
      ...toSystemRole(role, role.permission_ids),
      apiIds: role.api_ids.map(String),
    };
  },
  async list(params: LegacyPageQuery = {}): Promise<LegacyPage<SystemRole>> {
    const result = await requestClient.get<
      import('#/api/request').Page<AdminRole>
    >('/auth/role', {
      params: {
        ...pageParams(params),
        role_name_prefix: params.name,
      },
    });
    return {
      items: result.items.map((role) => toSystemRole(role)),
      total: result.total,
    };
  },
  async create(data: SystemRoleWrite) {
    const id = data.id || data.name || '';
    const role = await requestClient.post<AdminRole>(
      '/auth/role',
      toRoleWrite(id, data),
    );
    return {
      ...toSystemRole(role, data.permissions),
      apiIds: data.apiIds?.map(String) ?? [],
    };
  },
  async copy(sourceId: string, data: { id: string; name: string }) {
    const role = await requestClient.post<AdminRole>(
      `/auth/role/${sourceId}/copy`,
      {
        role_id: data.id,
        role_name: data.name,
      },
    );
    return {
      ...toSystemRole(role, role.permission_ids),
      apiIds: role.api_ids?.map(String) ?? [],
    };
  },
  async update(id: string, data: SystemRoleWrite) {
    const detail = await requestClient.get<AdminRoleDetail>(`/auth/role/${id}`);
    const roleName = data.name ?? detail.role_name;
    const write = {
      enabled:
        data.status === undefined
          ? detail.enabled
          : enabledFromStatus(data.status),
      home_perm_id: Object.hasOwn(data, 'homePermId')
        ? homePermissionId(data.homePermId)
        : (detail.home_perm_id ?? null),
      order_no: detail.order_no,
      permission_ids: (data.permissions ?? detail.permission_ids).map(Number),
      api_ids: (data.apiIds ?? detail.api_ids).map(Number),
      remark: data.remark === undefined ? detail.remark : data.remark,
      role_id: id,
      role_name: roleName,
    } satisfies AdminRoleWrite;
    const role = await requestClient.put<AdminRole>(`/auth/role/${id}`, write);
    return {
      ...toSystemRole(role, write.permission_ids),
      apiIds: write.api_ids.map(String),
    };
  },
  remove: (id: string) => requestClient.delete<boolean>(`/auth/role/${id}`),
};
