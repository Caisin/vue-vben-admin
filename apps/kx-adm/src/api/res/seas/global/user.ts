import { defHttp } from '#/api/res/legacy-http';

export interface ResPage<T = any> {
  items?: T[];
  page_no?: number;
  page_size?: number;
  pages?: number;
  total?: number;
}

export interface RuntimeUser {
  [key: string]: any;
  acct_id?: number;
  avatar?: string;
  created_at?: number;
  email?: string;
  enabled?: boolean;
  id: number;
  is_guest?: boolean;
  name?: string;
  os?: string;
  platform?: string;
  reg_ip?: string;
  tel?: string;
  updated_at?: number;
}

export interface RuntimeUserDetail {
  current_links?: any[];
  push_endpoints?: any[];
  read_history?: any[];
  user?: RuntimeUser;
}

enum Api {
  GetConsumeLog = '/adm/user/consume_log',
  GetDetail = '/adm/user/user_info',
  GetFirebaseToken = '/adm/user/firebase_token',
  GetOrderList = '/adm/order',
  GetPageList = '/adm/user',
  GetSubDetailList = '/adm/user/res_item_read_log',
  GetSubList = '/adm/user/res_read_log',
  GetUserLink = '/adm/user/user_link',
}

function nested(params: any, path: string) {
  let value = params;
  for (const key of path.split('.')) value = value?.[key];
  return value;
}

function normalizeRange(
  params: any,
  source = 'created_at',
  start = 'created_start',
  end = 'created_end',
) {
  const range = nested(params, `${source}.bt`) ?? params?.[`${source}.bt`];
  if (Array.isArray(range)) {
    return { [start]: range[0], [end]: range[1] };
  }
  return {};
}

function clean(params: Record<string, any>) {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== '' && value !== null,
    ),
  );
}

function normalizeUserQuery(params: any = {}) {
  return clean({
    page: params.page,
    pageSize: params.pageSize,
    id: nested(params, 'id.eq') ?? params.id,
    name:
      nested(params, 'user_name.contains') ??
      nested(params, 'name.contains') ??
      params.name,
    platform: nested(params, 'platform.eq') ?? params.platform,
    enabled: nested(params, 'enabled.eq') ?? params.enabled,
    ...normalizeRange(params),
  });
}

function normalizeUidQuery(params: any = {}) {
  return nested(params, 'uid.eq') ?? params.uid ?? params['uid[eq]'];
}

function normalizeOrderQuery(params: any = {}) {
  return clean({
    page: params.page,
    pageSize: params.pageSize,
    acct_id:
      nested(params, 'acct_id.eq') ??
      normalizeUidQuery(params) ??
      params.acct_id,
    content_id:
      nested(params, 'res_id.eq') ?? params.content_id ?? params.res_id,
    episode_id:
      nested(params, 'item_id.eq') ?? params.episode_id ?? params.item_id,
    idempotency_key: nested(params, 'order_id.eq') ?? params.idempotency_key,
    link_id: nested(params, 'ch_id.eq') ?? params.link_id,
    platform: nested(params, 'platform.eq') ?? params.platform,
    provider: nested(params, 'provider.eq') ?? params.provider,
    provider_order_id:
      nested(params, 'other_order_id.eq') ?? params.provider_order_id,
    state: nested(params, 'state.eq') ?? params.state,
    environment: nested(params, 'pay_env.eq') ?? params.environment,
    country_code: nested(params, 'iso_code.eq') ?? params.country_code,
    sort: params.sort ?? params.field,
    descending: params.descending ?? params.order === 'desc',
    ...normalizeRange(params),
  });
}

function normalizeConsumptionQuery(params: any = {}) {
  return clean({
    page: params.page,
    pageSize: params.pageSize,
    uid: normalizeUidQuery(params),
    res_id: nested(params, 'res_id.eq') ?? params.res_id,
    item_id: nested(params, 'item_id.eq') ?? params.item_id,
    buy_type: nested(params, 'buy_type.eq') ?? params.buy_type,
    ...normalizeRange(params),
  });
}

function normalizeReadQuery(params: any = {}) {
  return clean({
    page: params.page,
    pageSize: params.pageSize,
    uid: normalizeUidQuery(params),
    res_id: nested(params, 'res_id.eq') ?? params.res_id,
    item_id: nested(params, 'item_id.eq') ?? params.item_id,
    state: nested(params, 'state.eq') ?? params.state,
    stat_day: nested(params, 'stat_day.eq') ?? params.stat_day,
  });
}

function normalizeLinkQuery(params: any = {}) {
  return clean({
    page: params.page,
    pageSize: params.pageSize,
    uid: normalizeUidQuery(params),
    link_id: nested(params, 'link_id.eq') ?? params.link_id,
    state: nested(params, 'state.eq') ?? params.state,
    ad_id: nested(params, 'ad_id.eq') ?? params.ad_id,
  });
}

export const getList = (params: any) =>
  defHttp.get<ResPage<RuntimeUser>>({
    url: Api.GetPageList,
    params: normalizeUserQuery(params),
  });

export const getUserDetail = (params: any) => {
  const uid = normalizeUidQuery(params) ?? params?.id;
  return defHttp.get<RuntimeUserDetail>({ url: `${Api.GetDetail}/${uid}` });
};

export const getConsumeLogList = (params: any) =>
  defHttp.get<ResPage<any>>({
    url: Api.GetConsumeLog,
    params: normalizeConsumptionQuery(params),
  });

export const getOrderList = (params: any) =>
  defHttp.get<ResPage<any>>({
    url: Api.GetOrderList,
    params: normalizeOrderQuery(params),
  });

export const getSubList = (params: any) =>
  defHttp.get<ResPage<any>>({
    url: Api.GetSubList,
    params: normalizeReadQuery(params),
  });

export const getSubDetailList = (params: any) =>
  defHttp.get<ResPage<any>>({
    url: Api.GetSubDetailList,
    params: normalizeReadQuery(params),
  });

export const getUserLinkList = (params: any) =>
  defHttp.get<ResPage<any>>({
    url: Api.GetUserLink,
    params: normalizeLinkQuery(params),
  });

export const getFireBaseList = (params: any) =>
  defHttp.get<ResPage<any>>({
    url: Api.GetFirebaseToken,
    params: clean({
      page: params?.page,
      pageSize: params?.pageSize,
      uid: normalizeUidQuery(params) ?? params?.uid,
    }),
  });

export const getAdWatchList = (params: any) =>
  defHttp.get<ResPage<any>>({ url: '/admin/ad_watch/page', params });
