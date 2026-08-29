import type {
  NotifyChannel,
  NotifyMessage,
  NotifyRecipientEndpoint,
  NotifyTestMessageResult,
  NotifyTestMessageSend,
} from '#/api/notify';

export interface NotifyMessageTestModalData {
  channels: NotifyChannel[];
  message?: NotifyMessage;
  recipientEndpoints: NotifyRecipientEndpoint[];
}

export type NotifyMessageTestSubmit = (
  payload: NotifyTestMessageSend,
) => Promise<NotifyTestMessageResult>;
