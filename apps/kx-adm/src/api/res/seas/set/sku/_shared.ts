import { defHttp } from '#/api/res/legacy-http';

const BASE_URL = '/asset/pay/skus';

function normalizeSku(item: any) {
  const metadata = item?.provider_metadata ?? {};
  const productInfo =
    metadata.product_info && typeof metadata.product_info === 'object'
      ? metadata.product_info
      : metadata;
  return {
    ...item,
    product_info: productInfo ?? {},
    state: item?.enabled ? 1 : 0,
  };
}

function normalizePage(payload: any) {
  const items = Array.isArray(payload)
    ? payload
    : (payload?.items ?? payload?.records ?? []);
  const normalized = items.map((item: any) => normalizeSku(item));
  if (Array.isArray(payload)) return normalized;
  return { ...payload, items: normalized, records: normalized };
}

function cleanParams(provider: string, params: any = {}) {
  const state = params.state ?? params['state.eq'];
  return {
    page: params.page,
    size: params.size ?? params.pageSize,
    provider,
    product_id: params.product_id ?? params['product_id.eq'],
    product_name_prefix:
      params.product_name_prefix ??
      params.product_name ??
      params['product_name.contains'],
    enabled:
      params.enabled ??
      (state === undefined || state === '' ? undefined : Number(state) === 1),
  };
}

function serializeSku(provider: string, data: any) {
  const productInfo = { ...data.product_info };
  const payItemId = Number(data.pay_item_id || productInfo.pay_item_id || 0);
  delete productInfo.pay_item_id;
  return {
    pay_item_id: payItemId,
    provider,
    product_id: String(data.product_id ?? '').trim(),
    product_name: String(data.product_name ?? '').trim(),
    subscription: Boolean(data.subscription ?? productInfo.is_sub),
    enabled: data.enabled ?? data.state !== 0,
    provider_metadata: { product_info: productInfo },
  };
}

export function createSkuApi(provider: string) {
  return {
    getList(params: any) {
      return defHttp
        .get<any>({ url: BASE_URL, params: cleanParams(provider, params) })
        .then(normalizePage);
    },
    getListNoPage(params: any = {}) {
      return defHttp
        .get<any>({
          url: BASE_URL,
          params: cleanParams(provider, {
            ...params,
            page: 1,
            size: 500,
          }),
        })
        .then((payload) => {
          const list = normalizePage(payload).items ?? normalizePage(payload);
          return list.filter(
            (item: any) =>
              !params.item_type ||
              item.product_info?.item_type === params.item_type,
          );
        });
    },
    postSave(data: any) {
      const body = serializeSku(provider, data);
      if (data.id)
        return defHttp
          .put<any>({ url: `${BASE_URL}/${data.id}`, data: body })
          .then(normalizeSku);
      return defHttp
        .post<any>({ url: BASE_URL, data: body })
        .then(normalizeSku);
    },
    postDelete(id: any) {
      return defHttp.delete<any>({ url: `${BASE_URL}/${id}` });
    },
  };
}
