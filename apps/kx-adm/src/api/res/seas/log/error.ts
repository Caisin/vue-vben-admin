import { defHttp } from '#/api/res/legacy-http';

// Firebase Token记录
export const getErrorLogList = (params: any) => {
  return defHttp.get<any>({ url: '/adm/log/err_log', params });
};
