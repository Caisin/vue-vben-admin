import type { ListParams, PageResult, PhoneGroup, SimCard } from './types';

import { requestClient } from '#/api/request';

export interface PhoneGroupWrite {
  enabled: boolean;
  grp_code: string;
  grp_name: string;
  order_no: number;
  remark: string;
}

export interface PhoneGroupOption {
  grp_code: string;
  label: string;
  value: number;
}

export interface PhoneGroupSimsView {
  iccids: string[];
  items: SimCard[];
}

export interface PhoneGroupSimsQueryAddRequest {
  query: ListParams;
}

export interface PhoneGroupSimsQueryAddResult {
  existing: number;
  grp_id: number;
  inserted: number;
  matched: number;
  total: number;
}

export interface PhoneGroupUsersView {
  uids: number[];
}

export interface PhoneGroupNotificationChannelOption {
  channel_code: string;
  channel_id: number;
  channel_name: string;
  channel_type: 'dingtalk_custom_robot' | 'dingtalk_group_bot';
}

export interface PhoneGroupNotificationChannelsView {
  channel_ids: number[];
  options: PhoneGroupNotificationChannelOption[];
}

type PhoneGroupCountFields = Pick<
  PhoneGroup,
  'notification_channel_count' | 'sim_count' | 'user_count'
>;
type PhoneGroupEntity = Omit<PhoneGroup, keyof PhoneGroupCountFields>;
type PhoneGroupRow =
  | PhoneGroup
  | (PhoneGroupCountFields & { group: PhoneGroupEntity });

function normalizePhoneGroup(row: PhoneGroupRow): PhoneGroup {
  if (!('group' in row)) return row;
  const { group, ...counts } = row;
  return { ...group, ...counts };
}

export const PhoneGroupApi = {
  list: async (params: ListParams = {}) => {
    const result = await requestClient.get<PageResult<PhoneGroupRow>>(
      '/msg/phone-groups',
      {
        params,
      },
    );
    return {
      ...result,
      items: result.items.map(normalizePhoneGroup),
    };
  },
  options: () =>
    requestClient.get<PhoneGroupOption[]>('/msg/phone-groups/options'),
  detail: async (id: number) =>
    normalizePhoneGroup(
      await requestClient.get<PhoneGroupRow>(`/msg/phone-groups/${id}`),
    ),
  create: (data: PhoneGroupWrite) =>
    requestClient.post<PhoneGroup>('/msg/phone-groups', data),
  update: (id: number, data: PhoneGroupWrite) =>
    requestClient.put<PhoneGroup>(`/msg/phone-groups/${id}`, data),
  remove: (id: number) =>
    requestClient.delete<boolean>(`/msg/phone-groups/${id}`),
  sims: (id: number) =>
    requestClient.get<PhoneGroupSimsView>(`/msg/phone-groups/${id}/sims`),
  replaceSims: (id: number, iccids: string[]) =>
    requestClient.put<PhoneGroupSimsView>(`/msg/phone-groups/${id}/sims`, {
      iccids,
    }),
  addSimsByQuery: (id: number, data: PhoneGroupSimsQueryAddRequest) =>
    requestClient.post<PhoneGroupSimsQueryAddResult>(
      `/msg/phone-groups/${id}/sims/actions/add-by-query`,
      data,
    ),
  users: (id: number) =>
    requestClient.get<PhoneGroupUsersView>(`/msg/phone-groups/${id}/users`),
  replaceUsers: (id: number, uids: number[]) =>
    requestClient.put<PhoneGroupUsersView>(`/msg/phone-groups/${id}/users`, {
      uids,
    }),
  notificationChannels: (id: number) =>
    requestClient.get<PhoneGroupNotificationChannelsView>(
      `/msg/phone-groups/${id}/notification-channels`,
    ),
  replaceNotificationChannels: (id: number, channelIds: number[]) =>
    requestClient.put<PhoneGroupNotificationChannelsView>(
      `/msg/phone-groups/${id}/notification-channels`,
      { channel_ids: channelIds },
    ),
};
