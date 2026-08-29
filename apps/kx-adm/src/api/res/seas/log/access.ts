import { defHttp } from '#/api/res/legacy-http';

// 访问记录
export const getAccessLogList = (params: any) => {
  return defHttp.get<any>({ url: '/adm/log/visit_log', params });
};
