import { defHttp } from '#/api/res/legacy-http';

enum Api {
  GetPageList = '/adm/stat/day_pay',
  GetTotal = '/adm/stat/day_pay_total',
  PostCost = '/adm/stat/set_stat_cost',
}

/**
 * @description: Get user menu based on id
 */

export const getList = (params: any) => {
  return defHttp.get<any>({ url: Api.GetPageList, params });
};
export const postCost = (params: any) => {
  return defHttp.post<any>({ url: Api.PostCost, data: params });
};
export const getTotal = (params: any) => {
  return defHttp.get<any>({ url: Api.GetTotal, params });
};
