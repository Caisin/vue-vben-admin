import { defHttp } from '#/api/res/legacy-http';

enum Api {
  GetEventPage = '/adm/facebook/event/log_page',
  GetPageList = '/adm/facebook/pixel_cfg/page',
  PostSave = '/adm/facebook/pixel_cfg',
}

/**
 * @description: Get user menu based on id
 */

export const getList = (params: any) => {
  return defHttp.get<any>({ url: Api.GetPageList, params });
};
export const getListNoPage = () => {
  return defHttp.get<any>({ url: Api.PostSave });
};
export const postSave = (data: any) => {
  return defHttp.post<any>({ url: Api.PostSave, data });
};
export const getEventList = (params: any) => {
  // params = JSON.parse(JSON.stringify(params ?? {}));
  // // 时间查询参数处理
  // if (params.event_time && params.event_time.bt && params.event_time.bt.length == 2) {
  //   params.event_time.bt[0] = params.event_time.bt[0] + ' 00:00:00';
  //   params.event_time.bt[1] = params.event_time.bt[1] + ' 23:59:59';
  // }
  // if (params && params.event_time && params.event_time.bt) {
  //   params.event_time.bt = params.event_time.bt.map((item) => getTimestamp(item));
  // }
  return defHttp.get<any>({ url: Api.GetEventPage, params });
};
