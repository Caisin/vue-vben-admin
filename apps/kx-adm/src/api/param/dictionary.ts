import type { JsonValue, Page, PageQuery } from '#/api/request';

import { requestClient } from '#/api/request';

export interface DicCode {
  code: string;
  created_at: number | string;
  dic_name: string;
  enabled: boolean;
  help_msg: string;
  remark: string;
}

export interface DicData {
  created_at: number | string;
  dic_code: string;
  enabled: boolean;
  id: number | string;
  is_def: boolean;
  label: string;
  remark: string;
  sort_no: number | string;
  value: JsonValue;
}

export interface DicCodeWrite {
  dic_name: string;
  enabled?: boolean;
  help_msg?: string;
  remark?: string;
}

export interface DicDataWrite {
  dic_code: string;
  enabled?: boolean;
  is_def?: boolean;
  label: string;
  remark?: string;
  sort_no?: number | string;
  value: JsonValue;
}

export interface DragDicData {
  id: number | string;
  sort_no: number | string;
}

export interface DicCodePageQuery extends PageQuery {
  code_prefix?: string;
  enabled?: boolean;
  name_prefix?: string;
}

export interface DicDataPageQuery extends PageQuery {
  dic_code?: string;
  enabled?: boolean;
  label_prefix?: string;
}

export const DictionaryApi = {
  codePage: (params?: DicCodePageQuery) =>
    requestClient.get<Page<DicCode>>('/param/dic/dic_page', { params }),
  dataPage: (params?: DicDataPageQuery) =>
    requestClient.get<Page<DicData>>('/param/dic/data_page', { params }),
  detail: (code: string) =>
    requestClient.get<DicCode>(`/param/dic/get_dic/${code}`),
  dataList: (code: string) =>
    requestClient.get<DicData[]>(`/param/dic/data_list/${code}`),
  allData: () => requestClient.get<DicData[]>('/param/dic/all_dic_data'),
  saveCode: (code: string, data: DicCodeWrite) =>
    requestClient.post<DicCode>(`/param/dic/save_dic/${code}`, data),
  createData: (data: DicDataWrite) =>
    requestClient.post<DicData>('/param/dic/save_data', data),
  updateData: (id: number | string, data: DicDataWrite) =>
    requestClient.put<DicData>(`/param/dic/save_data/${id}`, data),
  replaceData: (code: string, data: DicDataWrite[]) =>
    requestClient.post<DicData[]>(`/param/dic/save_datas/${code}`, data),
  reorder: (data: DragDicData) =>
    requestClient.post<null>('/param/dic/drag_data', data),
  normalizeOrder: (code: string) =>
    requestClient.get<null>(`/param/dic/fresh_cache/${code}`),
  deleteCode: (code: string) =>
    requestClient.delete<boolean>(`/param/dic/del_dic/${code}`),
  deleteData: (id: number | string) =>
    requestClient.delete<boolean>(`/param/dic/del_data/${id}`),
};
