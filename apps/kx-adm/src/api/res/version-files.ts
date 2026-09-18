import type { Id } from './versions';

import type { Page } from '#/api/request';
import type {
  FileUploadView,
  PresignedUploadPrepareView,
  StorageOptionView,
  UploadFile,
} from '#/api/storage';
import type { FilePickerAdapter } from '#/components/file-picker/types';

import { plaintextRequestClient, requestClient } from '#/api/request';
import { resolveFileUploadViewUrl, StorageFileApi } from '#/api/storage';

export const dramaStorage = () =>
  requestClient.get<StorageOptionView>('/adm/res/drama-storage');

/** 每个适配器固定资源与版本，异步上传结束时也不能落入新选择的版本。 */
export function versionVideoAdapter(
  resId: Id,
  versionId: Id,
): FilePickerAdapter {
  const base = `/adm/res/${resId}/versions/${versionId}/files`;
  const endpoint = (code?: string) => {
    if (!code) throw new Error('请选择视频存储');
    return `${base}/${encodeURIComponent(code)}`;
  };
  return {
    list: (params) => requestClient.get<Page<UploadFile>>(base, { params }),
    detail: StorageFileApi.detail,
    urls: StorageFileApi.urls,
    storageOptions: async () => {
      const s = await dramaStorage();
      return [
        { label: s.storage_name, storage_type: s.storage_type, value: s.code },
      ];
    },
    upload: async (file, code) => {
      const result = await plaintextRequestClient.upload<FileUploadView[]>(
        `${endpoint(code)}/upload`,
        { file },
      );
      return Promise.all(result.map((file) => resolveFileUploadViewUrl(file)));
    },
    presignUpload: async (data, code) => {
      const result = await requestClient.post<PresignedUploadPrepareView>(
        `${endpoint(code)}/prepare`,
        data,
      );
      return {
        ...result,
        file: result.file
          ? await resolveFileUploadViewUrl(result.file)
          : undefined,
      };
    },
    presignComplete: async (data, code) =>
      resolveFileUploadViewUrl(
        await requestClient.post<FileUploadView>(
          `${endpoint(code)}/complete`,
          data,
        ),
      ),
  };
}
