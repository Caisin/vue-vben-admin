import type { JsonValue } from '#/api/request';

import { ParamApi } from '#/api/param';
import { defHttp } from '#/api/res/legacy-http';

export interface ResLink {
  bx_type?: string;
  cover?: string;
  create_time?: number | string;
  ext_info?: null | Record<string, unknown>;
  fb_acct?: number | string;
  fb_pixel_id?: string;
  id: number | string;
  is_del?: number;
  item_id?: number | string;
  link?: string;
  media_type?: number | string;
  name?: string;
  post_tmp_id?: number | string;
  remark?: string;
  res_id?: number | string;
  res_name?: string;
  seq_no?: number | string;
  uid?: number | string;
}

export interface ResLinkQuery {
  id?: number | string;
  is_del?: number;
  item_id?: number | string;
  name?: string;
  page?: number;
  pageSize?: number;
  res_id?: number | string;
  uid?: number | string;
}

export interface ResLinkSave {
  bx_type?: string;
  cover?: string;
  ext_info?: Record<string, unknown>;
  fb_acct?: number | string;
  fb_pixel_id?: string;
  id?: number | string;
  item_id: number | string;
  link?: string;
  media_type?: number | string;
  name: string;
  post_tmp_id?: number | string;
  remark?: string;
  res_id?: number | string;
  uid: number | string;
}

export interface LinkPrefixConfig {
  app_jump_link: string;
  deep_link_prefix: string;
  deep_link_prefix_2: string;
  h5_promotion_link: string;
  w2a_link: string;
}

export interface SelectOptionSource {
  [key: string]: any;
  id?: number | string;
  name?: string;
}

export interface PayTemplate {
  code?: string;
  created_at?: number | string;
  enabled?: boolean;
  id: number | string;
  name?: string;
  remark?: string;
}

export interface PayTemplateDetail {
  info?: PayTemplate;
  items?: Array<Record<string, unknown>>;
}

export interface LinkPayAnalysisRow {
  pay_amount?: number | string;
  pay_num?: number | string;
  pay_user_num?: number | string;
  total_amount?: number | string;
}

enum Api {
  FbAcctList = '/adm/facebook/sub/acct_list',
  FbPixelList = '/adm/facebook/pixel_cfg',
  GetAnalysisList = '/adm/stat/link/pay_analysis',
  GetChapterList = '/adm/res_item',
  GetList = '/adm/link',
  GetPayTemplate = '/adm/pay_cfg/tmp',
  GetPayTemplateList = '/adm/pay_cfg/tmp_list',
  GetResourceList = '/adm/res/list',
}

const PREFIX_CODES: Array<keyof LinkPrefixConfig> = [
  'h5_promotion_link',
  'w2a_link',
  'deep_link_prefix',
  'deep_link_prefix_2',
  'app_jump_link',
];

function stringValue(value: JsonValue): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value);
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const candidate = value.value ?? value.url ?? value.prefix;
    if (typeof candidate === 'string') return candidate;
  }
  return '';
}

export const getList = (params: ResLinkQuery) => {
  return defHttp.get<any>({
    url: Api.GetList,
    params: params as Record<string, unknown>,
  });
};

export const postSave = (data: Record<string, unknown> | ResLinkSave) => {
  return defHttp.post<any>({ url: Api.GetList, data });
};

export const postDel = (
  data: Array<number | string> | Record<string, unknown> | ResLink,
) => {
  const ids = Array.isArray(data)
    ? data
    : [(data as ResLink).id].filter(Boolean);
  return defHttp.delete<any>({ url: Api.GetList, data: ids });
};

export const getAnalysisList = (params: Record<string, unknown>) => {
  return defHttp.get<LinkPayAnalysisRow[]>({
    url: Api.GetAnalysisList,
    params,
  });
};

export const getResourceOptions = (params?: Record<string, unknown>) => {
  return defHttp.get<SelectOptionSource[]>({
    url: Api.GetResourceList,
    params,
  });
};

export const getChapterOptions = (resId: number | string) => {
  return defHttp.get<SelectOptionSource[]>({
    url: `${Api.GetChapterList}/${resId}`,
  });
};

export const getPayTemplateList = (params?: Record<string, unknown>) => {
  return defHttp.get<PayTemplate[]>({ url: Api.GetPayTemplateList, params });
};

export const getPayTemplateDetail = (id: number | string) => {
  return defHttp.get<PayTemplateDetail>({ url: `${Api.GetPayTemplate}/${id}` });
};

export const getFbPixelOptions = () => {
  return defHttp.get<SelectOptionSource[]>({ url: Api.FbPixelList });
};

export const getFbAcctOptions = (params?: Record<string, unknown>) => {
  return defHttp.get<SelectOptionSource[]>({ url: Api.FbAcctList, params });
};

export async function getLinkPrefixConfig(): Promise<LinkPrefixConfig> {
  const entries = await Promise.all(
    PREFIX_CODES.map(
      async (code) => [code, stringValue(await ParamApi.value(code))] as const,
    ),
  );
  return Object.fromEntries(entries) as unknown as LinkPrefixConfig;
}
