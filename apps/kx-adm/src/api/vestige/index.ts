import type { TaskRun } from '#/api/task/run';

import { requestClient } from '#/api/request';

export type RolePermission = 'contributor' | 'owner' | 'publisher' | 'viewer';
export interface MemoryRole {
  id: string;
  name: string;
  description: string;
  company_id: null | string;
  company_name?: null | string;
  owner_user_id: string;
  kind: string;
  status: string;
  revision: number;
  created_at: number;
  updated_at: number;
}
export interface RoleAccess {
  role: MemoryRole;
  permission: RolePermission;
  can_copy: boolean;
  can_provision: boolean;
}
export interface UserCandidate {
  user_id: string;
  name: string;
  enabled: boolean;
}
export interface RoleMember extends UserCandidate {
  permission: RolePermission;
  granted_at: number;
}
export interface CompanyOption {
  id: string;
  name: string;
}
export interface RoleCopy {
  role: MemoryRole;
  task: TaskRun;
}
const root = '/vestige';
const rolePath = (id: string) => `${root}/roles/${encodeURIComponent(id)}`;
export const VestigeApi = {
  roles: (after?: string, limit = 26) =>
    requestClient.get<MemoryRole[]>(`${root}/roles`, {
      params: { after, limit },
    }),
  companies: () => requestClient.get<CompanyOption[]>(`${root}/companies`),
  defaultRole: () =>
    requestClient.post<MemoryRole>(`${root}/roles/default`, {}),
  create: (name: string, company_id?: string) =>
    requestClient.post<MemoryRole>(`${root}/roles`, {
      name,
      company_id: company_id || null,
    }),
  access: (id: string) =>
    requestClient.get<RoleAccess>(`${rolePath(id)}/access`),
  rename: (id: string, name: string, revision: number) =>
    requestClient.request<boolean>(rolePath(id), {
      method: 'PATCH',
      data: { name, revision },
    }),
  provision: (id: string) =>
    requestClient.post<TaskRun>(`${rolePath(id)}/provision`, {}),
  upgrade: (id: string) =>
    requestClient.post<TaskRun>(`${rolePath(id)}/upgrade`, {}),
  copy: (id: string, name: string, target_user_id: string) =>
    requestClient.post<RoleCopy>(`${rolePath(id)}/copy`, {
      name,
      target_user_id,
    }),
  task: (id: string, task: number | string) =>
    requestClient.get<TaskRun>(
      `${rolePath(id)}/tasks/${encodeURIComponent(String(task))}`,
    ),
  members: (id: string, after?: string, limit = 26) =>
    requestClient.get<RoleMember[]>(`${rolePath(id)}/members`, {
      params: { after, limit },
    }),
  candidates: (id: string, keyword = '', after?: string, limit = 26) =>
    requestClient.get<UserCandidate[]>(`${rolePath(id)}/candidates`, {
      params: { keyword, after, limit },
    }),
  grant: (
    id: string,
    user_id: string,
    permission: Exclude<RolePermission, 'owner'>,
  ) =>
    requestClient.post<boolean>(`${rolePath(id)}/members`, {
      user_id,
      permission,
    }),
  revoke: (id: string, user: string) =>
    requestClient.delete<boolean>(
      `${rolePath(id)}/members/${encodeURIComponent(user)}`,
    ),
};
