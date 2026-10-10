import type { StorageOptionView } from '#/api/storage';

import { requestClient } from '#/api/request';

export interface ReleaseArtifact {
  file_id?: number | string;
  target: string;
  url: string;
  signature: string;
}
export interface ReleaseWrite {
  version: string;
  notes: string;
  artifacts: ReleaseArtifact[];
}
export interface ClientRelease extends ReleaseWrite {
  target: string;
  status: 'draft' | 'published' | 'withdrawn';
  revision: number;
  created_at: number;
  updated_at: number;
  published_at: null | number;
}
const base = '/adm/client-releases';
export const ClientReleaseApi = {
  storageOptions: () =>
    requestClient.get<StorageOptionView[]>(`${base}/storage-options`),
  page: (params: Record<string, unknown>) =>
    requestClient.get<{ items: ClientRelease[]; total: number }>(base, {
      params,
    }),
  create: (data: ReleaseWrite) => requestClient.post<ClientRelease>(base, data),
  edit: (row: ClientRelease, data: ReleaseWrite) =>
    requestClient.put(
      `${base}/${encodeURIComponent(row.version)}/${encodeURIComponent(row.target)}`,
      {
        notes: data.notes,
        artifacts: data.artifacts,
        expected_revision: row.revision,
      },
    ),
  action: (row: ClientRelease, action: 'publish' | 'withdraw') =>
    requestClient.post(
      `${base}/${encodeURIComponent(row.version)}/${encodeURIComponent(row.target)}/${action}`,
      {
        expected_revision: row.revision,
      },
    ),
  remove: (row: ClientRelease) =>
    requestClient.delete(
      `${base}/${encodeURIComponent(row.version)}/${encodeURIComponent(row.target)}`,
      {
        data: { expected_revision: row.revision },
      },
    ),
};
