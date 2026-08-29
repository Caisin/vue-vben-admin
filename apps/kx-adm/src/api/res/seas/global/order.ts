import { defHttp } from '#/api/res/legacy-http';

export interface PayOrderSummaryAmount {
  currency: string;
  order_amount_minor: number;
  paid_amount_minor: number;
  refunded_amount_minor: number;
}

export interface PayOrderSummary {
  amounts?: PayOrderSummaryAmount[];
  android_paid_count?: number;
  ios_paid_count?: number;
  order_count?: number;
  paid_count?: number;
  paid_user_count?: number;
  refunded_count?: number;
}

enum Api {
  GetPageList = '/adm/order',
}

function nested(params: any, path: string) {
  let value = params;
  for (const key of path.split('.')) value = value?.[key];
  return value;
}

function normalizeRange(params: any) {
  const range = nested(params, 'created_at.bt') ?? params?.['created_at.bt'];
  if (Array.isArray(range))
    return { created_start: range[0], created_end: range[1] };
  return {};
}

function clean(params: Record<string, any>) {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== '' && value !== null,
    ),
  );
}

export function normalizeOrderQuery(params: any = {}) {
  return clean({
    page: params.page,
    pageSize: params.pageSize,
    acct_id: nested(params, 'acct_id.eq') ?? params.acct_id,
    content_id:
      nested(params, 'res_id.eq') ?? params.content_id ?? params.res_id,
    episode_id:
      nested(params, 'item_id.eq') ?? params.episode_id ?? params.item_id,
    idempotency_key: nested(params, 'order_id.eq') ?? params.idempotency_key,
    link_id: nested(params, 'ch_id.eq') ?? params.link_id,
    attribution_uid: nested(params, 'link_uid.eq') ?? params.attribution_uid,
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

export const getList = (params: any) =>
  defHttp.get<any>({
    url: Api.GetPageList,
    params: normalizeOrderQuery(params),
  });

export const getTotal = (params: any) =>
  defHttp.get<PayOrderSummary>({
    url: `${Api.GetPageList}/total`,
    params: normalizeOrderQuery(params),
  });

export const refund = (orderId: number | string) =>
  defHttp.post<any>({ url: `${Api.GetPageList}/refund/${orderId}` });

export const recovery = (orderId: number | string) =>
  defHttp.post<any>({ url: `${Api.GetPageList}/recovery/${orderId}` });
