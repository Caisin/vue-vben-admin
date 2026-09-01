import type { Page, PageQuery } from '#/api/request';

import { requestClient } from '#/api/request';

export interface KuaishouAppConfig {
  app_id: string;
  app_name: string;
  created_at: number | string;
  credential_code: string;
  enabled: boolean;
}

export type KuaishouAppWrite = Omit<KuaishouAppConfig, 'app_id' | 'created_at'>;

export interface KuaishouAppListQuery extends PageQuery {
  app_id_prefix?: string;
  app_name_prefix?: string;
  enabled?: boolean;
}

const basePath = '/param/kuaishou-apps';

export const KuaishouAppApi = {
  list: (params?: KuaishouAppListQuery) =>
    requestClient.get<Page<KuaishouAppConfig>>(basePath, { params }),
  detail: (appId: string) =>
    requestClient.get<KuaishouAppConfig>(
      `${basePath}/${encodeURIComponent(appId)}`,
    ),
  create: (data: KuaishouAppWrite) =>
    requestClient.post<KuaishouAppConfig>(basePath, data),
  update: (appId: string, data: KuaishouAppWrite) =>
    requestClient.put<KuaishouAppConfig>(
      `${basePath}/${encodeURIComponent(appId)}`,
      data,
    ),
  remove: (appId: string) =>
    requestClient.delete<boolean>(`${basePath}/${encodeURIComponent(appId)}`),
};
