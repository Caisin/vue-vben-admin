import { defHttp } from '#/api/res/legacy-http';

export interface PageQuery {
  [key: string]: any;
  page?: number;
  pageSize?: number;
  size?: number;
}

export interface ChannelWrite {
  [key: string]: any;
  group_cnt_limit?: number;
  id?: number | string;
  is_all_auth?: number;
  name?: string;
  remark?: string;
  state?: number;
  user_cnt_limit?: number;
}

export interface ChannelAuthWrite {
  cid?: number | string;
  cids?: Array<number | string>;
  remark?: string;
  res_id?: number | string;
  res_ids?: Array<number | string>;
}

enum Api {
  GetPageList = '/adm/channel',
}

export const getPageList = (params?: PageQuery) =>
  defHttp.get<any>({ url: Api.GetPageList, params });
export const getPageListNoPage = (params?: PageQuery) =>
  defHttp.get<any>({ url: '/adm/channel/list', params });
export const savePage = (data: ChannelWrite) =>
  defHttp.post<any>({ url: Api.GetPageList, data });
export const updatePage = (data: ChannelWrite) =>
  defHttp.put<any>({ url: Api.GetPageList, data });

export const getTeamList = (params?: PageQuery) =>
  defHttp.get<any>({ url: '/adm/channel/group', params });
export const getTeamAllList = (params?: PageQuery) =>
  defHttp.get<any>({ url: '/adm/channel/group/list', params });
export const saveTeam = (data: any) =>
  defHttp.post<any>({ url: '/adm/channel/group', data });

export const getUserList = (params?: PageQuery) =>
  defHttp.get<any>({ url: '/adm/channel/user', params });
export const saveUser = (data: any) =>
  defHttp.post<any>(
    { url: '/adm/channel/user', data },
    { errorMessageMode: 'modal' },
  );
export const updateUser = (data: any) =>
  defHttp.put<any>({ url: '/adm/channel/user', data });

export const getSourceList = (params: PageQuery & { cid: number | string }) => {
  const { cid, ...query } = params;
  return defHttp.get<any>({ url: `/adm/channel/res/${cid}`, params: query });
};
export const getChannelResourceList = (params?: PageQuery) =>
  defHttp.get<any>({ url: '/adm/channel/res/list', params });
export const authSource = (data: ChannelAuthWrite) =>
  defHttp.post<any>({ url: '/adm/channel/res', data });
export const unAuthSource = (data: ChannelAuthWrite) =>
  defHttp.delete<any>({ url: '/adm/channel/res', data });

export const getChannelUserInfo = () =>
  defHttp.get<any>(
    { url: '/adm/channel/user/info' },
    { errorMessageMode: 'none' },
  );

export const getAuthSourceIdList = (params: { cid: number | string }) =>
  defHttp.get<Array<number | string>>({
    url: '/adm/channel/res/authed_ids',
    params,
  });
export const getAuthSourceDetailList = (params: PageQuery) =>
  defHttp.get<any>({ url: '/adm/channel/res/anthed_list', params });
