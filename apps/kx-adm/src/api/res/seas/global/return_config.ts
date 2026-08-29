import { defHttp } from '#/api/res/legacy-http';

enum Api {
  GetPageList = '/adm/post_tmp',
  RefreshStorage = '/adm/page/refresh',
}

/**
 * @description: Get user menu based on id
 */

export const getPageList = (params: any) => {
  return defHttp.get<any>({ url: Api.GetPageList, params });
};
export const getBackList = (params: any) => {
  return new Promise((resolve, reject) => {
    defHttp
      .get<any>({ url: '/adm/post_tmp/list', params })
      .then((res) => {
        res.forEach((item: any) => {
          if (item.money_map) {
            Reflect.deleteProperty(item, 'money_map');
          }
        });
        resolve(res);
      })
      .catch((error) => {
        reject(error);
      });
  });
};
export const savePage = (data: any) => {
  return defHttp.post<any>({ url: Api.GetPageList, data });
};
export const refreshPage = (page: any) => {
  return defHttp.post<any>({ url: `${Api.RefreshStorage}/${page}` });
};
