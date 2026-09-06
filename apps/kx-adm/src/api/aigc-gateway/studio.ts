import type { StorageOptionView } from '#/api/storage';

import { requestClient } from '#/api/request';

export type StudioKind = 'chat' | 'image' | 'video';
export type Id = number | string;
export interface StudioSession {
  id: Id;
  kind: StudioKind;
  title: string;
  version: number;
  updated_at: number;
}
export interface StudioModel {
  id: Id;
  name: string;
  provider: string;
  protocol: string;
  capabilities: string[];
  input_price: string;
  output_price: string;
}
export interface GenerateOptions {
  temperature?: number;
  max_tokens?: number;
  size?: string;
  quality?: string;
  count?: number;
  seconds?: number;
  aspect_ratio?: string;
}
export interface GenerateWrite {
  regenerate_from?: Id;
  request_key: string;
  version: number;
  route_id: Id;
  prompt: string;
  instructions: string;
  file_ids: Id[];
  storage_code: string;
  options: GenerateOptions;
}
export interface StudioRun {
  task_run_id?: Id | null;
  id: Id;
  session_id: Id;
  route_id: Id;
  upstream_model: string;
  upstream_id: string;
  state: string;
  input: { kind: StudioKind; protocol: string; request: GenerateWrite };
  output_text: string;
  output_files: Id[];
  progress: number;
  error_code: string;
  cancel_requested: boolean;
  usage: Record<string, number>;
  created_at: number;
}
const root = '/aigc/studio';
export const StudioApi = {
  models: () => requestClient.get<StudioModel[]>(`${root}/models`),
  storages: () =>
    requestClient.get<StorageOptionView[]>(`${root}/storage-options`),
  sessions: (kind: StudioKind, keyword = '', before?: Id) =>
    requestClient.get<StudioSession[]>(`${root}/sessions`, {
      params: { kind, keyword, before },
    }),
  session: (id: Id) =>
    requestClient.get<StudioSession>(`${root}/sessions/${id}`),
  create: (kind: StudioKind, title: string) =>
    requestClient.post<StudioSession>(`${root}/sessions`, { kind, title }),
  rename: (id: Id, title: string, version: number) =>
    requestClient.put<StudioSession>(`${root}/sessions/${id}`, {
      title,
      version,
    }),
  remove: (id: Id) => requestClient.delete(`${root}/sessions/${id}`),
  runs: (id: Id, before?: Id) =>
    requestClient.get<StudioRun[]>(`${root}/sessions/${id}/runs`, {
      params: { before },
    }),
  run: (id: Id) => requestClient.get<StudioRun>(`${root}/runs/${id}`),
  generate: (id: Id, data: GenerateWrite) =>
    requestClient.post<StudioRun>(`${root}/sessions/${id}/runs`, data),
  cancel: (id: Id) =>
    requestClient.post<StudioRun>(`${root}/runs/${id}/cancel`),
  resume: (id: Id) =>
    requestClient.post<StudioRun>(`${root}/runs/${id}/resume`),
};
