import { requestClient } from '#/api/request';

export type NotifyInboxSourceType = 'delivery_recipient' | 'task_run';

export interface NotifyInboxItem {
  content: string;
  event_at: number | string;
  link?: null | string;
  read: boolean;
  source_id: number | string;
  source_type: NotifyInboxSourceType;
  status: string;
  title: string;
}

export interface NotifyInboxView {
  items: NotifyInboxItem[];
  server_time: number | string;
  unread_count: number;
}

export interface NotifyInboxMutation {
  changed: boolean;
  updated_at: number | string;
}

export interface NotifyInboxQuery {
  size?: number;
}

export const NotifyInboxApi = {
  list: (params?: NotifyInboxQuery) =>
    requestClient.get<NotifyInboxView>('/notify/inbox', { params }),
  mark_all_read: () =>
    requestClient.post<NotifyInboxMutation>('/notify/inbox/actions/read-all'),
  clear: () => requestClient.delete<NotifyInboxMutation>('/notify/inbox'),
  mark_read: (source_type: NotifyInboxSourceType, source_id: number | string) =>
    requestClient.post<NotifyInboxMutation>(
      `/notify/inbox/${source_type}/${source_id}/actions/read`,
    ),
  dismiss: (source_type: NotifyInboxSourceType, source_id: number | string) =>
    requestClient.delete<NotifyInboxMutation>(
      `/notify/inbox/${source_type}/${source_id}`,
    ),
};
