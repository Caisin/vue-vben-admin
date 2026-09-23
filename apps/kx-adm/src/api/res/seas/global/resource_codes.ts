import { requestClient } from '#/api/request';

export interface ResourceCode {
  code: string;
  name: string;
  author: string;
  remark: string;
  created_at: number;
  updated_at: number;
}

export interface ResourceCodePage {
  items: ResourceCode[];
  total: number;
  pages: number;
  page_no: number;
  page_size: number;
}

export interface ResourceCodeWrite {
  code: string;
  name: string;
  author: string;
  remark: string;
}

export interface ResourceCodeUpdate extends ResourceCodeWrite {
  expected_updated_at: number;
}

export const ResourceCodeApi = {
  list: (params?: { keyword?: string; page?: number; size?: number }) =>
    requestClient.get<ResourceCodePage>('/adm/res/codes', { params }),
  create: (data: ResourceCodeWrite) =>
    requestClient.post<ResourceCode>('/adm/res/codes', data),
  update: (code: string, data: ResourceCodeUpdate) =>
    requestClient.put<ResourceCode>(
      `/adm/res/codes/${encodeURIComponent(code)}`,
      data,
    ),
};
