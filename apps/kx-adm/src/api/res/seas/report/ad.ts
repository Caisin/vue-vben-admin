import { defHttp } from '#/api/res/legacy-http';

enum Api {
  GetPageList = '/admin/ad_stats/ad_platform',
}

/**
 * @description: Get user menu based on id
 */

export const getList = (params: any) => {
  return defHttp.get<any>({ url: Api.GetPageList, params });
};
export const getTotal = (params: any) => {
  return defHttp.get<any>({ url: '/admin/ad_stats/ad_platform_total', params });
};
export const getLinkList = (params: any) => {
  return defHttp.get<any>({ url: '/admin/ad_stats/link', params });
};
export const getLinkTotal = (params: any) => {
  return defHttp.get<any>({ url: '/admin/ad_stats/link_total', params });
};
export const getPositionList = (params: any) => {
  return defHttp.get<any>({ url: '/admin/ad_stats/position', params });
};
export const getPositionTotal = (params: any) => {
  return defHttp.get<any>({ url: '/admin/ad_stats/position_total', params });
};
export const getDistrictList = (params: any) => {
  return defHttp.get<any>({ url: '/admin/ad_stats/area', params });
};
export const getDistrictTotal = (params: any) => {
  return defHttp.get<any>({ url: '/admin/ad_stats/link_total', params });
};

export const getPlanList = (params: any) => {
  return defHttp.get<any>({ url: '/admin/ad_stats/link_ad', params });
};
export const getPlanTotal = (params: any) => {
  return defHttp.get<any>({ url: '/admin/ad_stats/link_ad_total', params });
};
export const getUserList = (params: any) => {
  return defHttp.get<any>({ url: '/admin/ad_stats/user', params });
};
export const getUserTotal = (params: any) => {
  return defHttp.get<any>({ url: '/admin/ad_stats/user_total', params });
};
