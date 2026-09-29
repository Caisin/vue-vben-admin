import { requestClient } from '#/api/request';
export interface ClientDevice {
  device_id: string;
  name: string;
  os: string;
  app_version: string;
  status: string;
  assigned_uid: null | number | string;
  assigned_name: string;
  requested_uid: number | string;
  requested_name: string;
  last_login_uid: null | number | string;
  last_login_name: string;
  approved_name: string;
  approved_at: null | number;
  created_at: number;
  last_seen_at: number;
  last_login_at: null | number;
  last_ip: string;
  remark: string;
}
export interface DeviceEvent {
  id: number | string;
  user_name: string;
  uid: number | string;
  action: string;
  ip: string;
  created_at: number;
}
const base = '/auth/client-devices';
export const ClientDeviceApi = {
  page: (params: Record<string, unknown>) =>
    requestClient.get<{ items: ClientDevice[]; total: number }>(base, {
      params,
    }),
  events: (id: string, page: number) =>
    requestClient.get<{ items: DeviceEvent[]; total: number }>(
      `${base}/${id}/events`,
      { params: { page, size: 20 } },
    ),
  authorize: (id: string) => requestClient.post(`${base}/${id}/authorize`),
  revoke: (id: string) => requestClient.post(`${base}/${id}/revoke`),
  edit: (
    id: string,
    body: { assigned_uid: null | number | string; remark: string },
  ) => requestClient.put(`${base}/${id}`, body),
};
