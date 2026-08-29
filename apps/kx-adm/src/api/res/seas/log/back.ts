import { defHttp } from '#/api/res/legacy-http';

// 回传记录
export const getBackLogList = (params: any) => {
  return defHttp.get<any>({ url: '/adm/log/fb_back_log', params });
};
// 补回传
export const postReBack = (id: any) => {
  return defHttp.post<any>({ url: `/adm/log/fb_reback/${id}` });
};
