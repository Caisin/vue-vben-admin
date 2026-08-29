import type { JsonValue, Page, PageQuery } from '#/api/request';

import { requestClient } from '#/api/request';

export type MembershipState = 'active' | 'revoked';
export type MembershipEventKind =
  | 'grant'
  | 'refund'
  | 'renew'
  | 'revoke'
  | 'transition_scheduled'
  | 'upgrade';
export type RenewalPolicy = 'stack_from_current_end';
export type TransitionPolicy = 'replace_at_period_end' | 'replace_immediately';

export interface MembershipType {
  code: string;
  created_at: number | string;
  enabled: boolean;
  id: number | string;
  intro: string;
  name: string;
  updated_at: number | string;
}

export interface MembershipPolicy {
  grace_seconds: number | string;
  renewal: RenewalPolicy;
  transition: TransitionPolicy;
}

export interface MembershipPlan {
  code: string;
  created_at: number | string;
  enabled: boolean;
  id: number | string;
  intro: string;
  membership_type_id: number | string;
  name: string;
  policy: MembershipPolicy;
  tier_rank: number | string;
  updated_at: number | string;
}

export interface MembershipPlanEntitlement {
  created_at: number | string;
  entitlement_code: string;
  grace_allowed: boolean;
  parameters: JsonValue;
  plan_id: number | string;
}

export interface UserMembership {
  acct_id: number | string;
  created_at: number | string;
  last_event_id: number | string;
  membership_type_id: number | string;
  pending_period_end?: null | number | string;
  pending_plan_id?: null | number | string;
  period_end: number | string;
  period_start: number | string;
  plan_id: number | string;
  state: MembershipState;
  updated_at: number | string;
}

export interface UserMembershipView {
  effective_period_end: number | string;
  effective_period_start: number | string;
  entitlements: MembershipPlanEntitlement[];
  membership: UserMembership;
  membership_type: MembershipType;
  plan: MembershipPlan;
  using_pending_plan: boolean;
}

export interface MembershipEvent {
  acct_id: number | string;
  after_period_end?: null | number | string;
  after_plan_id?: null | number | string;
  before_period_end?: null | number | string;
  before_plan_id?: null | number | string;
  created_at: number | string;
  duration_seconds: number | string;
  id: number | string;
  idempotency_key: string;
  kind: MembershipEventKind;
  membership_type_id: number | string;
  metadata: JsonValue;
  operator_uid?: null | number | string;
  reason: string;
  source_id: string;
  source_type: string;
}

export interface MembershipTypeWrite {
  code: string;
  enabled?: boolean;
  intro?: string;
  name: string;
}

export interface MembershipPlanWrite {
  code: string;
  enabled?: boolean;
  intro?: string;
  membership_type_id: number | string;
  name: string;
  policy: MembershipPolicy;
  tier_rank: number | string;
}

export interface MembershipEntitlementWrite {
  entitlement_code: string;
  grace_allowed?: boolean;
  parameters?: JsonValue;
}

export interface MembershipGrantWrite {
  duration_seconds: number | string;
  idempotency_key: string;
  metadata?: JsonValue;
  plan_id: number | string;
  reason: string;
  source_id: string;
  source_type: string;
}

export interface MembershipRevokeWrite {
  idempotency_key: string;
  membership_type_id: number | string;
  metadata?: JsonValue;
  reason: string;
  source_id: string;
  source_type: string;
}

export interface MembershipTypePageQuery extends PageQuery {
  code_prefix?: string;
  enabled?: boolean;
}

export interface MembershipPlanPageQuery extends PageQuery {
  code_prefix?: string;
  enabled?: boolean;
  membership_type_id?: number | string;
}

export const MembershipApi = {
  typeList: (params?: MembershipTypePageQuery) =>
    requestClient.get<Page<MembershipType>>('/asset/membership/types', {
      params,
    }),
  createType: (data: MembershipTypeWrite) =>
    requestClient.post<MembershipType>('/asset/membership/types', data),
  updateType: (id: number | string, data: MembershipTypeWrite) =>
    requestClient.put<MembershipType>(`/asset/membership/types/${id}`, data),
  planList: (params?: MembershipPlanPageQuery) =>
    requestClient.get<Page<MembershipPlan>>('/asset/membership/plans', {
      params,
    }),
  createPlan: (data: MembershipPlanWrite) =>
    requestClient.post<MembershipPlan>('/asset/membership/plans', data),
  updatePlan: (id: number | string, data: MembershipPlanWrite) =>
    requestClient.put<MembershipPlan>(`/asset/membership/plans/${id}`, data),
  entitlements: (id: number | string) =>
    requestClient.get<MembershipPlanEntitlement[]>(
      `/asset/membership/plans/${id}/entitlements`,
    ),
  replaceEntitlements: (
    id: number | string,
    data: MembershipEntitlementWrite[],
  ) =>
    requestClient.put<MembershipPlanEntitlement[]>(
      `/asset/membership/plans/${id}/entitlements`,
      data,
    ),
  summary: (acctId: number | string) =>
    requestClient.get<UserMembershipView[]>(
      `/asset/membership/accounts/${acctId}`,
    ),
  events: (acctId: number | string) =>
    requestClient.get<MembershipEvent[]>(
      `/asset/membership/accounts/${acctId}/events`,
    ),
  grant: (acctId: number | string, data: MembershipGrantWrite) =>
    requestClient.post<MembershipEvent>(
      `/asset/membership/accounts/${acctId}/grant`,
      data,
    ),
  revoke: (acctId: number | string, data: MembershipRevokeWrite) =>
    requestClient.post<MembershipEvent>(
      `/asset/membership/accounts/${acctId}/revoke`,
      data,
    ),
  hasEntitlement: (acctId: number | string, code: string) =>
    requestClient.get<boolean>(
      `/asset/membership/accounts/${acctId}/entitlements/${code}`,
    ),
};
