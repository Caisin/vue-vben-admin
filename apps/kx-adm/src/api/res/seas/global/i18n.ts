import { defHttp } from '#/api/res/legacy-http';

enum Api {
  GetList = '/adm/i18n',
}

/**
 * @description: Get user menu based on id
 */

export const getList = (params: any) => {
  return defHttp.get<any>({ url: Api.GetList, params });
};
export const postSave = (data: any) => {
  return defHttp.post<any>({ url: Api.GetList, data });
};
export const getDetail = (code: string) => {
  return defHttp.get<any>({ url: `/adm/i18n/${code}` });
};
