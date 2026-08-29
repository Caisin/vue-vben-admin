import { defHttp } from '#/api/res/legacy-http';

enum Api {
  GetPageList = '/adm/stat/day_pay',
  GetTotal = '/adm/stat/day_pay_total',
}

/**
 * @description: Get user menu based on id
 */

export const getList = (params: any) => {
  return defHttp.get<any>({
    url: Api.GetPageList,
    params: { ...params, pay_day: params?.pay_day ?? params?.stat_day },
  });
};

export const getTotal = (params: any) => {
  return defHttp.get<any>({
    url: Api.GetTotal,
    params: { ...params, pay_day: params?.pay_day ?? params?.stat_day },
  });
};

export const getDay = (params: any) => {
  return getList({ ...params, pay_day: params?.date });
};
