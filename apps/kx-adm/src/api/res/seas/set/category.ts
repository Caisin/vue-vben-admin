import { defHttp } from '#/api/res/legacy-http';

enum Api {
  GetCateSourceList = '/adm/category/res_list',
  GetList = '/adm/category',
  PostSetCate = '/adm/res/set_category',
  PostSetCateSource = '/adm/category/set_res',
  RefreshAllSourceCate = '/adm/res/update_all_tags',
  RefreshSourceCate = '/adm/res/res_category',
  // PostSetSourceCate = '/adm/res/set_category',
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
// export const postSetCate = (res_id: any, data) => {
//   return defHttp.post<any>({ url: `${Api.PostSetCate}/${res_id}` }, data);
// };
export const postDelete = (id: any) => {
  return defHttp.delete<any>({ url: `${Api.GetList}/${id}` });
};
export const postSourceSetCate = (cat_id: any, data: any) => {
  return defHttp.post<any>({ url: `${Api.PostSetCateSource}/${cat_id}`, data });
};
export const getCateSourceList = (cat_id: any) => {
  return defHttp.get<any>({ url: `${Api.GetCateSourceList}/${cat_id}` });
};
export const refreshSourceCateList = (cat_id: any) => {
  return defHttp.put<any>({ url: `${Api.RefreshSourceCate}/${cat_id}` });
};
export const refreshAllCateList = () => {
  return defHttp.put<any>({ url: `${Api.RefreshAllSourceCate}` });
};

export const postSetSourceCate = (res_id: any, data: any) => {
  let body = data;
  if (body && Array.isArray(body) && body.length === 0) {
    body = JSON.stringify(body);
  }

  return defHttp.post<any>({ url: `${Api.PostSetCate}/${res_id}`, data: body });
};
