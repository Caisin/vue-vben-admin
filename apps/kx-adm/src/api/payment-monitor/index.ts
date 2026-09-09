import type { Page, PageQuery } from '#/api/request';

import { requestClient } from '#/api/request';
export type Id = number | string;
export interface Policy {
  visa_region: string;
  watch_bps: number;
  high_bps: number;
  critical_bps: number;
  min_payments: number;
  min_disputes: number;
  efw_count: number;
  deadline_hours: number;
  stale_hours: number;
  cooldown_hours: number;
  channel_id?: Id | null;
}
export interface Balance {
  amount: Id;
  currency: string;
}
export interface Account {
  id: Id;
  provider: string;
  owner_uid: Id;
  name: string;
  connected_account: string;
  remote_account_id: string;
  livemode: boolean;
  enabled: boolean;
  interval_seconds: number;
  history_days: number;
  policy: Policy;
  version: Id;
  last_success_at: Id;
  next_sync_at: Id;
  coverage: [number, number][];
  last_error: string;
  health: {
    country?: string;
    charges_enabled?: boolean | null;
    payouts_enabled?: boolean | null;
    disabled_reason?: string;
    efw_error?: string;
    events_error?: string;
    reconciliation_gap?: string;
    missing?: string[];
    balance?: { available?: Balance[]; pending?: Balance[] };
  };
}
export interface AccountWrite {
  provider: string;
  name: string;
  connected_account: string;
  livemode: boolean;
  api_key?: string;
  enabled: boolean;
  interval_seconds: number;
  history_days: number;
  policy: Policy;
  expected_version?: Id;
}
export interface RecordRow {
  account_id: Id;
  kind: string;
  object_id: string;
  charge_id: string;
  payment_intent: string;
  created_at: Id;
  charge_created_at: Id;
  brand: string;
  currency: string;
  amount: Id;
  refunded: Id;
  status: string;
  reason: string;
  paid: boolean;
  captured: boolean;
  is_card: boolean;
  due_by: Id;
  actionable: boolean;
  updated_at: Id;
}
export interface Job {
  id: Id;
  account_id: Id;
  task_run_id?: Id | null;
  from_at: Id;
  to_at: Id;
  phase: string;
  status: string;
  processed: Id;
  error_message: string;
  created_at: Id;
  started_at: Id;
  completed_at: Id;
}
export interface AlertRow {
  id: Id;
  account_id: Id;
  rule: string;
  severity: string;
  title: string;
  detail: Record<string, unknown>;
  state: string;
  note: string;
  channel_id?: Id | null;
  notification_id?: Id | null;
  notify_error: string;
  version: Id;
  created_at: Id;
  updated_at: Id;
}
export interface Metrics {
  payments: number;
  card_payments: number;
  disputes: number;
  efws: number;
  cohort_disputed: number;
  unknown_brand: number;
  actionable_efws: number;
  payment_amounts: Record<string, Id>;
  disputed_amounts: Record<string, Id>;
  open_amounts: Record<string, Id>;
  refunds: Record<string, Id>;
  reasons: Record<string, number>;
  brands: Record<string, number>;
  activity_bps?: null | number;
  cohort_bps?: null | number;
}
export interface Ranking {
  account_id: Id;
  name: string;
  livemode: boolean;
  from: number;
  to: number;
  metrics: Metrics;
  complete: boolean;
  stale: boolean;
  provisional: boolean;
  efw_available: boolean;
  updates_available: boolean;
  last_success_at: Id;
  last_error: string;
}
export interface Analysis {
  items: Ranking[];
  timezone: string;
  warning: string;
}
export interface Query extends PageQuery {
  account_id?: Id;
  keyword?: string;
  kind?: string;
  status?: string;
  brand?: string;
  from?: number;
  to?: number;
}
export interface AnalysisQuery {
  from: number;
  to: number;
  account_id?: Id;
  daily: boolean;
  livemode: boolean;
  brand?: string;
  metric?: string;
}
const base = '/payment-monitor';
export const PaymentApi = {
  retryDelivery: (id: Id) =>
    requestClient.post<boolean>(`${base}/alerts/${id}/retry-notification`),
  network: (id: Id) =>
    requestClient.get<NetworkEstimate[]>(`${base}/accounts/${id}/network`),
  providers: () =>
    requestClient.get<
      {
        code: string;
        name: string;
        early_fraud_warnings: boolean;
        balance: boolean;
        card_network_estimates: boolean;
      }[]
    >(`${base}/providers`),
  accounts: (params?: Query) =>
    requestClient.get<Page<Account>>(`${base}/accounts`, { params }),
  account: (id: Id) => requestClient.get<Account>(`${base}/accounts/${id}`),
  save: (data: AccountWrite, id?: Id) =>
    id
      ? requestClient.put<Account>(`${base}/accounts/${id}`, data)
      : requestClient.post<Account>(`${base}/accounts`, data),
  channels: () =>
    requestClient.get<{ id: Id; name: string; type: string }[]>(
      `${base}/channels`,
    ),
  sync: (id: Id, data: { from?: number; to?: number }) =>
    requestClient.post<Job>(`${base}/accounts/${id}/sync`, data),
  records: (params: Query) =>
    requestClient.get<Page<RecordRow>>(`${base}/records`, { params }),
  jobs: (params: Query) =>
    requestClient.get<Page<Job>>(`${base}/jobs`, { params }),
  job: (id: Id) => requestClient.get<Job>(`${base}/jobs/${id}`),
  analysis: (params: AnalysisQuery) =>
    requestClient.get<Analysis>(`${base}/analysis`, { params }),
  alerts: (params: Query) =>
    requestClient.get<Page<AlertRow>>(`${base}/alerts`, { params }),
  handle: (
    id: Id,
    data: { state: string; note: string; expected_version: Id },
  ) => requestClient.put<AlertRow>(`${base}/alerts/${id}`, data),
  delivery: (id: Id) =>
    requestClient.get<{
      status: string;
      last_error?: string;
      attempt_count?: number;
    }>(`${base}/alerts/${id}/delivery`),
};

export interface NetworkEstimate {
  additional_events_at_fixed_denominator?: null | number;
  volume_minor?: null | number;
  volume_threshold_minor?: null | number;
  program: string;
  from: number;
  to: number;
  numerator: number;
  denominator: number;
  rate_bps?: null | number;
  count_threshold: number;
  rate_threshold_bps: number;
  meets_reference?: boolean | null;
  missing: string[];
  formula: string;
  rule_source: string;
  guidance: string;
}
