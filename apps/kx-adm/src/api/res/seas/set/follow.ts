import { defHttp } from '#/api/res/legacy-http';

/**
 * @description: Get user menu based on id
 */

export const getList = (params: any) => {
  return defHttp.get<any>({ url: '/adm/facebook/sub/acct_page', params });
};
export const getListAll = (params: any) => {
  return defHttp.get<any>({ url: '/adm/facebook/sub/acct_list', params });
};
export const postSave = (data: any) => {
  return defHttp.post<any>({ url: '/adm/facebook/sub/acct_save', data });
};
