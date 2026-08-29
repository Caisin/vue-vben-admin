import { defHttp } from '#/api/res/legacy-http';

enum Api {
  GetPageList = '/adm/stat/get_user_income',
}

/**
 * @description: Get user menu based on id
 */

export const getList = (params: any) => {
  return defHttp.get<any>({ url: Api.GetPageList, params });
};
