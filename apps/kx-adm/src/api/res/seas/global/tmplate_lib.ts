import { defHttp } from '#/api/res/legacy-http';

enum Api {
  GetList = '/adm/pay_cfg/tmp',
  GetListNoPage = '/adm/pay_cfg/tmp_list',
  GetMoneyItem = '/adm/asset_cfg/asset_item',
  GetMoneyType = '/adm/asset_cfg/asset_type',
  PostSaveVip = '/adm/pay_cfg/vip_tmp',
}

/**
 * @description: Get user menu based on id
 */

export const getList = (params: any) => {
  return defHttp.get<any>({ url: Api.GetList, params });
};
export const getListNoPage = (params: any) => {
  return defHttp.get<any>({ url: Api.GetListNoPage, params });
};
export const getTmpDetail = (params: any) => {
  const { id, ...query } = params ?? {};
  return defHttp.get<any>({ url: `${Api.GetList}/${id}`, params: query });
};
export const postSave = (data: any) => {
  return defHttp.post<any>({ url: Api.GetList, data });
};
// export const refreshPage = (page: any) => {
//   return defHttp.post<any>({ url: Api.RefreshStorage + '/' + page });
// };
// 资金类型
export const getMoneyTypeList = (params: any) => {
  return defHttp.get<any>({ url: Api.GetMoneyType, params });
};
// 资金科目
export const getMoneyItemList = (params: any) => {
  return defHttp.get<any>({
    url: `${Api.GetMoneyItem}/${params.type}`,
    params,
  });
};

// 模板项保存
export const postSaveItem = (id: any, data: any) => {
  let body = data;
  if (!body || body.length === 0) {
    body = JSON.stringify([]);
  }
  return defHttp.post<any>({ url: `${Api.GetList}/${id}`, data: body });
};
// vip模板项保存
export const postSaveVipItem = (id: any, data: any) => {
  let body = data;
  if (!body || body.length === 0) {
    body = JSON.stringify([]);
  }
  return defHttp.post<any>({ url: `${Api.PostSaveVip}/${id}`, data: body });
};

export const getDefaultTemplates = () => {
  return defHttp.get<any>({ url: '/asset/pay/templates/defaults' });
};

export const saveDefaultTemplate = (
  platform: 'app' | 'web',
  template_id: any,
) => {
  return defHttp.put<any>({
    url: `/asset/pay/templates/defaults/${platform}`,
    data: { template_id: Number(template_id) },
  });
};
