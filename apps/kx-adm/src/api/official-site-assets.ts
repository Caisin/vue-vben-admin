import type { Page } from '#/api/request';
import type {
  FileAccessView,
  FileUploadView,
  PresignedUploadCompleteWrite,
  PresignedUploadPrepareView,
  PresignedUploadPrepareWrite,
  RenameFileWrite,
  StorageOptionView,
  UploadFile,
  UploadFilePageQuery,
} from '#/api/storage';

import { plaintextRequestClient, requestClient } from '#/api/request';
import { resolveFileAccessView, resolveFileUploadViewUrl } from '#/api/storage';
const root = '/official-sites/assets';
function storagePath(code?: string) {
  if (!code) throw new Error('请先选择公共存储');
  return encodeURIComponent(code);
}
export const OfficialSiteAssetsApi = {
  storages: () => requestClient.get<StorageOptionView[]>(`${root}/storages`),
  list: (params?: UploadFilePageQuery) =>
    requestClient.get<Page<UploadFile>>(`${root}/files`, { params }),
  detail: (id: number | string) =>
    requestClient.get<UploadFile>(`${root}/files/${id}`),
  rename: (id: number | string, data: RenameFileWrite) =>
    requestClient.put<UploadFile>(`${root}/files/${id}/name`, data),
  urls: async (ids: Array<number | string>) => {
    const files = await requestClient.post<FileAccessView[]>(
      `${root}/files/urls`,
      ids,
    );
    return Promise.all(files.map((file) => resolveFileAccessView(file)));
  },
  upload: async (file: File, code?: string) => {
    const files = await plaintextRequestClient.upload<FileUploadView[]>(
      `${root}/upload/${storagePath(code)}`,
      { file },
    );
    return Promise.all(files.map((file) => resolveFileUploadViewUrl(file)));
  },
  presignUpload: async (data: PresignedUploadPrepareWrite, code?: string) => {
    const result = await requestClient.post<PresignedUploadPrepareView>(
      `${root}/presign-upload/${storagePath(code)}`,
      data,
    );
    return {
      ...result,
      file: result.file
        ? await resolveFileUploadViewUrl(result.file)
        : undefined,
    };
  },
  presignComplete: async (data: PresignedUploadCompleteWrite, code?: string) =>
    resolveFileUploadViewUrl(
      await requestClient.post<FileUploadView>(
        `${root}/presign-complete/${storagePath(code)}`,
        data,
      ),
    ),
};
