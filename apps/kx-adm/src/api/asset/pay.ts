import type { JsonValue, Page, PageQuery } from '#/api/request';

import { requestClient } from '#/api/request';

export type PayPlatform = 'android' | 'any' | 'ios' | 'web';
export type PayOrderState = 'cancelled' | 'paid' | 'pending' | 'refunded';
export type PayItemType = 'normal' | 'res_item' | 'res_total' | 'vip';

export interface PayTemplate {
  code: string;
  created_at: number | string;
  enabled: boolean;
  id: number | string;
  name: string;
  remark: string;
  updated_at: number | string;
}

export type PayDefaultTemplatePlatform = 'app' | 'web';

export interface PayDefaultTemplates {
  app?: null | PayTemplate;
  app_template_id?: null | number | string;
  web?: null | PayTemplate;
  web_template_id?: null | number | string;
}

export interface PayDefaultTemplateWrite {
  template_id: number | string;
}

export interface PayItemFbBackRule {
  back_percent: number | string;
  seq_num: number | string;
}

export interface PayItemExtInfo {
  fb_back: PayItemFbBackRule[];
  is_back: boolean;
}

export interface PayItem {
  amount_minor: number | string;
  back_amount_minor: number | string;
  back_percent: number | string;
  code: string;
  created_at: number | string;
  currency: string;
  cycle_day: number | string;
  display_config: JsonValue;
  enabled: boolean;
  ext_info: PayItemExtInfo;
  id: number | string;
  intro: string;
  is_sub: boolean;
  item_type: PayItemType;
  lang_info: JsonValue;
  platform: PayPlatform;
  remark: string;
  sort_no: number | string;
  summary: string;
  template_id: number | string;
  title: string;
  unlock_episode_count: number | string;
  updated_at: number | string;
}

export interface PayItemBalanceGrant {
  asset_item_id: number | string;
  pay_item_id: number | string;
  quantity: number | string;
  valid_seconds?: null | number | string;
}

export interface PayItemMembershipGrant {
  duration_seconds: number | string;
  membership_plan_id: number | string;
  pay_item_id: number | string;
}

export interface PaySku {
  created_at: number | string;
  enabled: boolean;
  id: number | string;
  pay_item_id: number | string;
  product_id: string;
  product_name: string;
  provider: string;
  provider_metadata: JsonValue;
  subscription: boolean;
  updated_at: number | string;
}

export interface PaySkuWrite {
  enabled?: boolean;
  pay_item_id: number | string;
  product_id: string;
  product_name: string;
  provider: string;
  provider_metadata?: JsonValue;
  subscription?: boolean;
}

export interface PayItemView {
  balance_grants: PayItemBalanceGrant[];
  item: PayItem;
  membership_grants: PayItemMembershipGrant[];
  skus: PaySku[];
}

export interface ProductBalanceGrantSnapshot {
  asset_item_id: number | string;
  quantity: number | string;
  valid_seconds?: null | number | string;
}

export interface ProductMembershipGrantSnapshot {
  duration_seconds: number | string;
  membership_plan_id: number | string;
}

export interface ProductSnapshot {
  amount_minor: number | string;
  back_amount_minor: number | string;
  back_percent: number | string;
  balance_grants: ProductBalanceGrantSnapshot[];
  currency: string;
  cycle_day: number | string;
  display_config: JsonValue;
  ext_info: PayItemExtInfo;
  is_sub: boolean;
  item_code: string;
  item_type: PayItemType;
  lang_info: JsonValue;
  membership_grants: ProductMembershipGrantSnapshot[];
  provider_product_id: string;
  provider_subscription: boolean;
  summary: string;
  title: string;
  unlock_episode_count: number | string;
}

export interface PayOrder {
  acct_id: number | string;
  attribution_uid?: null | number | string;
  client_ip?: null | string;
  content_id?: null | number | string;
  content_purchase_seq?: null | number | string;
  country_code?: null | string;
  created_at: number | string;
  environment?: null | string;
  episode_id?: null | number | string;
  id: number | string;
  idempotency_key: string;
  link_id?: null | number | string;
  paid_at?: null | number | string;
  pay_item_id: number | string;
  platform?: null | string;
  product_snapshot: ProductSnapshot;
  provider: string;
  provider_metadata: JsonValue;
  provider_order_id?: null | string;
  refunded_at?: null | number | string;
  remark?: null | string;
  state: PayOrderState;
  updated_at: number | string;
  user_purchase_seq?: null | number | string;
}

export interface PayOrderCurrencySummary {
  currency: string;
  order_amount_minor: number | string;
  paid_amount_minor: number | string;
  refunded_amount_minor: number | string;
}

export interface PayOrderSummary {
  amounts: PayOrderCurrencySummary[];
  order_count: number | string;
  paid_count: number | string;
  refunded_count: number | string;
}

export interface PayOrderTaskWrite {
  message?: string;
  payload?: JsonValue;
}

export interface PayTemplateWrite {
  code: string;
  enabled?: boolean;
  name: string;
  remark?: string;
}

export interface PayItemBalanceGrantWrite {
  asset_item_id: number | string;
  quantity: number | string;
  valid_seconds?: null | number | string;
}

export interface PayItemMembershipGrantWrite {
  duration_seconds: number | string;
  membership_plan_id: number | string;
}

export interface PayItemWrite {
  amount_minor: number | string;
  back_amount_minor?: number | string;
  back_percent?: number | string;
  balance_grants?: PayItemBalanceGrantWrite[];
  code: string;
  currency: string;
  cycle_day?: number | string;
  display_config?: JsonValue;
  enabled?: boolean;
  ext_info?: PayItemExtInfo;
  intro?: string;
  is_sub?: boolean;
  item_type?: PayItemType;
  lang_info?: JsonValue;
  membership_grants?: PayItemMembershipGrantWrite[];
  platform: PayPlatform;
  remark?: string;
  sort_no?: number | string;
  summary?: string;
  template_id: number | string;
  title: string;
  unlock_episode_count?: number | string;
}

export interface PayTemplatePageQuery extends PageQuery {
  code_prefix?: string;
  enabled?: boolean;
}

export interface PayItemPageQuery extends PageQuery {
  code_prefix?: string;
  enabled?: boolean;
  is_sub?: boolean;
  item_type?: PayItemType;
  template_id?: number | string;
}

export interface PaySkuPageQuery extends PageQuery {
  enabled?: boolean;
  pay_item_id?: number | string;
  product_id?: string;
  product_name_prefix?: string;
  provider?: string;
  subscription?: boolean;
}

export interface PayOrderPageQuery extends PageQuery {
  acct_id?: number | string;
  attribution_uid?: number | string;
  content_id?: number | string;
  country_code?: string;
  created_range?: string;
  environment?: string;
  episode_id?: number | string;
  idempotency_key?: string;
  link_id?: number | string;
  pay_item_id?: number | string;
  platform?: string;
  provider?: string;
  provider_order_id?: string;
  state?: PayOrderState;
}

export const PayApi = {
  templateList: (params?: PayTemplatePageQuery) =>
    requestClient.get<Page<PayTemplate>>('/asset/pay/templates', { params }),
  createTemplate: (data: PayTemplateWrite) =>
    requestClient.post<PayTemplate>('/asset/pay/templates', data),
  updateTemplate: (id: number | string, data: PayTemplateWrite) =>
    requestClient.put<PayTemplate>(`/asset/pay/templates/${id}`, data),
  defaultTemplates: () =>
    requestClient.get<PayDefaultTemplates>('/asset/pay/templates/defaults'),
  setDefaultTemplate: (
    platform: PayDefaultTemplatePlatform,
    data: PayDefaultTemplateWrite,
  ) =>
    requestClient.put<PayDefaultTemplates>(
      `/asset/pay/templates/defaults/${platform}`,
      data,
    ),
  itemList: (params?: PayItemPageQuery) =>
    requestClient.get<Page<PayItem>>('/asset/pay/items', { params }),
  item: (id: number | string) =>
    requestClient.get<PayItemView>(`/asset/pay/items/${id}`),
  createItem: (data: PayItemWrite) =>
    requestClient.post<PayItemView>('/asset/pay/items', data),
  updateItem: (id: number | string, data: PayItemWrite) =>
    requestClient.put<PayItemView>(`/asset/pay/items/${id}`, data),
  skuList: (params?: PaySkuPageQuery) =>
    requestClient.get<Page<PaySku>>('/asset/pay/skus', { params }),
  sku: (id: number | string) =>
    requestClient.get<PaySku>(`/asset/pay/skus/${id}`),
  createSku: (data: PaySkuWrite) =>
    requestClient.post<PaySku>('/asset/pay/skus', data),
  updateSku: (id: number | string, data: PaySkuWrite) =>
    requestClient.put<PaySku>(`/asset/pay/skus/${id}`, data),
  removeSku: (id: number | string) =>
    requestClient.delete<boolean>(`/asset/pay/skus/${id}`),
  orderList: (params?: PayOrderPageQuery) =>
    requestClient.get<Page<PayOrder>>('/asset/pay/orders', { params }),
  orderSummary: (params?: PayOrderPageQuery) =>
    requestClient.get<PayOrderSummary>('/asset/pay/orders/summary', { params }),
  refundOrderTask: (id: number | string, data: PayOrderTaskWrite = {}) =>
    requestClient.post(`/asset/pay/orders/${id}/refund-tasks`, data),
  recoveryOrderTask: (id: number | string, data: PayOrderTaskWrite = {}) =>
    requestClient.post(`/asset/pay/orders/${id}/recovery-tasks`, data),
};

export type { MembershipPolicy } from './membership';
