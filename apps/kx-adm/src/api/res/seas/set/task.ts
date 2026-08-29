import { defHttp } from '#/api/res/legacy-http';

enum Api {
  GetPageList = '/adm/task_cfg/list',
  GetSignList = '/adm/sign_cfg/list',
}

/**
 * @description: Get user menu based on id
 */

export const getList = (params: any) => {
  return defHttp.get<any>({ url: Api.GetPageList, params });
};
export const postSave = (data: any) => {
  return defHttp.post<any>({ url: Api.GetPageList, data });
};

export const getSignList = () => {
  return defHttp.get<any>({ url: Api.GetSignList });
};

export const postSign = (data: any) => {
  return defHttp.post<any>({ url: Api.GetSignList, data });
};
