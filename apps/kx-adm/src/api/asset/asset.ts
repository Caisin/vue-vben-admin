import type { Page, PageQuery } from '#/api/request';

import { requestClient } from '#/api/request';

export type AssetKind = 'coin' | 'coupon' | 'credit';
export type AssetLotState = 'active' | 'depleted' | 'revoked';
export type AssetTxKind = 'grant' | 'refund' | 'revoke' | 'spend';

export interface AssetItem {
  code: string;
  created_at: number | string;
  default_valid_seconds?: null | number | string;
  enabled: boolean;
  id: number | string;
  intro: string;
  kind: AssetKind;
  name: string;
  spend_priority: number | string;
  updated_at: number | string;
}

export interface AssetItemWrite {
  code: string;
  default_valid_seconds?: null | number | string;
  enabled?: boolean;
  intro?: string;
  kind: AssetKind;
  name: string;
  spend_priority?: number | string;
}

export interface AssetLot {
  acct_id: number | string;
  asset_item_id: number | string;
  created_at: number | string;
  effect_at: number | string;
  expires_at?: null | number | string;
  id: number | string;
  initial_amount: number | string;
  remaining_amount: number | string;
  source_tx_id: number | string;
  state: AssetLotState;
  updated_at: number | string;
}

export interface AssetBalanceView {
  asset_item: AssetItem;
  lots: AssetLot[];
  total_amount: number | string;
}

export interface BalanceGrantWrite {
  amount: number | string;
  asset_item_id: number | string;
  idempotency_key: string;
  reason?: string;
  source_id: string;
  source_type: string;
  valid_seconds?: null | number | string;
}

export interface BalanceSpendWrite {
  amount: number | string;
  asset_item_id: number | string;
  idempotency_key: string;
  reason?: string;
  source_id: string;
  source_type: string;
}

export interface AssetTx {
  acct_id: number | string;
  created_at: number | string;
  id: number | string;
  idempotency_key: string;
  kind: AssetTxKind;
  operator_uid?: null | number | string;
  reason: string;
  related_tx_id?: null | number | string;
  source_id: string;
  source_type: string;
}

export interface AssetEntry {
  acct_id: number | string;
  after_amount: number | string;
  asset_item_id: number | string;
  before_amount: number | string;
  created_at: number | string;
  delta: number | string;
  id: number | string;
  lot_id: number | string;
  tx_id: number | string;
}

export interface AssetTxView extends AssetTx {
  entries: AssetEntry[];
}

export interface AssetTxPageQuery extends PageQuery {
  created_range?: string;
  kind?: AssetTxKind;
  source_type?: string;
}

export interface AssetItemPageQuery extends PageQuery {
  code_prefix?: string;
  enabled?: boolean;
  ids?: Array<number | string>;
}

export const AssetApi = {
  list: (params?: AssetItemPageQuery) =>
    requestClient.get<Page<AssetItem>>('/asset/items', { params }),
  detail: (id: number | string) =>
    requestClient.get<AssetItem>(`/asset/items/${id}`),
  create: (data: AssetItemWrite) =>
    requestClient.post<AssetItem>('/asset/items', data),
  update: (id: number | string, data: AssetItemWrite) =>
    requestClient.put<AssetItem>(`/asset/items/${id}`, data),
  balances: (acctId: number | string) =>
    requestClient.get<AssetBalanceView[]>(`/asset/accounts/${acctId}/balances`),
  transactions: (acctId: number | string, params?: AssetTxPageQuery) =>
    requestClient.get<Page<AssetTxView>>(
      `/asset/accounts/${acctId}/transactions`,
      {
        params,
      },
    ),
  grant: (acctId: number | string, data: BalanceGrantWrite) =>
    requestClient.post<AssetTx>(
      `/asset/accounts/${acctId}/balances/grant`,
      data,
    ),
  spend: (acctId: number | string, data: BalanceSpendWrite) =>
    requestClient.post<AssetTx>(
      `/asset/accounts/${acctId}/balances/spend`,
      data,
    ),
};
