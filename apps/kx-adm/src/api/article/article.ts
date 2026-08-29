import type { Page, PageQuery } from '#/api/request';
import type {
  FileUploadView,
  UploadFile,
  UploadFilePageQuery,
} from '#/api/storage';
import type { TaskRun } from '#/api/task';

import { requestClient } from '#/api/request';
import { StorageFileApi } from '#/api/storage';

export type ArticleVisibility = 'password' | 'public';
export type ArticleState = 'draft' | 'published' | 'unpublished';
export type ArticleReleaseState = 'failed' | 'preparing' | 'published';

export interface ArticleContent {
  blocks: ArticleBlock[];
  time?: number | string;
  version: string;
}

export type ArticleBlock =
  | { data: Record<string, never>; id: string; type: 'delimiter' }
  | {
      data: { alt?: string; caption?: string; file_id: number | string };
      id: string;
      type: 'image';
    }
  | { data: { caption?: string; text: string }; id: string; type: 'quote' }
  | { data: { code: string; language?: string }; id: string; type: 'code' }
  | {
      data: { content: string[][]; with_headings?: boolean };
      id: string;
      type: 'table';
    }
  | {
      data: { description?: string; title: string; url: string };
      id: string;
      type: 'link';
    }
  | {
      data: { file_id: number | string; title: string };
      id: string;
      type: 'attachment';
    }
  | {
      data: {
        items: Array<{
          alt?: string;
          caption?: string;
          file_id: number | string;
        }>;
      };
      id: string;
      type: 'gallery';
    }
  | {
      data: { items: Array<{ checked?: boolean; text: string }> };
      id: string;
      type: 'checklist';
    }
  | {
      data: { items: ArticleListItem[]; style: 'ordered' | 'unordered' };
      id: string;
      type: 'list';
    }
  | { data: { level: number; text: string }; id: string; type: 'header' }
  | { data: { text: string }; id: string; type: 'paragraph' };

export interface ArticleListItem {
  content: string;
  items?: ArticleListItem[];
}

export interface ArticleDoc {
  author_name: string;
  cover_file_id?: number | string;
  created_at: number | string;
  created_by: number | string;
  current_release_id?: number | string;
  id: number | string;
  published_at?: number | string;
  slug?: string;
  state: ArticleState;
  summary: string;
  theme_code: string;
  title: string;
  updated_at: number | string;
  updated_by: number | string;
  visibility: ArticleVisibility;
}

export interface ArticleDetail extends ArticleDoc {
  content: ArticleContent;
  content_schema_version: number | string;
  draft_revision: number | string;
  editor_version: string;
  has_password: boolean;
}

export interface ArticleCreateWrite {
  title: string;
}

export interface ArticleUpdateWrite {
  author_name?: string;
  content: ArticleContent;
  cover_file_id?: number | string;
  editor_version?: string;
  expected_draft_revision: number | string;
  password?: string;
  summary?: string;
  theme_code: string;
  title: string;
  visibility: ArticleVisibility;
}

export interface ArticleListQuery extends PageQuery {
  created_by?: number | string;
  slug?: string;
  state?: ArticleState;
  theme_code?: string;
  title?: string;
  updated_range?: [number | string, number | string];
  visibility?: ArticleVisibility;
}

export interface ArticleThemeView {
  code: string;
  name: string;
  version: string;
}

export interface ArticlePreviewView {
  html: string;
}

export interface ArticlePublishView {
  release_id: number | string;
  task?: TaskRun;
  unchanged: boolean;
}

export interface ArticleRelease extends Omit<
  ArticleDoc,
  'current_release_id' | 'slug' | 'state' | 'updated_at' | 'updated_by'
> {
  asset_file_ids: Array<number | string>;
  content: ArticleContent;
  content_schema_version: number | string;
  failure_reason: string;
  html_file_id?: number | string;
  html_url: string;
  password_hash?: never;
  published_by?: number | string;
  release_hash: string;
  release_no?: number | string;
  renderer_version: string;
  requested_at: number | string;
  requested_by: number | string;
  slug: string;
  source_draft_revision: number | string;
  state: ArticleReleaseState;
  storage_code: string;
  theme_version: string;
}

export interface ArticleReleaseDetail {
  release: ArticleRelease;
}

export interface ArticleStorageSettingsView {
  private_storage_code?: string;
  public_storage_code?: string;
  ready: boolean;
}

export interface ArticleStorageSettingsWrite {
  private_storage_code: string;
  public_storage_code: string;
}

export interface RemoteImageWrite {
  url: string;
}

export const ArticleApi = {
  list: (params?: ArticleListQuery) =>
    requestClient.get<Page<ArticleDoc>>('/article', { params }),
  create: (data: ArticleCreateWrite) =>
    requestClient.post<ArticleDetail>('/article', data),
  themes: () => requestClient.get<ArticleThemeView[]>('/article/themes'),
  detail: (id: number | string) =>
    requestClient.get<ArticleDetail>(`/article/${id}`),
  update: (id: number | string, data: ArticleUpdateWrite) =>
    requestClient.put<ArticleDetail>(`/article/${id}`, data),
  remove: (id: number | string) =>
    requestClient.delete<boolean>(`/article/${id}`),
  assets: (id: number | string, params?: UploadFilePageQuery) =>
    requestClient.get<Page<UploadFile>>(`/article/${id}/assets`, { params }),
  uploadAsset: async (id: number | string, file: File) => {
    const result = await requestClient.upload<FileUploadView[]>(
      `/article/${id}/assets/files`,
      { file },
    );
    return Promise.all(
      result.map(async (item) => ({
        ...item,
        url: await StorageFileApi.url(item.file.file_id),
      })),
    );
  },
  transferRemoteImage: async (id: number | string, data: RemoteImageWrite) => {
    const result = await requestClient.post<FileUploadView>(
      `/article/${id}/assets/remote-images`,
      data,
    );
    return {
      ...result,
      url: await StorageFileApi.url(result.file.file_id),
    };
  },
  preview: (id: number | string, expected_draft_revision: number | string) =>
    requestClient.post<ArticlePreviewView>(`/article/${id}/preview`, {
      expected_draft_revision,
    }),
  publish: (id: number | string, expected_draft_revision: number | string) =>
    requestClient.post<ArticlePublishView>(`/article/${id}/publish-tasks`, {
      expected_draft_revision,
    }),
  unpublish: (id: number | string) =>
    requestClient.post<ArticleDetail>(`/article/${id}/unpublish`),
  releases: (
    id: number | string,
    params?: PageQuery & { state?: ArticleReleaseState },
  ) =>
    requestClient.get<Page<ArticleRelease>>(`/article/${id}/releases`, {
      params,
    }),
  release: (id: number | string, release_id: number | string) =>
    requestClient.get<ArticleReleaseDetail>(
      `/article/${id}/releases/${release_id}`,
    ),
  restore: (id: number | string, release_id: number | string) =>
    requestClient.post<ArticleDetail>(
      `/article/${id}/releases/${release_id}/restore`,
    ),
  storageSettings: () =>
    requestClient.get<ArticleStorageSettingsView>('/article/settings/storage'),
  saveStorageSettings: (data: ArticleStorageSettingsWrite) =>
    requestClient.put<ArticleStorageSettingsView>(
      '/article/settings/storage',
      data,
    ),
};
