import { defHttp } from '#/api/res/legacy-http';

// Firebase Token记录
export const getW2aLogList = (params: any) => {
  return defHttp.get<any>({ url: '/adm/log/w2a_log', params });
};
