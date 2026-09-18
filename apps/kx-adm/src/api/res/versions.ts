import { requestClient } from '#/api/request';

export type ResourceType = 'drama' | 'novel' | 'script';
export type Id = number | string;
export interface ResourceVersion {
  id: Id;
  res_id: Id;
  name: string;
  remark: string;
  revision: number;
  created_at: number;
  updated_at: number;
}
export interface VersionItem {
  id: Id;
  version_id: Id;
  seq_no: number;
  title: string;
  link: string;
  content: string;
  duration: number;
  remark: string;
}
export interface VersionDetail {
  version: ResourceVersion;
  items: VersionItem[];
}
export interface ResourceCreate {
  name: string;
  res_type: ResourceType;
  intro: string;
  version_name: string;
  remark: string;
}
export interface VersionWrite {
  name: string;
  remark: string;
  expected_revision?: number;
}
export type ItemWrite = Omit<VersionItem, 'id' | 'version_id'> & {
  expected_revision: number;
};
const base = (res: Id) => `/adm/res/${res}/versions`;
export const ResourceVersionApi = {
  createResource: (data: ResourceCreate) =>
    requestClient.post<{ res_id: Id; version: ResourceVersion }>(
      '/adm/res/create_with_version',
      data,
    ),
  list: (res: Id) => requestClient.get<ResourceVersion[]>(base(res)),
  detail: (res: Id, id: Id) =>
    requestClient.get<VersionDetail>(`${base(res)}/${id}`),
  create: (res: Id, data: VersionWrite) =>
    requestClient.post<ResourceVersion>(base(res), data),
  update: (res: Id, id: Id, data: VersionWrite) =>
    requestClient.put<ResourceVersion>(`${base(res)}/${id}`, data),
  remove: (res: Id, id: Id, expected_revision: number) =>
    requestClient.delete(`${base(res)}/${id}`, { data: { expected_revision } }),
  saveItem: (res: Id, version: Id, data: ItemWrite, id?: Id) =>
    id === undefined
      ? requestClient.post<VersionItem>(`${base(res)}/${version}/items`, data)
      : requestClient.put<VersionItem>(
          `${base(res)}/${version}/items/${id}`,
          data,
        ),
  removeItem: (res: Id, version: Id, id: Id, expected_revision: number) =>
    requestClient.delete(`${base(res)}/${version}/items/${id}`, {
      data: { expected_revision },
    }),
};
