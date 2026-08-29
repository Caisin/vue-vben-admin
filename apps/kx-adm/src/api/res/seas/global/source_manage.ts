import { defHttp } from '#/api/res/legacy-http';
import { getRandomHexColor } from '#/api/res/utils';

type AxiosProgressEvent = unknown;

export interface ResPageQuery {
  [key: string]: any;
  page?: number;
  pageSize?: number;
  size?: number;
}

export interface ResRecord {
  [key: string]: any;
  ad_cfg?: Record<string, any>;
  cover?: string;
  ext_info?: Record<string, any>;
  heat_num?: number;
  id: number | string;
  intro?: string;
  lang?: string;
  lang_info?: Record<string, any>;
  remark?: string;
  res_name?: string;
  res_type?: number | string;
  seq_num?: number;
  state?: number;
  title?: string;
}

export interface ResChapter {
  [key: string]: any;
  id: number | string;
  lang?: string;
  play_url?: string;
  price?: number;
  res_id?: number | string;
  seq_no?: number;
  title?: string;
  url?: string;
}

export interface PriceRange {
  end?: number;
  price?: number;
  start?: number;
}

export interface PriceWrite {
  [key: string]: any;
  buy_type?: number;
  lang?: string | string[];
  res_id: number | string;
  seq_range?: PriceRange[];
  whole_price?: number;
}

enum Api {
  GetChapterList = '/adm/res_item',
  GetDefaultPrice = '/adm/res/def_price',
  GetDetail = '/adm/res/info',
  GetLangPrice = '/adm/res/lang_price',
  GetList = '/adm/res',
  GetListAll = '/adm/res/list',
  SetChapterLangPrice = '/adm/res/set_chapter_lang_price',
  SetLangPrice = '/adm/res/set_price_lang',
  SetPrice = '/adm/res/set_price',
}

function withTagColors<T extends ResRecord>(item: T): T {
  if (!item.ext_info?.tags || !Array.isArray(item.ext_info.tags)) return item;
  item.ext_info.tags = item.ext_info.tags.map((tag: any) => ({
    ...tag,
    color: tag.color || getRandomHexColor(),
  }));
  return item;
}

export const getList = async (params: ResPageQuery) => {
  const res = await defHttp.get<any>({ url: Api.GetList, params });
  if (Array.isArray(res?.items)) {
    res.items = res.items.map((item: ResRecord) => withTagColors(item));
  }
  return res;
};
export const getListAll = (params?: ResPageQuery) =>
  defHttp.get<ResRecord[]>({ url: Api.GetListAll, params });
export const getChapterList = (res_id: any, lang: string) =>
  defHttp.get<ResChapter[]>({ url: `${Api.GetChapterList}/${lang}/${res_id}` });
export const getChapterListNoLang = async (params: any) => {
  const res = await defHttp.get<ResChapter[]>({
    url: `${Api.GetChapterList}/${params.res_id}`,
  });
  return res.map((item) => ({
    id: item.id,
    price: item.price,
    seq_no: item.seq_no,
  }));
};
export const getChapterListNoLangNoPage = (params: any) =>
  defHttp.get<ResChapter[]>({ url: `${Api.GetChapterList}/${params.res_id}` });
export const getChapterListPage = (params: any) =>
  defHttp.get<any>({ url: `${Api.GetChapterList}`, params });
export const postSave = (data: any) =>
  defHttp.post<ResRecord>({ url: Api.GetList, data });
export const postPrice = (data: PriceWrite) =>
  defHttp.post<any>({ url: Api.SetPrice, data });
export const postLangPrice = (data: PriceWrite) => {
  const body = { ...data };
  if (
    body.lang &&
    Array.isArray(body.lang) &&
    (body.lang[0] === null || body.lang[0] === undefined)
  )
    body.lang = [];
  return defHttp.post<any>({ url: Api.SetLangPrice, data: body });
};
export const postChapterLangPrice = (data: PriceWrite) =>
  defHttp.post<any>({ url: Api.SetChapterLangPrice, data });
export const getLangPrice = (res_id: any, lang: string) =>
  defHttp.get<PriceWrite>({ url: `${Api.GetLangPrice}/${lang}/${res_id}` });
export const getDetail = async (id: any) =>
  withTagColors(
    await defHttp.get<ResRecord>({ url: `${Api.GetDetail}/${id}` }),
  );
export const getDefaultPrice = (res_id: any) =>
  defHttp.get<PriceWrite>({ url: `${Api.GetDefaultPrice}/${res_id}` });

export const parse_file = (
  params: any,
  onUploadProgress: (progressEvent: AxiosProgressEvent) => void,
) =>
  defHttp.uploadFile<any>(
    { url: `/adm/res/parse_file`, onUploadProgress },
    params,
  );

export const postSaveNoval = (data: any) =>
  defHttp.post<any>({ url: '/adm/res/create_novel', data });
export const postChangeState = (res_id: any, state: any) =>
  defHttp.post<any>({ url: `/adm/res/chg_state/${res_id}`, data: { state } });
export const postAdConfig = (data: any) =>
  defHttp.post<any>({ url: '/adm/res/set_ad_cfg', data });
export const getCoinConfig = (params: any) =>
  defHttp.get<any>({ url: `/adm/res_price/${params.id}`, params });
export const postCoinConfig = (data: any) =>
  defHttp.post<any>({ url: `/adm/res_price`, data });
export const getCoinHistory = (params: any) =>
  defHttp.get<any>({ url: `/adm/res_price`, params });
export const getCoinOrderList = (params: any) => {
  const { id, ...query } = params ?? {};
  return defHttp.get<any>({
    url: `/adm/res_price/orders/${id}`,
    params: query,
  });
};
export const postUpdateConfig = (data: any) =>
  defHttp.post<any>({ url: `/adm/res/update_res_info/${data.lang}`, data });
export const postUpdateConfigNoLang = (data: any) =>
  defHttp.post<any>({ url: `/adm/res/update_res_info`, data });
export const postAddMarkTag = (data: any) =>
  defHttp.post<any>({ url: `/adm/tag`, data });
export const getMarkTagList = (params?: any) =>
  defHttp.get<any>({ url: `/adm/tag`, params });
export const postResHeat = (data: any) =>
  defHttp.post<any>({ url: `/adm/res/save_res_heat`, data });
export const postSearchReindex = () =>
  defHttp.post<{ indexed: number }>({ url: '/adm/res/search/reindex' });

export const downloadNovel = (id: any) =>
  defHttp.get<any>({ url: `/adm/res/download_novel/${id}` });
export const downloadLangNovel = (id: any, lang: string) =>
  defHttp.post<any>({ url: `/adm/res/download_lang_novel/${lang}/${id}` });
