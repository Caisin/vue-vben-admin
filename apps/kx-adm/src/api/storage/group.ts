import type { UploadFile } from './file';

import { requestClient } from '#/api/request';

export interface FileGroup {
  create_time: number | string;
  group_code: string;
  group_name: string;
  id: number | string;
  order_no: number | string;
}

export interface FileGroupWrite {
  group_code: string;
  group_name: string;
  order_no?: number | string;
}

export interface ReplaceGroupFiles {
  file_ids: Array<number | string>;
}

export const StorageGroupApi = {
  list: () => requestClient.get<FileGroup[]>('/storage/group'),
  create: (data: FileGroupWrite) =>
    requestClient.post<FileGroup>('/storage/group', data),
  update: (id: number | string, data: FileGroupWrite) =>
    requestClient.put<FileGroup>(`/storage/group/${id}`, data),
  files: (id: number | string) =>
    requestClient.get<UploadFile[]>(`/storage/group/${id}/files`),
  replaceFiles: (id: number | string, data: ReplaceGroupFiles) =>
    requestClient.put<null>(`/storage/group/${id}/files`, data),
  appendFiles: (id: number | string, data: ReplaceGroupFiles) =>
    requestClient.post<null>(`/storage/group/${id}/files`, data),
  remove: (id: number | string) =>
    requestClient.delete<boolean>(`/storage/group/${id}`),
};
