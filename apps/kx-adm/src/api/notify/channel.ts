import type { JsonValue, Page, PageQuery } from '#/api/request';

import { requestClient } from '#/api/request';

export type NotifyChannelType =
  | 'dingtalk_custom_robot'
  | 'dingtalk_group_bot'
  | 'email'
  | 'push'
  | 'sms';
export type NotifyChannelStatus = 'disabled' | 'enabled';

export interface NotifyChannel {
  channel_code: string;
  channel_name: string;
  channel_type: NotifyChannelType;
  config: JsonValue;
  created_at: number | string;
  id: number | string;
  last_error?: null | string;
  max_retry_count: number;
  provider_code: string;
  rate_limit_per_minute: number;
  retry_delay_seconds: number | string;
  status: NotifyChannelStatus;
  updated_at: number | string;
}

export interface NotifyChannelWrite {
  channel_code: string;
  channel_name: string;
  channel_type: NotifyChannelType;
  config: JsonValue;
  max_retry_count: number;
  provider_code: string;
  rate_limit_per_minute: number;
  retry_delay_seconds: number;
  status: NotifyChannelStatus;
}

export interface NotifyChannelQuery extends PageQuery {
  channel_code_prefix?: string;
  channel_name_prefix?: string;
  channel_type?: NotifyChannelType;
  status?: NotifyChannelStatus;
}

export interface NotifyProviderOption {
  channel_type: NotifyChannelType;
  config_options: NotifyProviderConfigOption[];
  description: string;
  display_name: string;
}

export interface NotifyProviderConfigOption {
  description: string;
  display_name: string;
  provider_code: string;
}

export interface NotifyProviderOptionsView {
  providers: NotifyProviderOption[];
}

export const NotifyChannelApi = {
  all: (params?: NotifyChannelQuery) =>
    requestClient.get<NotifyChannel[]>('/notify/channels/all', { params }),
  list: (params?: NotifyChannelQuery) =>
    requestClient.get<Page<NotifyChannel>>('/notify/channels', { params }),
  detail: (id: number | string) =>
    requestClient.get<NotifyChannel>(`/notify/channels/${id}`),
  create: (data: NotifyChannelWrite) =>
    requestClient.post<NotifyChannel>('/notify/channels', data),
  update: (id: number | string, data: NotifyChannelWrite) =>
    requestClient.put<NotifyChannel>(`/notify/channels/${id}`, data),
  remove: (id: number | string) =>
    requestClient.delete<boolean>(`/notify/channels/${id}`),
  test: (id: number | string) =>
    requestClient.post<import('./message').NotifyMessage>(
      `/notify/channels/${id}/actions/test`,
    ),
  provider_options: (params?: {
    channel_type?: NotifyChannelType;
    keyword?: string;
  }) =>
    requestClient.get<NotifyProviderOptionsView>('/notify/provider-options', {
      params,
    }),
};
