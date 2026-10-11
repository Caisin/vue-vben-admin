import type { Id } from './versions';

import { requestClient } from '#/api/request';
export interface ReviewGroupConfig {
  expected_revision: number;
  app_key: string;
  template_id: string;
  robot_code: string;
  owner_uid: Id;
  title: string;
  enabled: boolean;
}
export interface ReviewDelivery {
  id: Id;
  kind: string;
  content: string;
  state: 'pending' | 'sending' | 'sent' | 'uncertain';
  error: string;
  created_at: number;
}
export interface ReviewGroupView extends Omit<
  ReviewGroupConfig,
  'expected_revision'
> {
  configured: boolean;
  revision: number;
  group_created: boolean;
  can_reconfigure: boolean;
  state: string;
  error: string;
  can_manage: boolean;
  deliveries: ReviewDelivery[];
  delivery_total: number;
  pending_count: number;
  uncertain_count: number;
}
const root = (res: Id) => `/adm/res/review/${res}/dingtalk`;
export const reviewGroupApi = {
  get: (res: Id, page = 1) =>
    requestClient.get<ReviewGroupView>(root(res), {
      params: { page, size: 10 },
    }),
  options: (res: Id) =>
    requestClient.get<{
      apps: { value: string; label: string }[];
      owners: { value: string; label: string }[];
    }>(`${root(res)}/options`),
  save: (res: Id, body: ReviewGroupConfig) =>
    requestClient.put(root(res), body),
  retry: (res: Id, revision: number, delivery?: Id) =>
    requestClient.post(`${root(res)}/retry`, {
      expected_revision: revision,
      delivery_id: delivery,
      confirm_resend: delivery !== undefined,
    }),
};
