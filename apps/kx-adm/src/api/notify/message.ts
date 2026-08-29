import type { NotifyChannelType } from './channel';

import type { JsonValue, Page, PageQuery } from '#/api/request';

import { requestClient } from '#/api/request';

export type NotifyMessagePriority = 'high' | 'low' | 'normal';
export type NotifyMessageStatus =
  | 'cancelled'
  | 'failed'
  | 'queued'
  | 'retry'
  | 'running'
  | 'succeeded';
export type NotifyDeliveryStatus = 'failed' | 'running' | 'succeeded';

export interface NotifyMessage {
  attempt_count: number;
  biz_id: string;
  biz_type: string;
  channel_id: number | string;
  channel_type: NotifyChannelType;
  content: string;
  content_type: string;
  created_at: number | string;
  created_by?: null | number | string;
  dedupe_key?: null | string;
  duplicate: boolean;
  id: number | string;
  last_error?: null | string;
  max_attempts: number;
  message_code: string;
  next_attempt_at?: null | number | string;
  not_before?: null | number | string;
  payload: JsonValue;
  priority: NotifyMessagePriority;
  sent_at?: null | number | string;
  status: NotifyMessageStatus;
  subject: string;
  updated_at: number | string;
}

export interface NotifyMessageEnqueue {
  biz_id?: string;
  biz_type?: string;
  channel_id: number;
  content: string;
  content_type: string;
  dedupe_key?: null | string;
  max_attempts?: null | number;
  not_before?: null | number;
  payload: JsonValue;
  priority: NotifyMessagePriority;
  subject: string;
}

export interface NotifyMessageQuery extends PageQuery {
  biz_id?: string;
  biz_type?: string;
  channel_id?: number | string;
  created_by?: number | string;
  created_range?: string;
  priority?: NotifyMessagePriority;
  status?: NotifyMessageStatus;
}

export interface NotifyDeliveryAttempt {
  attempt_no: number;
  error_message?: null | string;
  finished_at?: null | number | string;
  id: number | string;
  message_id: number | string;
  provider_message_id?: null | string;
  request_summary: JsonValue;
  response_summary: JsonValue;
  started_at: number | string;
  status: NotifyDeliveryStatus;
}

export interface NotifyAttemptQuery extends PageQuery {
  status?: NotifyDeliveryStatus;
}

export const NotifyMessageApi = {
  list: (params?: NotifyMessageQuery) =>
    requestClient.get<Page<NotifyMessage>>('/notify/messages', { params }),
  detail: (id: number | string) =>
    requestClient.get<NotifyMessage>(`/notify/messages/${id}`),
  create: (data: NotifyMessageEnqueue) =>
    requestClient.post<NotifyMessage>('/notify/messages', data),
  cancel: (id: number | string) =>
    requestClient.post<NotifyMessage>(`/notify/messages/${id}/actions/cancel`),
  retry: (id: number | string) =>
    requestClient.post<NotifyMessage>(`/notify/messages/${id}/actions/retry`),
  attempts: (id: number | string, params?: NotifyAttemptQuery) =>
    requestClient.get<Page<NotifyDeliveryAttempt>>(
      `/notify/messages/${id}/attempts`,
      { params },
    ),
};
