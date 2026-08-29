import { requestClient } from '#/api/request';

type LegacyRequest = {
  data?: unknown;
  onUploadProgress?: (event: unknown) => void;
  params?: Record<string, unknown>;
  url: string;
};

type LegacyOptions = Record<string, unknown>;

function cloneParams(params: LegacyRequest['params']) {
  return params ? { ...params } : undefined;
}

export const defHttp = {
  delete: <T = unknown>(
    { data, params, url }: LegacyRequest,
    _options?: LegacyOptions,
  ) =>
    requestClient.delete<T>(url, {
      data,
      params: cloneParams(params),
    } as never),
  get: <T = unknown>(
    { params, url }: LegacyRequest,
    _options?: LegacyOptions,
  ) => requestClient.get<T>(url, { params: cloneParams(params) }),
  post: <T = unknown>(
    { data, params, url }: LegacyRequest,
    _options?: LegacyOptions,
  ) => requestClient.post<T>(url, data, { params: cloneParams(params) }),
  put: <T = unknown>(
    { data, params, url }: LegacyRequest,
    _options?: LegacyOptions,
  ) => requestClient.put<T>(url, data, { params: cloneParams(params) }),
  uploadFile: <T = unknown>(
    request: LegacyRequest,
    payload: Record<string, unknown>,
  ) =>
    requestClient.upload<T>(request.url, payload as never, {
      onUploadProgress: request.onUploadProgress as never,
    }),
};
