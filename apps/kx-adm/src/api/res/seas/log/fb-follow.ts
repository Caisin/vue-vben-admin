import { defHttp } from '#/api/res/legacy-http';

// FB关注日志
export const getFBFollowLogList = (params: any) => {
  return defHttp.get<any>({ url: '/adm/facebook/sub/sub_log_page', params });
};
