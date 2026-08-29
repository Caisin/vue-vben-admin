import type { JsonValue, Page, PageQuery } from '#/api/request';

import { requestClient } from '#/api/request';

export type MallProductStatus = 'draft' | 'off_shelf' | 'published';
export type MallFulfillmentType = 'physical_delivery' | 'pickup' | 'virtual';
export type MallInventoryTxKind = 'decrease' | 'increase' | 'release' | 'sale';
export type MallJobType =
  | 'order_export'
  | 'product_import'
  | 'shipment_import'
  | 'virtual_code_import';
export type MallJobStatus =
  | 'cancelled'
  | 'dispatch_failed'
  | 'empty'
  | 'failed'
  | 'partially_succeeded'
  | 'running'
  | 'submitting'
  | 'succeeded';

export type MallOrderStatus =
  | 'cancelled'
  | 'completed'
  | 'fulfilling'
  | 'paid'
  | 'ready_for_pickup'
  | 'refunded'
  | 'shipped';
export type MallRefundState = 'full' | 'none' | 'partial';
export type MallAfterSaleStatus =
  | 'approved'
  | 'cancelled'
  | 'completed'
  | 'received'
  | 'refunding'
  | 'rejected'
  | 'requested'
  | 'returning';

export interface MallJobView {
  created_at: number | string;
  created_by: number | string;
  dispatch_biz_key: string;
  error_summary?: null | string;
  failed_count: number | string;
  finished_at?: null | number | string;
  id: number | string;
  idempotency_key: string;
  input_file_id?: null | number | string;
  job_type: MallJobType;
  output_file_id?: null | number | string;
  progress_json: JsonValue;
  skipped_count: number | string;
  sku_id?: null | number | string;
  status: MallJobStatus;
  succeeded_count: number | string;
  task_run_id?: null | number | string;
  total_count: number | string;
  updated_at: number | string;
}

export interface MallJobCreateRequest {
  idempotency_key: string;
  input_file_id?: null | number | string;
  job_type: MallJobType;
  params?: JsonValue;
  sku_id?: null | number | string;
}

export interface MallJobDispatchView {
  duplicate: boolean;
  empty: boolean;
  job: MallJobView;
  message: string;
}

export interface MallJobPageQuery extends PageQuery {
  created_by?: number | string;
  job_type?: MallJobType;
  status?: MallJobStatus;
}

export interface MallAfterSaleView {
  after_sale_no: string;
  created_at: number | string;
  description_summary: string;
  file_count: number;
  id: number | string;
  order_id: number | string;
  reason_code: string;
  received_at?: null | number | string;
  refund_points: number | string;
  refund_tx_id?: null | number | string;
  refunded_at?: null | number | string;
  return_required: boolean;
  return_tracking_mask?: null | string;
  review_remark?: null | string;
  reviewed_by?: null | number | string;
  shipped_at?: null | number | string;
  status: MallAfterSaleStatus;
  updated_at: number | string;
  user_id: number | string;
}

export interface MallAfterSaleItemView {
  after_sale_id: number | string;
  id: number | string;
  order_item_id: number | string;
  points_refund: number | string;
  quantity: number | string;
}

export interface MallAfterSaleDetailView {
  after_sale: MallAfterSaleView;
  items: MallAfterSaleItemView[];
}

export interface MallAdminAfterSalePageQuery extends PageQuery {
  after_sale_no?: string;
  order_id?: number | string;
  status?: MallAfterSaleStatus;
  user_id?: number | string;
}

export interface MallAfterSaleReviewWrite {
  remark: string;
}

export interface MallAfterSaleRefundWrite {
  force_virtual_refund: boolean;
  reason: string;
}

export interface MallOrderItemView {
  fulfillment_summary?: string;
  fulfillment_type: MallFulfillmentType;
  id: number | string;
  points_price: number | string;
  points_total: number | string;
  product_id: number | string;
  product_name: string;
  quantity: number | string;
  refunded_points?: number | string;
  refunded_quantity?: number | string;
  sku_id: number | string;
  sku_name: string;
  virtual_code_mask?: null | string;
}

export interface MallShipmentView {
  carrier_name: string;
  created_at?: number | string;
  id: number | string;
  shipped_at?: null | number | string;
  signed_at?: null | number | string;
  status: string;
  tracking_no_mask: string;
}

export interface MallOrderEventView {
  created_at: number | string;
  event_type: string;
  id: number | string;
  remark?: null | string;
}

export interface MallAdminOrder {
  address_masked?: null | string;
  cancelable?: boolean;
  created_at: number | string;
  fulfillment_type: MallFulfillmentType;
  id: number | string;
  items?: MallOrderItemView[];
  order_no: string;
  pickup_code_mask?: null | string;
  points_total: number | string;
  refund_state: MallRefundState;
  status: MallOrderStatus;
  uid?: number | string;
  updated_at?: number | string;
}

export interface MallAdminOrderDetailView extends MallAdminOrder {
  address_masked?: null | string;
  events?: MallOrderEventView[];
  shipments?: MallShipmentView[];
}

interface MallAdminOrderDetailResponse extends MallAdminOrder {
  detail?: {
    address_masked?: null | string;
    events?: MallOrderEventView[];
    items: MallOrderItemView[];
    order: MallAdminOrder;
    shipments?: MallShipmentView[];
  };
}

export interface MallAdminOrderPageQuery extends PageQuery {
  fulfillment_type?: MallFulfillmentType;
  keyword?: string;
  status?: MallOrderStatus;
  uid?: number | string;
}

export interface MallShipOrderWrite {
  carrier: string;
  items: Array<{ order_item_id: number | string; quantity: number | string }>;
  tracking_no: string;
}

export interface MallAdminRevealWrite {
  totp_code: string;
}

export interface MallAdminAddressRevealView {
  address: {
    city: string;
    detail: string;
    district: string;
    name: string;
    phone: string;
    province: string;
  };
  order_id: number | string;
}

export interface MallAdminTrackingRevealView {
  carrier_name: string;
  id: number | string;
  tracking_no: string;
}

export interface MallDashboardView {
  category_count: number | string;
  low_stock_count: number | string;
  product_count: number | string;
  published_product_count: number | string;
  sku_count: number | string;
}

export interface MallCategory {
  children?: MallCategory[];
  code: string;
  created_at?: number | string;
  deleted_at?: number | string;
  icon_file_id?: null | number | string;
  icon_url?: null | string;
  id: number | string;
  name: string;
  parent_id?: null | number | string;
  sort_order: number | string;
  status: MallProductStatus;
  updated_at: number | string;
}

export interface MallCategoryWrite {
  code: string;
  icon_file_id?: null | number | string;
  name: string;
  parent_id?: null | number | string;
  sort_order?: number | string;
  status?: MallProductStatus;
}

export interface MallSkuSpec {
  name: string;
  value: string;
}

export interface MallSku {
  code: string;
  created_at?: number | string;
  fulfillment_type: MallFulfillmentType;
  id: number | string;
  name: string;
  per_user_limit?: null | number | string;
  points_price: number | string;
  product_id: number | string;
  specs: MallSkuSpec[];
  status: MallProductStatus;
}

export interface MallSkuWrite {
  code: string;
  fulfillment_type: MallFulfillmentType;
  name: string;
  per_user_limit?: null | number | string;
  points_price: number | string;
  product_id: number | string;
  specs?: MallSkuSpec[];
  status?: MallProductStatus;
}

export interface MallProduct {
  category_id: number | string;
  code: string;
  cover_file_id?: null | number | string;
  created_at?: number | string;
  deleted_at?: number | string;
  detail_json?: JsonValue;
  featured: boolean;
  gallery_file_ids?: Array<number | string>;
  id: number | string;
  name: string;
  published_at?: null | number | string;
  status: MallProductStatus;
  subtitle: string;
}

export interface MallProductDetailView {
  product: MallProduct;
  skus: MallSku[];
}

export interface MallProductWrite {
  category_id: number | string;
  code: string;
  cover_file_id?: null | number | string;
  detail_json?: JsonValue;
  featured?: boolean;
  gallery_file_ids?: Array<number | string>;
  name: string;
  subtitle: string;
}

export interface MallProductPageQuery extends PageQuery {
  category_id?: number | string;
  keyword?: string;
  status?: MallProductStatus;
}

export interface MallInventoryView {
  available_stock: number | string;
  id: number | string;
  sku_id: number | string;
  sold_stock: number | string;
  updated_at: number | string;
}

export interface MallInventoryPageQuery extends PageQuery {
  keyword?: string;
  product_id?: number | string;
  sku_id?: number | string;
}

export interface MallInventoryAdjustWrite {
  delta: number | string;
  reason: string;
}

export interface MallInventoryAdjustView {
  after_available_stock: number | string;
  before_available_stock: number | string;
  inventory: MallInventoryView;
  tx_id: number | string;
}

export interface MallInventoryTx {
  after_available_stock: number | string;
  after_sold_stock: number | string;
  before_available_stock: number | string;
  before_sold_stock: number | string;
  business_key: string;
  created_at: number | string;
  id: number | string;
  kind: MallInventoryTxKind;
  operator_uid?: null | number | string;
  order_id?: null | number | string;
  quantity: number | string;
  reason: string;
  sku_id: number | string;
}

export interface MallInventoryLogPageQuery extends PageQuery {
  kind?: MallInventoryTxKind;
  sku_id?: number | string;
}

export interface MallSettings {
  after_sale_days: number | string;
  auto_complete_days: number | string;
  enabled: boolean;
  low_stock_threshold: number | string;
  mall_name: string;
  notice: string;
  pickup_token_minutes: number | string;
  public_storage_code?: null | string;
  version: number | string;
}

export type MallSettingsWrite = Omit<MallSettings, 'version'> & {
  expected_version: number | string;
  public_storage_code: string;
};

export const MallAdminApi = {
  dashboard: () =>
    requestClient.get<MallDashboardView>('/mall/admin/dashboard'),
  jobs: (params?: MallJobPageQuery) =>
    requestClient.get<Page<MallJobView>>('/mall/admin/jobs', { params }),
  job: (id: number | string) =>
    requestClient.get<MallJobView>(`/mall/admin/jobs/${id}`),
  createJob: (data: MallJobCreateRequest) =>
    requestClient.post<MallJobDispatchView>('/mall/admin/jobs', data),
  categories: () => requestClient.get<MallCategory[]>('/mall/admin/categories'),
  createCategory: (data: MallCategoryWrite) =>
    requestClient.post<MallCategory>('/mall/admin/categories', data),
  updateCategory: (id: number | string, data: MallCategoryWrite) =>
    requestClient.put<MallCategory>(`/mall/admin/categories/${id}`, data),
  removeCategory: (id: number | string) =>
    requestClient.delete<boolean>(`/mall/admin/categories/${id}`),
  products: (params?: MallProductPageQuery) =>
    requestClient.get<Page<MallProduct>>('/mall/admin/products', { params }),
  product: (id: number | string) =>
    requestClient.get<MallProductDetailView>(`/mall/admin/products/${id}`),
  createProduct: (data: MallProductWrite) =>
    requestClient.post<MallProduct>('/mall/admin/products', data),
  updateProduct: (id: number | string, data: MallProductWrite) =>
    requestClient.put<MallProduct>(`/mall/admin/products/${id}`, data),
  removeProduct: (id: number | string) =>
    requestClient.delete<boolean>(`/mall/admin/products/${id}`),
  publishProduct: (id: number | string) =>
    requestClient.post<MallProduct>(`/mall/admin/products/${id}/publish`),
  unpublishProduct: (id: number | string) =>
    requestClient.post<MallProduct>(`/mall/admin/products/${id}/unpublish`),
  createSku: (data: MallSkuWrite) =>
    requestClient.post<MallSku>('/mall/admin/skus', data),
  updateSku: (id: number | string, data: MallSkuWrite) =>
    requestClient.put<MallSku>(`/mall/admin/skus/${id}`, data),
  removeSku: (id: number | string) =>
    requestClient.delete<boolean>(`/mall/admin/skus/${id}`),
  inventory: (params?: MallInventoryPageQuery) =>
    requestClient.get<Page<MallInventoryView>>('/mall/admin/inventory', {
      params,
    }),
  inventoryLogs: (params?: MallInventoryLogPageQuery) =>
    requestClient.get<Page<MallInventoryTx>>('/mall/admin/inventory/logs', {
      params,
    }),
  adjustInventory: (sku_id: number | string, data: MallInventoryAdjustWrite) =>
    requestClient.post<MallInventoryAdjustView>(
      `/mall/admin/inventory/${sku_id}/adjust`,
      data,
    ),
  settings: () => requestClient.get<MallSettings>('/mall/admin/settings'),
  updateSettings: (data: MallSettingsWrite) =>
    requestClient.put<MallSettings>('/mall/admin/settings', data),

  afterSales: (params?: MallAdminAfterSalePageQuery) =>
    requestClient.get<Page<MallAfterSaleView>>('/mall/admin/after-sales', {
      params,
    }),
  afterSale: (id: number | string) =>
    requestClient.get<MallAfterSaleDetailView>(`/mall/admin/after-sales/${id}`),
  approveAfterSale: (id: number | string, data: MallAfterSaleReviewWrite) =>
    requestClient.post<MallAfterSaleDetailView>(
      `/mall/admin/after-sales/${id}/approve`,
      data,
    ),
  rejectAfterSale: (id: number | string, data: MallAfterSaleReviewWrite) =>
    requestClient.post<MallAfterSaleDetailView>(
      `/mall/admin/after-sales/${id}/reject`,
      data,
    ),
  receiveAfterSale: (id: number | string) =>
    requestClient.post<MallAfterSaleDetailView>(
      `/mall/admin/after-sales/${id}/receive`,
    ),
  refundAfterSale: (id: number | string, data: MallAfterSaleRefundWrite) =>
    requestClient.post<MallAfterSaleDetailView>(
      `/mall/admin/after-sales/${id}/refund`,
      data,
    ),

  orders: (params?: MallAdminOrderPageQuery) =>
    requestClient.get<Page<MallAdminOrder>>('/mall/admin/orders', { params }),
  order: async (id: number | string) => {
    const response = await requestClient.get<MallAdminOrderDetailResponse>(
      `/mall/admin/orders/${id}`,
    );
    return {
      ...response,
      ...response.detail?.order,
      address_masked:
        response.detail?.address_masked ?? response.address_masked,
      events: response.detail?.events || [],
      items: response.detail?.items || [],
      shipments: response.detail?.shipments || [],
    } as MallAdminOrderDetailView;
  },
  shipOrder: (id: number | string, data: MallShipOrderWrite) =>
    requestClient.post<MallShipmentView>(`/mall/admin/orders/${id}/ship`, data),
  readyOrder: (id: number | string) =>
    requestClient.post<boolean>(`/mall/admin/orders/${id}/ready`),
  pickupOrder: (id: number | string, token: string) =>
    requestClient.post<boolean>(`/mall/admin/orders/${id}/pickup`, { token }),
  completeOrder: (id: number | string) =>
    requestClient.post<boolean>(`/mall/admin/orders/${id}/complete`),
  cancelOrder: (id: number | string, reason?: string) =>
    requestClient.post<boolean>(`/mall/admin/orders/${id}/cancel`, { reason }),
  revealOrderAddress: (id: number | string, stepUpToken: string) =>
    requestClient.post<MallAdminAddressRevealView>(
      `/mall/admin/orders/${id}/address-reveal`,
      undefined,
      { headers: { 'X-Kx-Step-Up-Token': stepUpToken } },
    ),
  revealShipmentTracking: (id: number | string, stepUpToken: string) =>
    requestClient.post<MallAdminTrackingRevealView>(
      `/mall/admin/shipments/${id}/tracking-reveal`,
      undefined,
      { headers: { 'X-Kx-Step-Up-Token': stepUpToken } },
    ),
};
