import type { ReviewNote } from './review';
import type { Id, ResourceVersion } from './versions';

import { plaintextRequestClient, requestClient } from '#/api/request';
export interface DeliveryFile {
  file_id: Id;
  name: string;
}
export interface DeliveryAsset {
  id: Id;
  version_id: Id;
  seq_no: number;
  kind: string;
  files: DeliveryFile[];
  text: string;
  reason: string;
  action: string;
  source_id?: Id;
  actor_uid: Id;
  created_at: number;
}
export interface DeliverySlot {
  kind: string;
  label: string;
  seq_no: number;
  required: boolean;
  complete: boolean;
  locked: boolean;
  asset?: DeliveryAsset | null;
}
export interface DeliveryRelease {
  resource_id: Id;
  version_id: Id;
  created_at: number;
  actor_uid: Id;
}
export interface DeliveryView {
  slots: DeliverySlot[];
  revision: number;
  state: string;
  submitted: number;
  required: number;
  pending: number;
  notes: ReviewNote[];
  users: Record<string, string>;
  can_edit: boolean;
  can_manage: boolean;
  can_ingest: boolean;
  release?: DeliveryRelease | null;
}
export interface DeliveryProject {
  project: { id: Id; name: string; code: string };
  scope: Id;
  version?: ResourceVersion;
  submitted: number;
  required: number;
  pending: number;
  release?: DeliveryRelease | null;
}
export interface AssetWrite {
  expected_revision: number;
  kind: string;
  seq_no: number;
  files: DeliveryFile[];
  text: string;
  reason: string;
  restore_from?: Id | null;
}
const base = (scope: Id, version: Id) =>
  `/adm/res/delivery/${scope}/${version}`;
const projectBase = (scope: Id) => `/adm/res/delivery/${scope}`;
export const deliveryApi = {
  list: (keyword: string, stage: string, page: number, size = 20) =>
    requestClient.get<{ items: DeliveryProject[]; total: number }>(
      '/adm/res/delivery/projects',
      { params: { keyword, stage, page, size } },
    ),
  create: (name: string, planned_episodes: number) =>
    requestClient.post<DeliveryProject>('/adm/res/delivery/projects', {
      name,
      planned_episodes,
    }),
  manifest: (scope: Id, version: Id) =>
    requestClient.get<DeliveryView>(base(scope, version)),
  save: (scope: Id, version: Id, data: AssetWrite) =>
    requestClient.post(`${base(scope, version)}/assets`, data),
  history: (scope: Id, version: Id, kind: string, seq: number, page = 1) =>
    requestClient.get<{
      items: DeliveryAsset[];
      total: number;
      users: Record<string, string>;
    }>(`${base(scope, version)}/history/${kind}/${seq}`, {
      params: { page, size: 10 },
    }),
  upload: (
    scope: Id,
    version: Id,
    file: File,
    onProgress: (percent: number) => void,
  ) =>
    plaintextRequestClient.upload<DeliveryFile>(
      `${base(scope, version)}/upload`,
      { file },
      {
        timeout: 30 * 60 * 1000,
        onUploadProgress: (e) =>
          onProgress(Math.round((e.loaded * 100) / (e.total ?? file.size))),
      },
    ),
  media: async (scope: Id, version: Id, asset: Id, index: number) =>
    URL.createObjectURL(
      await plaintextRequestClient.download<Blob>(
        `${base(scope, version)}/assets/${asset}/files/${index}`,
      ),
    ),
  note: (
    scope: Id,
    version: Id,
    asset: Id,
    expected_revision: number,
    body: string,
  ) =>
    requestClient.post(`${base(scope, version)}/assets/${asset}/notes`, {
      expected_revision,
      body,
    }),
  grants: (scope: Id, version: Id) =>
    requestClient.get<DeliveryDownloadGrant[]>(
      `${base(scope, version)}/download-permissions`,
    ),
  transferOwner: (scope: Id, uid: Id) =>
    requestClient.put(`${projectBase(scope)}/owner`, { uid }),
  saveGrants: (scope: Id, version: Id, grants: DeliveryDownloadGrant[]) =>
    requestClient.put(
      `${base(scope, version)}/download-permissions`,
      grants.map(
        ({
          uid,
          can_download,
          modules,
          seq_from,
          seq_until,
          valid_from,
          valid_until,
        }) => ({
          uid,
          can_download,
          modules,
          seq_from,
          seq_until,
          valid_from,
          valid_until,
        }),
      ),
    ),
  ingest: (scope: Id, version: Id, expected_revision: number) =>
    requestClient.post<DeliveryRelease>(`${base(scope, version)}/ingest`, {
      expected_revision,
    }),
};

export interface DeliveryDownloadGrant {
  delivery_version_id?: number;
  user_name?: string;
  uid: Id;
  can_download: boolean;
  modules: string[];
  seq_from: number;
  seq_until: number;
  valid_from: number;
  valid_until: number;
}
