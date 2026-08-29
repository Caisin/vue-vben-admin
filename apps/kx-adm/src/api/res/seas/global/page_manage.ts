import { defHttp } from '#/api/res/legacy-http';

enum Api {
  GetPageList = '/adm/page/page_code',
  RefreshStorage = '/adm/page/refresh',
}

/**
 * @description: Get user menu based on id
 */

export const getPageList = (params: any) => {
  return defHttp.get<any>({ url: Api.GetPageList, params });
};
export const savePage = (data: any) => {
  return defHttp.post<any>({ url: Api.GetPageList, data });
};
export const refreshPage = (page: any) => {
  return defHttp.post<any>({ url: `${Api.RefreshStorage}/${page}` });
};
