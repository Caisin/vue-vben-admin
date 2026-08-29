import type { JsonValue, Page, PageQuery } from '#/api/request';

import { requestClient } from '#/api/request';

export interface NotifyRecipientEndpoint {
  app_id: string;
  created_at: number | string;
  current: boolean;
  device_id: string;
  endpoint_type: string;
  id: number | string;
  metadata: JsonValue;
  platform: string;
  provider_recipient_id_masked: string;
  uid: number | string;
  updated_at: number | string;
}

export interface NotifyRecipientEndpointQuery extends PageQuery {
  app_id?: string;
  current?: boolean;
  endpoint_type?: string;
  platform?: string;
  uid?: number | string;
}

export interface NotifyDeliveryRecipient {
  campaign_id: string;
  campaign_type: string;
  click_count: number | string;
  created_at: number | string;
  current: boolean;
  first_clicked_at?: null | number | string;
  id: number | string;
  last_clicked_at?: null | number | string;
  message_id: number | string;
  metadata: JsonValue;
  provider_recipient_id_masked: string;
  push_type: string;
  uid: number | string;
  updated_at: number | string;
}

export interface NotifyDeliveryRecipientQuery extends PageQuery {
  campaign_id?: string;
  campaign_type?: string;
  created_range?: string;
  current?: boolean;
  message_id?: number | string;
  push_type?: string;
  uid?: number | string;
}

export const NotifyRecipientApi = {
  endpoints: (params?: NotifyRecipientEndpointQuery) =>
    requestClient.get<Page<NotifyRecipientEndpoint>>(
      '/notify/recipient-endpoints',
      { params },
    ),
  endpoint: (id: number | string) =>
    requestClient.get<NotifyRecipientEndpoint>(
      `/notify/recipient-endpoints/${id}`,
    ),
  recipients: (params?: NotifyDeliveryRecipientQuery) =>
    requestClient.get<Page<NotifyDeliveryRecipient>>('/notify/recipients', {
      params,
    }),
  recipient: (id: number | string) =>
    requestClient.get<NotifyDeliveryRecipient>(`/notify/recipients/${id}`),
};
