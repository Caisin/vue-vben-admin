import { requestClient } from '#/api/request';

export interface GrantValues {
  delivery_version_id?: number;
  can_download: boolean;
  valid_from: number;
  valid_until: number;
  seq_from: number;
  seq_until: number;
  modules: string[];
}
export interface GrantRow extends GrantValues {
  id: number;
  res_id: number;
  res_name: string;
  resource_code: string;
  uid: number;
  user_name: string;
  granted_by: number;
  granted_by_name: string;
  delivery_version_id: number;
  version_name: string;
  updated_at: number;
  snapshot: string;
}
export interface GrantResource {
  res_id: number;
  name: string;
  code: string;
  versions: { id: number; name: string; kind?: string }[];
}
export interface GrantFilter {
  keyword?: string;
  res_id?: number;
  version_id?: number;
  version_keyword?: string;
  uids?: number[];
  granted_by?: number;
  can_download?: boolean;
  status?: string;
  module?: string;
  updated_from?: number;
  updated_until?: number;
  valid_from_min?: number;
  valid_from_max?: number;
  valid_until_min?: number;
  valid_until_max?: number;
  page: number;
  size: number;
}
export const grantModules = [
  ['film', '视频（所选版本）'],
  ['prompt', '提示词'],
  ['project_image', '工程截图'],
  ['poster', '海报'],
  ['synopsis', '剧本简介'],
  ['srt', 'SRT'],
].map(([value, label]) => ({ value: value ?? '', label: label ?? '' }));
export const defaultGrantValues = (): GrantValues => ({
  can_download: true,
  valid_from: 0,
  valid_until: 0,
  seq_from: 0,
  seq_until: 0,
  modules: ['film'],
});
export const grantApi = (delivery: boolean) => {
  const base = `/adm/res/${delivery ? 'delivery/' : ''}grant-maintenance`;
  const targets = (rows: GrantRow[]) =>
    rows.map(({ id, snapshot }) => ({ id, snapshot }));
  return {
    page: (params: GrantFilter) =>
      requestClient.get<{ items: GrantRow[]; total: number }>(base, {
        params,
        paramsSerializer: {
          indexes: true,
          encode: (value: string) =>
            encodeURIComponent(value)
              .replaceAll('%5B', '[')
              .replaceAll('%5D', ']'),
        },
      }),
    options: (keyword: string, page = 1) =>
      requestClient.get<{ items: GrantResource[]; total: number }>(
        `${base}/options`,
        { params: { keyword, page, size: 20 } },
      ),
    users: () =>
      requestClient.get<import('./downloads').DownloadUserTreeNode[]>(
        `${base}/users`,
      ),
    create: (
      resources: { res_id: number; version_id: number }[],
      uids: number[],
      values: Partial<GrantValues>,
    ) => requestClient.post<number>(base, { resources, uids, values }),
    change: (rows: GrantRow[], patch: Partial<GrantValues>) =>
      requestClient.request<number>(base, {
        method: 'PATCH',
        data: { targets: targets(rows), patch },
      }),
    remove: (rows: GrantRow[]) =>
      requestClient.post<number>(`${base}/delete`, { targets: targets(rows) }),
  };
};
