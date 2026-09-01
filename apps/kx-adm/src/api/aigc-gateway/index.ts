import type { Page, PageQuery } from '#/api/request';

import { requestClient } from '#/api/request';

export interface ProviderGroup {
  id: number | string;
  code: string;
  name: string;
  priority: number;
  load_strategy: string;
  enabled: boolean;
}
export type ProviderGroupWrite = Omit<ProviderGroup, 'id'>;
export interface Provider {
  id: number | string;
  group_id: number | string;
  code: string;
  name: string;
  protocol: string;
  base_url: string;
  credential_code: string;
  priority: number;
  weight: number;
  enabled: boolean;
  fail_threshold: number;
  open_duration_secs: number | string;
  breaker_statuses: number[];
}
export type ProviderWrite = Omit<Provider, 'id'>;
export interface ModelRoute {
  id: number | string;
  provider_id: number | string;
  canonical_model: string;
  upstream_model: string;
  aliases: string[];
  capabilities?: string[];
  input_price: string;
  output_price: string;
  enabled: boolean;
}
export type ModelWrite = Omit<ModelRoute, 'id'>;
export interface GatewayApiKey {
  id: number | string;
  name: string;
  key_prefix: string;
  owner_uid: number | string;
  allowed_models: string[];
  state: 'active' | 'disabled';
  expires_at: number | string;
  last_used_at: number | string;
  created_at: number | string;
}
export interface ApiKeyCreated {
  id: number | string;
  api_key: string;
  key_prefix: string;
}
export interface GatewayRequest {
  id: number | string;
  trace_id: string;
  owner_uid: number | string;
  path: string;
  requested_model: string;
  canonical_model: string;
  provider_code: string;
  upstream_model: string;
  state: string;
  http_status?: number;
  prompt_tokens: number | string;
  completion_tokens: number | string;
  total_tokens: number | string;
  cost: string;
  attempt_count: number;
  elapsed_ms: number | string;
  error_message: string;
  created_at: number | string;
}
export interface GatewayBreaker {
  id: number | string;
  provider_code: string;
  canonical_model: string;
  failure_count: number;
  success_count: number;
  open_until?: number | string;
  last_error: string;
  updated_at: number | string;
}
export interface GatewayMediaJob {
  id: number | string;
  task_run_id?: number | string;
  media_type: string;
  model: string;
  path: string;
  state: string;
  result: unknown;
  error_message: string;
  created_at: number | string;
}
export interface MediaJobDispatch {
  id: number | string;
  task_run: { id: number | string; status: string };
}
export interface GatewayOverview {
  providers: number;
  active_keys: number;
  requests: number;
  total_tokens: number | string;
  total_cost: string;
  open_breakers: number;
}
export interface RequestQuery extends PageQuery {
  model?: string;
  provider_code?: string;
  state?: string;
  api_key_id?: number | string;
}

export const AigcGatewayApi = {
  overview: () => requestClient.get<GatewayOverview>('/aigc/admin/overview'),
  groups: () => requestClient.get<ProviderGroup[]>('/aigc/admin/groups'),
  saveGroup: (data: ProviderGroupWrite, id?: number | string) =>
    id
      ? requestClient.put<ProviderGroup>(`/aigc/admin/groups/${id}`, data)
      : requestClient.post<ProviderGroup>('/aigc/admin/groups', data),
  reorderGroups: (ids: Array<number | string>) =>
    requestClient.put('/aigc/admin/groups/order', { ids }),
  providers: () => requestClient.get<Provider[]>('/aigc/admin/providers'),
  saveProvider: (data: ProviderWrite, id?: number | string) =>
    id
      ? requestClient.put<Provider>(`/aigc/admin/providers/${id}`, data)
      : requestClient.post<Provider>('/aigc/admin/providers', data),
  reorderProviders: (groupId: number | string, ids: Array<number | string>) =>
    requestClient.put('/aigc/admin/providers/order', {
      group_id: groupId,
      ids,
    }),
  models: () => requestClient.get<ModelRoute[]>('/aigc/admin/models'),
  saveModel: (data: ModelWrite, id?: number | string) =>
    id
      ? requestClient.put<ModelRoute>(`/aigc/admin/models/${id}`, data)
      : requestClient.post<ModelRoute>('/aigc/admin/models', data),
  keys: () => requestClient.get<GatewayApiKey[]>('/aigc/admin/api-keys'),
  issueKey: (data: {
    allowed_models: string[];
    expires_at: number | string;
    name: string;
    owner_uid: number | string;
  }) => requestClient.post<ApiKeyCreated>('/aigc/admin/api-keys', data),
  disableKey: (id: number | string) =>
    requestClient.post(`/aigc/admin/api-keys/${id}/disable`),
  requests: (params?: RequestQuery) =>
    requestClient.get<Page<GatewayRequest>>('/aigc/admin/requests', { params }),
  breakers: () => requestClient.get<GatewayBreaker[]>('/aigc/admin/breakers'),
  resetBreaker: (id: number | string) =>
    requestClient.post(`/aigc/admin/breakers/${id}/reset`),
  mediaJobs: () =>
    requestClient.get<GatewayMediaJob[]>('/aigc/admin/media/jobs'),
  mediaJob: (id: number | string) =>
    requestClient.get<GatewayMediaJob>(`/aigc/admin/media/jobs/${id}`),
  playgroundChat: (data: {
    input: unknown;
    instructions: string;
    model: string;
    temperature?: number;
  }) => requestClient.post<unknown>('/aigc/admin/playground/chat', data),
  playgroundMedia: (data: {
    media_type: 'image' | 'video';
    model: string;
    path: string;
    request: Record<string, unknown>;
  }) =>
    requestClient.post<MediaJobDispatch>('/aigc/admin/playground/media', data),
};
