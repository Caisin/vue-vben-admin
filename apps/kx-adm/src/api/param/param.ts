import type { JsonValue, Page, PageQuery } from '#/api/request';

import { requestClient } from '#/api/request';

export interface KxParam {
  confidential: boolean;
  enabled: boolean;
  param_code: string;
  param_value: JsonValue;
  remark: string;
}

export interface ParamSave {
  enabled?: boolean;
  param_code: string;
  param_value: JsonValue;
  remark?: string;
}

export interface ParamWrite {
  enabled?: boolean;
  param_value: JsonValue;
  remark?: string;
}

export interface ParamPageQuery extends PageQuery {
  code_prefix?: string;
  enabled?: boolean;
}

function pathCode(code: string) {
  return encodeURIComponent(code);
}

export const ParamApi = {
  list: (params?: ParamPageQuery) =>
    requestClient.get<Page<KxParam>>('/param/param', { params }),
  save: (data: ParamSave) => requestClient.post<KxParam>('/param/param', data),
  detail: (code: string) =>
    requestClient.get<KxParam>(`/param/param/detail/${pathCode(code)}`),
  value: (code: string) =>
    requestClient.get<JsonValue>(`/param/param/${pathCode(code)}`),
  systemSettings: () =>
    requestClient.get<JsonValue>('/param/param/sys_setting'),
  refresh: (code: string) =>
    requestClient.get<null>(`/param/param/refresh_cache/${pathCode(code)}`),
  set: (code: string, data: ParamWrite) =>
    requestClient.post<KxParam>(`/param/param/${pathCode(code)}`, data),
  remove: (code: string) =>
    requestClient.delete<boolean>(`/param/param/${pathCode(code)}`),
};
