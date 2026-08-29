import { defHttp } from '#/api/res/legacy-http';

enum Api {
  GetPageList = '/adm/app_push',
  RefreshStorage = '/adm/page/refresh',
}

/**
 * @description: Get user menu based on id
 */

export const getPageList = (params: any) => {
  return defHttp.get<any>({ url: Api.GetPageList, params });
};
export const getLogList = (params: any) => {
  return defHttp.get<any>({ url: '/adm/app_push/push_log', params });
};
export const savePage = (data: any) => {
  return defHttp.post<any>({ url: Api.GetPageList, data });
};
export const refreshPage = (page: any) => {
  return defHttp.post<any>({ url: `${Api.RefreshStorage}/${page}` });
};

export const testPush = (data: any) => {
  return defHttp.post<any>({
    url: `/adm/app_push/send_test/${data.id}/${data.uid}`,
  });
};

export const sendPush = (id: number | string) => {
  return defHttp.post<any>({ url: `/adm/app_push/send/${id}` });
};
