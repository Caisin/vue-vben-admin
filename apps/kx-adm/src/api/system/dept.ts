import type { StatusValue } from './shared';

import { requestClient } from '#/api/request';

import { enabledFromStatus, statusFromEnabled } from './shared';

interface AdminDept {
  children?: AdminDept[];
  created_at: number | string;
  enabled: boolean;
  id: number | string;
  name: string;
  pid: number | string;
  remark?: null | string;
  sort_no: number;
  updated_at: number | string;
}

interface AdminDeptWrite {
  enabled: boolean;
  name: string;
  pid: number;
  remark?: null | string;
  sort_no: number;
}

export interface SystemDept {
  children?: SystemDept[];
  createTime?: number | string;
  id: string;
  name: string;
  pid?: string;
  remark?: null | string;
  sortNo?: number;
  status: StatusValue;
}

export type SystemDeptWrite = Omit<
  SystemDept,
  'children' | 'createTime' | 'id'
>;

function toSystemDept(dept: AdminDept): SystemDept {
  return {
    children: dept.children?.map((child) => toSystemDept(child)),
    createTime: dept.created_at,
    id: String(dept.id),
    name: dept.name,
    pid: String(dept.pid),
    remark: dept.remark,
    sortNo: dept.sort_no,
    status: statusFromEnabled(dept.enabled),
  };
}

function toDeptWrite(data: SystemDeptWrite): AdminDeptWrite {
  return {
    enabled: enabledFromStatus(data.status),
    name: data.name,
    pid: data.pid ? Number(data.pid) : 0,
    remark: data.remark,
    sort_no: data.sortNo ?? 0,
  };
}

export const SystemDeptApi = {
  async list() {
    const list = await requestClient.get<AdminDept[]>('/auth/dept/list');
    return list.map((dept) => toSystemDept(dept));
  },
  async create(data: SystemDeptWrite) {
    const dept = await requestClient.post<AdminDept>(
      '/auth/dept',
      toDeptWrite(data),
    );
    return toSystemDept(dept);
  },
  async update(id: string, data: SystemDeptWrite) {
    const dept = await requestClient.put<AdminDept>(
      `/auth/dept/${id}`,
      toDeptWrite(data),
    );
    return toSystemDept(dept);
  },
  remove: (id: string) => requestClient.delete<boolean>(`/auth/dept/${id}`),
};
