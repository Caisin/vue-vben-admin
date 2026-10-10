import type { DownloadUserOption } from './downloads';
import type { Id, ItemWrite, ResourceVersion, VersionDetail } from './versions';

import type { FileUploadView } from '#/api/storage';

import { plaintextRequestClient, requestClient } from '#/api/request';
export type ReviewState = 'draft' | 'final' | 'published' | 'reviewing';
export type NoteState = 'open' | 'processing' | 'resolved';
export interface ReviewMember {
  res_id: Id;
  uid: Id;
  role: string;
}
export interface ReviewNote {
  id: Id;
  seq_no: number;
  uid: Id;
  kind: 'comment' | 'suggestion';
  body: string;
  position_ms: number;
  media_link: string;
  state: NoteState;
  resolution: string;
  resolved_by: Id;
  revision: number;
  created_at: number;
  history: { uid: Id; state: NoteState; resolution: string; at: number }[];
}
export interface ReviewView {
  detail: VersionDetail;
  members: ReviewMember[];
  notes: ReviewNote[];
  users: Record<string, string>;
  can_edit: boolean;
  can_manage: boolean;
}
export type ReviewMembersView = Pick<
  ReviewView,
  'can_manage' | 'members' | 'users'
>;
export interface ReviewResource {
  id: Id;
  res_name: string;
  resource_code: string;
}
const root = '/adm/res/review';
const base = (res: Id, version: Id) => `${root}/${res}/${version}`;
export interface ReviewImport {
  id: Id;
  entries: { seq_no: number; title: string; file_id: Id; file_name: string }[];
  results: {
    seq_no: number;
    file_name: string;
    state: string;
    message: string;
  }[];
  dispatch_error: string;
  task_run?: null | { status: string; message: string; error_message?: string };
}
export const reviewApi = {
  submitImport: (res: Id, version: Id, entries: ReviewImport['entries']) =>
    requestClient.post<ReviewImport>(`${base(res, version)}/imports`, {
      entries,
    }),
  latestImport: (res: Id, version: Id) =>
    requestClient.get<null | ReviewImport>(
      `${base(res, version)}/imports/latest`,
    ),
  resources: (keyword: string, page = 1, size = 20) =>
    requestClient.get<{ items: ReviewResource[]; total: number }>(
      `${root}/resources`,
      { params: { keyword, page, size } },
    ),
  resource: (res: Id) =>
    requestClient.get<ReviewResource>(`${root}/resources/${res}`),
  users: (keyword: string, page = 1) =>
    requestClient.get<{ items: DownloadUserOption[]; total: number }>(
      `${root}/users`,
      { params: { keyword, page, size: 50 } },
    ),
  versions: (res: Id) =>
    requestClient.get<ResourceVersion[]>(`${root}/${res}/versions`),
  create: (res: Id, name: string) =>
    requestClient.post<ResourceVersion>(`${root}/${res}/versions`, {
      name,
      remark: '',
      lang: '',
    }),
  detail: (res: Id, version: Id) =>
    requestClient.get<ReviewView>(base(res, version)),
  members: (res: Id) =>
    requestClient.get<ReviewMembersView>(`${root}/${res}/members`),
  member: (res: Id, uid: Id, role: string) =>
    requestClient.put(`${root}/${res}/members`, { uid, role }),
  state: (
    res: Id,
    version: Id,
    expected_revision: number,
    state: ReviewState,
    planned_episodes: number,
  ) =>
    requestClient.put(`${base(res, version)}/state`, {
      expected_revision,
      state,
      planned_episodes,
    }),
  copy: (res: Id, version: Id, expected_revision: number, name: string) =>
    requestClient.post<ResourceVersion>(`${base(res, version)}/copy`, {
      expected_revision,
      name,
    }),
  addNote: (
    res: Id,
    version: Id,
    data: {
      expected_revision: number;
      seq_no: number;
      kind: string;
      body: string;
      position_ms: number;
    },
  ) => requestClient.post(`${base(res, version)}/notes`, data),
  noteState: (
    res: Id,
    version: Id,
    note: ReviewNote,
    state: NoteState,
    resolution: string,
  ) =>
    requestClient.put(`${base(res, version)}/notes/${note.id}`, {
      expected_revision: note.revision,
      state,
      resolution,
    }),
  episode: (res: Id, version: Id, data: ItemWrite) =>
    requestClient.put(`${base(res, version)}/episode`, data),
  play: async (res: Id, version: Id, seq: number) => {
    const endpoint = `${base(res, version)}/play/${seq}`;
    const url = await requestClient.get<string>(endpoint);
    if (/^https?:\/\//i.test(url)) return url;
    const blob = await plaintextRequestClient.download<Blob>(
      `${endpoint}/content`,
    );
    return URL.createObjectURL(blob);
  },
  upload: (
    res: Id,
    version: Id,
    file: File,
    onProgress: (percent: number) => void,
  ) =>
    plaintextRequestClient.upload<FileUploadView[]>(
      `${base(res, version)}/upload`,
      { file },
      {
        timeout: 30 * 60 * 1000,
        onUploadProgress: (event) =>
          onProgress(
            Math.round((100 * event.loaded) / (event.total ?? file.size)),
          ),
      },
    ),
};
export const reviewLabels = {
  draft: '制作中',
  reviewing: '已交片 · 审片修改',
  final: '定版成片',
  published: '已上架',
};
export const noteLabels = {
  open: '待处理',
  processing: '处理中',
  resolved: '已完成',
};
export const roleLabels: Record<string, string> = {
  editor: '剪辑',
  writer: '编剧',
  director: '导演',
};
