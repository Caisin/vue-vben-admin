import { defHttp } from '#/api/res/legacy-http';

type UploadFileParams = Record<string, unknown>;
type AxiosProgressEvent = unknown;

export interface FeedbackContent {
  imgs?: Array<string | { url?: string }>;
  msg?: string;
  [key: string]: unknown;
}

export interface FeedbackReplyWrite {
  content: FeedbackContent;
  email?: string;
  feed_back_type?: string;
}

export interface FeedbackThreadView {
  info: Record<string, unknown>;
  items: Record<string, unknown>[];
}

enum Api {
  Base = '/adm/feedback',
  Done = '/adm/feedback/done',
  UploadBase64Img = '/adm/feedback/upload_base64_img',
  UploadImg = '/adm/feedback/upload_img',
}

export const getList = (params: any) => {
  return defHttp.get<any>({ url: Api.Base, params });
};

export const getReplyList = (id: any) => {
  return defHttp.get<FeedbackThreadView>({ url: `${Api.Base}/${id}` });
};

export const getListNoPage = () => {
  return defHttp.get<any>({ url: Api.Base });
};

export const postSave = (data: any) => {
  const { id, ...body } = data ?? {};
  return defHttp.post<any>({ url: `${Api.Base}/${id}`, data: body });
};

export const postDone = (id: any) => {
  return defHttp.post<any>({ url: `${Api.Done}/${id}` });
};

export const uploadBase64Img = (data: {
  base64_str: string;
  file_name?: string;
}) => {
  return defHttp.post<{ url: string }>({ url: Api.UploadBase64Img, data });
};

/**
 * @description: 上传反馈图片，后端返回 `[{ url }]`。
 */
export function uploadImg(
  params: UploadFileParams,
  onUploadProgress: (progressEvent: AxiosProgressEvent) => void,
) {
  return defHttp.uploadFile<Array<{ url: string }>>(
    {
      url: Api.UploadImg,
      onUploadProgress,
    },
    params,
  );
}
