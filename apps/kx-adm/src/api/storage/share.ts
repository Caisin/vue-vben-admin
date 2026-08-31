import type { Page, PageQuery } from '#/api/request';

import { apiURL, requestClient } from '#/api/request';

import { resolveFileAccessUrl } from './file-url';

export interface FileShareView {
  created_at: number | string;
  created_by: number | string;
  expired: boolean;
  expires_at: number | string;
  file_ext: string;
  file_id: number | string;
  file_name: string;
  id: number | string;
  share_url: string;
  size: number | string;
  storage_code: string;
  updated_at: number | string;
}

export interface FileSharePageQuery extends PageQuery {
  keyword?: string;
  status?: 'active' | 'expired';
}

export interface FileShareCreateWrite {
  expires_at: number | string;
  file_id: number | string;
  file_name?: string;
}

function resolveShare(view: FileShareView): FileShareView {
  return {
    ...view,
    share_url: resolveFileAccessUrl(view.share_url, apiURL),
  };
}

export const StorageFileShareApi = {
  list: async (params?: FileSharePageQuery) => {
    const result = await requestClient.get<Page<FileShareView>>(
      '/storage/share',
      { params },
    );
    return { ...result, items: result.items.map(resolveShare) };
  },
  create: async (data: FileShareCreateWrite) =>
    resolveShare(
      await requestClient.post<FileShareView>('/storage/share', data),
    ),
  setExpiry: async (id: number | string, expiresAt: number | string) =>
    resolveShare(
      await requestClient.put<FileShareView>(
        `/storage/share/${id}/expires-at`,
        { expires_at: expiresAt },
      ),
    ),
  extend: async (id: number | string, days: number) =>
    resolveShare(
      await requestClient.post<FileShareView>(`/storage/share/${id}/extend`, {
        days,
      }),
    ),
  remove: (id: number | string) =>
    requestClient.delete<boolean>(`/storage/share/${id}`),
};
