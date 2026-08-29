import { defHttp } from '#/api/res/legacy-http';

enum Api {
  GetList = '/adm/page/group',
  GetSourceList = '/adm/page/item',
}

/**
 * @description: Get user menu based on id
 */

export const getList = (params: any) => {
  return defHttp.get<any>({
    url: `${Api.GetList}/${params.page_code}`,
    params,
  });
};
export const getSourceList = (params: any) => {
  return defHttp.get<any>({
    url: `${Api.GetSourceList}/${params.page_code}/${params.group_code}`,
    params,
  });
};
export const postSave = (data: any) => {
  return defHttp.post<any>({ url: Api.GetList, data });
};
export const postSourceSave = (params: any, data: any) => {
  return defHttp.post<any>({
    url: `${Api.GetSourceList}/${params.page_code}/${params.group_code}`,
    data,
  });
};

export const deleteGroup = (params: {
  group_code: string;
  page_code: string;
}) => {
  return defHttp.delete<any>({
    url: `${Api.GetSourceList}/${params.page_code}/${params.group_code}`,
  });
};

export const getLangList = () => {
  return defHttp.get<any>({ url: '/adm/lang' });
};

export const translateText = (text: string, to: string) => {
  return defHttp.post<any>({ url: '/adm/trans/text', data: { text, to } });
};
