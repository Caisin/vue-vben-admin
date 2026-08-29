import type { JsonValue, Page, PageQuery } from '#/api/request';

import { requestClient } from '#/api/request';

export interface AuditLog {
  api_path: string;
  created_at: number | string;
  debug_enabled?: boolean | null;
  duration_ms: number | string;
  http_status: number;
  id: number | string;
  method: string;
  query_summary: JsonValue;
  remote_ip: string;
  request_body?: JsonValue | null;
  request_headers?: JsonValue | null;
  request_query?: JsonValue | null;
  response_body?: JsonValue | null;
  response_code?: null | string;
  response_headers?: JsonValue | null;
  uid: number | string;
  user_agent: string;
}

export interface AuditLogPageQuery extends PageQuery {
  api_path_prefix?: string;
  created_range?: string;
  http_status?: number;
  method?: string;
  uid?: number | string;
}

export const AuditLogApi = {
  list: (params?: AuditLogPageQuery) =>
    requestClient.get<Page<AuditLog>>('/auth/audit-logs', { params }),
  detail: (id: number | string) =>
    requestClient.get<AuditLog>(`/auth/audit-logs/${id}`),
};
