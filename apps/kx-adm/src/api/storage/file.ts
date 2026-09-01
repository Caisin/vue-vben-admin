import type { Page, PageQuery } from '#/api/request';

import { apiURL, plaintextRequestClient, requestClient } from '#/api/request';

import { resolveFileAccessUrl as resolveAccessUrl } from './file-url';

export interface UploadFile {
  created_at: number | string;
  file_ext: string;
  file_id: number | string;
  file_name: string;
  key: string;
  md5_hash: string;
  size: number | string;
  storage_code: string;
  storage_type: string;
}

export type UploadFileKind = 'file' | 'image' | 'video';

export interface UploadFilePageQuery extends PageQuery {
  file_kind?: UploadFileKind;
  md5_hash?: string;
  name_prefix?: string;
  size_range?: [number | string, number | string];
  storage_code?: string;
  storage_type?: string;
}

export interface FileAccessView {
  file_id: number | string;
  name: string;
  url: string;
}

export interface FileUploadView {
  file: UploadFile;
  url: string;
}

export interface PresignedUploadPrepareWrite {
  file_ext: string;
  file_name: string;
  group_id?: number | string;
  md5_hash: string;
  size: number | string;
}

export interface PresignedUploadPrepareView {
  expires_in: number | string;
  file?: FileUploadView;
  headers: Record<string, string>;
  key: string;
  method: string;
  upload_required: boolean;
  upload_url: string;
}

export interface PresignedUploadCompleteWrite {
  etag?: string;
  file_ext: string;
  file_name: string;
  group_id?: number | string;
  key: string;
  md5_hash: string;
  size: number | string;
}

export interface RenameFileWrite {
  file_name: string;
}

export function resolveFileAccessUrl(url: string, baseURL = apiURL) {
  return resolveAccessUrl(url, baseURL);
}

export function resolveFileUploadView(view: FileUploadView): FileUploadView {
  return { ...view, url: resolveAccessUrl(view.url, apiURL) };
}

function requiresAuthenticatedDownload(url: string) {
  return !/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(url.trim());
}

async function authenticatedFileUrl(fileId: number | string, url: string) {
  if (!requiresAuthenticatedDownload(url)) return url;
  const blob = await plaintextRequestClient.download<Blob>(
    `/storage/file/content/${fileId}`,
  );
  return URL.createObjectURL(blob);
}

export async function resolveFileUploadViewUrl(
  view: FileUploadView,
): Promise<FileUploadView> {
  return {
    ...resolveFileUploadView(view),
    url: await authenticatedFileUrl(view.file.file_id, view.url),
  };
}

export async function resolveFileAccessView(
  view: FileAccessView,
): Promise<FileAccessView> {
  return {
    ...view,
    url: await authenticatedFileUrl(view.file_id, view.url),
  };
}

export const StorageFileApi = {
  list: (params?: UploadFilePageQuery) =>
    requestClient.get<Page<UploadFile>>('/storage/file', { params }),
  detail: (id: number | string) =>
    requestClient.get<UploadFile>(`/storage/file/${id}`),
  rename: (id: number | string, data: RenameFileWrite) =>
    requestClient.put<UploadFile>(`/storage/file/${id}/name`, data),
  upload: async (code: string, file: File) => {
    const result = await plaintextRequestClient.upload<FileUploadView[]>(
      `/storage/file/upload/${code}`,
      { file },
    );
    return Promise.all(result.map((item) => resolveFileUploadViewUrl(item)));
  },
  convertRemote: async (code: string, url: string) =>
    resolveFileUploadViewUrl(
      await requestClient.post<FileUploadView>(`/storage/file/cvt/${code}`, {
        url,
      }),
    ),
  presignUpload: async (code: string, data: PresignedUploadPrepareWrite) => {
    const result = await requestClient.post<PresignedUploadPrepareView>(
      `/storage/file/presign-upload/${code}`,
      data,
    );
    return {
      ...result,
      file: result.file
        ? await resolveFileUploadViewUrl(result.file)
        : undefined,
    };
  },
  presignComplete: async (code: string, data: PresignedUploadCompleteWrite) =>
    resolveFileUploadViewUrl(
      await requestClient.post<FileUploadView>(
        `/storage/file/presign-complete/${code}`,
        data,
      ),
    ),
  url: async (id: number | string) => {
    const url = await requestClient.get<string>(`/storage/file/url/${id}`);
    return authenticatedFileUrl(id, url);
  },
  urls: async (ids: Array<number | string>) => {
    const result = await requestClient.post<FileAccessView[]>(
      '/storage/file/urls',
      ids,
    );
    return Promise.all(result.map((item) => resolveFileAccessView(item)));
  },
  download: (id: number | string) =>
    requestClient.download<Blob>(`/storage/file/content/${id}`),
  remove: (id: number | string) =>
    requestClient.delete<boolean>(`/storage/file/${id}`),
};
