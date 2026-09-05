import type { Page, PageQuery } from '#/api/request';

import { requestClient } from '#/api/request';

export interface DataSourceView {
  credential_code: string;
  credential_configured: boolean;
  create_at: number | string;
  cur_schema: string;
  db_host: string;
  db_name: string;
  db_type: string;
  ds_code: string;
  name: string;
  port: number;
  remark: string;
  state: boolean;
  time_zone: string;
  user_name: string;
}

export interface DataSourceWrite {
  credential_code?: string;
  cur_schema?: string;
  db_host?: string;
  db_name?: string;
  db_type: string;
  ds_code?: string;
  name: string;
  port?: number;
  remark?: string;
  state: boolean;
  time_zone?: string;
  user_name?: string;
}

export const DataSourceApi = {
  list: (params?: PageQuery & { keyword?: string; state?: boolean }) =>
    requestClient.get<Page<DataSourceView>>('/adm/data-sources', { params }),
  create: (data: DataSourceWrite) =>
    requestClient.post<DataSourceView>('/adm/data-sources', data),
  update: (code: string, data: Omit<DataSourceWrite, 'ds_code'>) =>
    requestClient.put<DataSourceView>(
      `/adm/data-sources/${encodeURIComponent(code)}`,
      data,
    ),
  remove: (code: string) =>
    requestClient.delete<boolean>(
      `/adm/data-sources/${encodeURIComponent(code)}`,
    ),
  probe: (
    code: string,
    data: { allow_insecure?: boolean; warehouse?: string } = {},
  ) =>
    requestClient.post<{
      ds_code: string;
      message: string;
      reachable: boolean;
    }>(`/adm/data-sources/${encodeURIComponent(code)}/probe`, data),
};
