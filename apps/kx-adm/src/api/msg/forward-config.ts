import type { PageResult } from './types';

import { requestClient } from '#/api/request';

export interface PlaceholderOption {
  label: string;
  value: string;
}

export interface ForwardConfigOptions {
  content_types: string[];
  modes: string[];
  placeholders: PlaceholderOption[];
}

export interface ForwardConfigQuery {
  device_code_prefix?: string;
  has_snapshot?: boolean;
  last_apply_status?: string;
  online_state?: string;
  page?: number;
  size?: number;
  software_version?: string;
  sort?: string[];
}

export interface ForwardConfigDeviceView {
  device_code: string;
  device_name: string;
  last_apply_at: null | number;
  last_apply_error: string;
  last_apply_event_id: null | number;
  last_apply_status: string;
  last_seen_at: number;
  online_state: string;
  snapshot_event_id: null | number;
  snapshot_ready: boolean;
  snapshot_received_at: null | number;
  software_version: string;
}

export interface ForwardConfigDetailView {
  config: Record<string, unknown>;
  device_code: string;
  raw_config_available: boolean;
  source_event_id: number;
  source_received_at: number;
}

export interface ForwardConfigRefreshRequest {
  device_codes?: string[];
  online_only?: boolean;
}

export interface RobotChannelWrite {
  clear_url?: boolean;
  keywords?: string;
  mode?: string;
  url?: string;
}

export interface RobotPatch {
  body?: string;
  url?: Record<string, RobotChannelWrite>;
}

export type RecordUrlMode =
  | 'clear'
  | 'keep'
  | 'manual'
  | 'use_voice_upload_config';

export interface RecordUrlPatch {
  mode: RecordUrlMode;
  value?: string;
}

export interface HttpHeaderWrite {
  key: string;
  value: string;
}

export interface HttpPostWrite {
  body: Record<string, unknown>;
  headers: HttpHeaderWrite[];
  keywords: string;
  mode: string;
  url: string;
}

export interface ForwardConfigPatch {
  http_post?: HttpPostWrite[];
  record_url?: RecordUrlPatch;
  robot?: RobotPatch;
  tts_txt?: string;
}

export interface ForwardConfigApplyRequest {
  conflict_policy?: 'allow_latest' | 'reject_if_changed';
  device_codes?: string[];
  online_only?: boolean;
  patch: ForwardConfigPatch;
  source_event_id?: null | number;
}

export interface ForwardConfigPreviewItem {
  device_code: string;
  diff_summary: string[];
  message: string;
  redacted_payload: null | Record<string, unknown>;
  source_event_id: null | number;
  status: 'blocked' | 'ready';
}

export interface ForwardConfigPreviewResult {
  blocked: number;
  items: ForwardConfigPreviewItem[];
  ready: number;
  total: number;
}

export const ForwardConfigApi = {
  apply: (data: ForwardConfigApplyRequest) =>
    requestClient.post<{ status: string }>(
      '/msg/forward-config/actions/apply',
      data,
    ),
  detail: (deviceCode: string) =>
    requestClient.get<ForwardConfigDetailView>(
      `/msg/forward-config/${deviceCode}`,
    ),
  options: () =>
    requestClient.get<ForwardConfigOptions>('/msg/forward-config/options'),
  preview: (data: ForwardConfigApplyRequest) =>
    requestClient.post<ForwardConfigPreviewResult>(
      '/msg/forward-config/actions/preview',
      data,
    ),
  query: (data: ForwardConfigQuery = {}) =>
    requestClient.post<PageResult<ForwardConfigDeviceView>>(
      '/msg/forward-config/query',
      data,
    ),
  refresh: (data: ForwardConfigRefreshRequest = {}) =>
    requestClient.post<{ status: string }>(
      '/msg/forward-config/actions/refresh',
      data,
    ),
};
