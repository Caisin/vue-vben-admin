import type { Page, PageQuery } from '#/api/request';
import type { BusinessContact } from '#/auth';

import { apiURL, requestClient } from '#/api/request';

import { resolveFileAccessUrl } from './file-url';

export interface FileShareView {
  created_at: number | string;
  created_by: number | string;
  expired: boolean;
  expires_at: number | string;
  download_start_at: number | string;
  download_started: boolean;
  download_limit: number | string;
  download_count: number | string;
  remaining_download_count?: number | string;
  view_count: number | string;
  downloadable: boolean;
  download_password?: string;
  password_required: boolean;
  show_business_contact: boolean;
  business_contact?: BusinessContact;
  file_ext: string;
  file_id: number | string;
  file_count: number | string;
  file_name: string;
  files: FileShareFileView[];
  id: number | string;
  sharer: string;
  share_url: string;
  size: number | string;
  storage_code: string;
  total_size: number | string;
  updated_at: number | string;
}

export interface FileShareFileView {
  file_ext: string;
  file_id: number | string;
  file_name: string;
  size: number | string;
  storage_code: string;
}

export interface FileShareAccessView {
  client_ip: string;
  download_count: number | string;
  first_seen_at: number | string;
  last_downloaded_at: number | string;
  last_viewed_at: number | string;
  view_count: number | string;
}

export interface FileSharePasswordView {
  download_password: string;
}

export interface FileSharePageQuery extends PageQuery {
  keyword?: string;
  status?: 'active' | 'expired';
}

export interface FileShareCreateWrite {
  download_password?: string;
  download_limit: number | string;
  download_start_at: number | string;
  expires_at: number | string;
  file_ids: Array<number | string>;
  file_name?: string;
  password_required: boolean;
  show_business_contact: boolean;
}

export interface FileShareBusinessContactWrite {
  business_contact: BusinessContact;
  show_business_contact: boolean;
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
  setDownloadPolicy: async (
    id: number | string,
    data: {
      clear_password: boolean;
      download_limit: number | string;
      download_password?: string;
      download_start_at: number | string;
      reset_password: boolean;
    },
  ) =>
    resolveShare(
      await requestClient.put<FileShareView>(
        `/storage/share/${id}/download-policy`,
        data,
      ),
    ),
  setBusinessContact: async (
    id: number | string,
    data: FileShareBusinessContactWrite,
  ) =>
    resolveShare(
      await requestClient.put<FileShareView>(
        `/storage/share/${id}/business-contact`,
        data,
      ),
    ),
  addDownloads: async (id: number | string, count: number) =>
    resolveShare(
      await requestClient.post<FileShareView>(
        `/storage/share/${id}/downloads/extend`,
        { count },
      ),
    ),
  access: (id: number | string, params?: PageQuery) =>
    requestClient.get<Page<FileShareAccessView>>(
      `/storage/share/${id}/access`,
      { params },
    ),
  revealPassword: (id: number | string) =>
    requestClient.get<FileSharePasswordView>(`/storage/share/${id}/password`),
  downloadFile: (id: number | string, fileId: number | string) =>
    requestClient.download<Blob>(
      `/storage/share/${id}/files/${fileId}/content`,
    ),
  remove: (id: number | string) =>
    requestClient.delete<boolean>(`/storage/share/${id}`),
};
