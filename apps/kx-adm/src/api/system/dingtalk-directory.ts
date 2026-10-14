import { plaintextRequestClient, requestClient } from '#/api/request';
export interface RawDepartment {
  id: string;
  parent_id: string;
  name: string;
  active: boolean;
  synced_at: number;
  raw: Record<string, unknown>;
}
export interface RawMember {
  id: string;
  name: string;
  departments: string[];
  synced_at: number;
  raw: Record<string, unknown>;
}
export interface AttendanceRequest {
  source_id: string;
  department_id?: string;
  include_children: boolean;
  date_from: string;
  date_to: string;
}
export interface AttendanceView {
  id: number | string;
  request: AttendanceRequest;
  state: string;
  error: string;
  member_count: number;
  record_count: number;
  completed: number;
  total: number;
  created_at: number;
}
export interface AttendanceRecord {
  id: number | string;
  userId: string;
  userName: string;
  workDate: number;
  checkType: string;
  baseCheckTime: number;
  userCheckTime: number;
  timeResult: string;
  locationResult: string;
  sourceType: string;
}
const root = '/auth/dingtalk-directory';
export const DingtalkDirectoryApi = {
  sources: () =>
    requestClient.get<{ code: string; name: string; enabled: boolean }[]>(
      `${root}/sources`,
    ),
  departments: (source_id: string) =>
    requestClient.get<RawDepartment[]>(`${root}/departments`, {
      params: { source_id },
    }),
  members: (params: {
    source_id: string;
    department_id?: string;
    include_children: boolean;
    keyword?: string;
    page: number;
    size: number;
  }) =>
    requestClient.get<{ items: RawMember[]; total: number }>(
      `${root}/members`,
      { params },
    ),
  create: (data: AttendanceRequest) =>
    requestClient.post<AttendanceView>(`${root}/attendance`, data),
  status: (id: number | string) =>
    requestClient.get<AttendanceView>(`${root}/attendance/${id}`),
  history: (source_id: string, page = 1) =>
    requestClient.get<{ items: AttendanceView[]; total: number }>(
      `${root}/attendance`,
      { params: { source_id, page, size: 20 } },
    ),
  records: (id: number | string, page: number) =>
    requestClient.get<{ items: AttendanceRecord[]; total: number }>(
      `${root}/attendance/${id}/records`,
      { params: { page, size: 50 } },
    ),
  download: (id: number | string) =>
    plaintextRequestClient.download<Blob>(`${root}/attendance/${id}/download`),
};
