import type { NotifyChannel } from './channel';
import type { NotifyMessage, NotifyMessageQuery } from './message';
import type { NotifyRecipientEndpoint } from './recipient';

import type { JsonValue, Page } from '#/api/request';

import { requestClient } from '#/api/request';

export type NotifyTestTarget =
  | {
      at_mobiles: string[];
      at_user_ids: string[];
      is_at_all: boolean;
      kind: 'ding_talk_at';
    }
  | { endpoint_id: number | string; kind: 'recipient_endpoint' }
  | { kind: 'channel_default' }
  | { kind: 'direct'; recipient: string };

export type NotifyTestTargetKind = NotifyTestTarget['kind'];

export interface NotifyTestOptions {
  channels: NotifyChannel[];
  recipient_endpoints: NotifyRecipientEndpoint[];
}

export interface NotifyTestMessageSend {
  channel_id: number | string;
  content: string;
  content_type: string;
  payload: JsonValue;
  subject: string;
  target: NotifyTestTarget;
}

export interface NotifyTestMessageResult extends NotifyMessage {
  target: NotifyTestTarget;
}

export const NotifyTestApi = {
  options: () => requestClient.get<NotifyTestOptions>('/notify/test/options'),
  messages: (params?: NotifyMessageQuery) =>
    requestClient.get<Page<NotifyMessage>>('/notify/test/messages', { params }),
  send: (data: NotifyTestMessageSend) =>
    requestClient.post<NotifyTestMessageResult>('/notify/test/messages', data),
};
