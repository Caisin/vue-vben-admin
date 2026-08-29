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

export const postCost = (params: any) => {
  return defHttp.post<any>({
    url: Api.PostCost,
    data: {
      stat_cost: params?.stat_cost,
      stat_day: params?.stat_day ?? params?.in_link_day,
    },
  });
};

// 广告计划系列列表
export const getAdCampaignList = (params: any) => {
  return defHttp.get<any>({ url: `/admin/ad/ad_campaign_list`, params });
};
// 广告计划组列表
export const getAdAdsetList = (params: any) => {
  return defHttp.get<any>({ url: `/admin/ad/ad_adset_list`, params });
};
// 广告计划id列表
export const getAdList = (params: any) => {
  return defHttp.get<any>({ url: `/admin/ad/ad_list`, params });
};
