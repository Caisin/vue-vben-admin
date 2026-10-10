import { requestClient } from '#/api/request';

export interface AssignmentRole {
  enabled: boolean;
  role_id: string;
  role_name: string;
}
export interface AssignmentUser {
  email: string;
  enabled: boolean;
  id: number | string;
  name: string;
  tel: string;
}
export interface AssignmentConfig extends AssignmentUser {
  roles: AssignmentRole[];
  scope: AssignmentScope;
}
export interface AssignmentScope {
  mode: 'all' | 'managed' | 'selected';
  organization_keys: string[];
  revision: number;
}
export interface AssignmentOrganization {
  key: string;
  title: string;
  children: AssignmentOrganization[];
}
interface AssignmentPage<T> {
  items: T[];
  total: number;
}
export interface AssignmentQuery {
  configured_only?: boolean;
  keyword?: string;
  page: number;
  size: number;
}
const base = '/auth/role-assignment';
const rolePath = (role: string) => `${base}/${encodeURIComponent(role)}`;

export const RoleAssignmentApi = {
  configUsers: (params: AssignmentQuery) =>
    requestClient.get<AssignmentPage<AssignmentConfig>>(
      `${base}/config/users`,
      { params },
    ),
  configRoles: () =>
    requestClient.get<AssignmentRole[]>(`${base}/config/roles`),
  configOrganizations: () =>
    requestClient.get<AssignmentOrganization[]>(`${base}/config/organizations`),
  saveConfig: (
    uid: number | string,
    roleIds: string[],
    expectedRoleIds: string[],
    scope?: AssignmentScope,
  ) =>
    requestClient.put(`${base}/config/${uid}`, {
      role_ids: roleIds,
      expected_role_ids: expectedRoleIds,
      ...(scope
        ? {
            scope: {
              mode: scope.mode,
              organization_keys: scope.organization_keys,
              expected_revision: scope.revision,
            },
          }
        : {}),
    }),
  roles: () => requestClient.get<AssignmentRole[]>(`${base}/roles`),
  members: (role: string, params: AssignmentQuery) =>
    requestClient.get<AssignmentPage<AssignmentUser>>(
      `${rolePath(role)}/members`,
      { params },
    ),
  candidates: (role: string, params: AssignmentQuery) =>
    requestClient.get<AssignmentPage<AssignmentUser>>(
      `${rolePath(role)}/candidates`,
      { params },
    ),
  addMembers: (role: string, uids: Array<number | string>) =>
    requestClient.post(`${rolePath(role)}/members`, { uids: uids.map(Number) }),
  removeMember: (role: string, uid: number | string) =>
    requestClient.delete(`${rolePath(role)}/members/${uid}`),
};
