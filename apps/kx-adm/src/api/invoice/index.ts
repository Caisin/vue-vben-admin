import type { Page, PageQuery } from '#/api/request';
import type { TaskRun } from '#/api/task';

import { plaintextRequestClient, requestClient } from '#/api/request';

export type InvoiceParseState = 'failed' | 'needs_review' | 'parsed';
export type InvoiceExportScope = 'filtered' | 'selected';
export type InvoiceExportState =
  | 'cancelled'
  | 'failed'
  | 'pending'
  | 'running'
  | 'succeeded';

export interface InvoiceListQuery extends PageQuery {
  buyer_name?: string;
  invoice_date_range?: [string, string];
  invoice_no?: string;
  invoice_type?: string;
  keyword?: string;
  seller_name?: string;
  submitted_to_finance?: boolean;
  uid?: number | string;
  uploaded_range?: [number | string, number | string];
}

export interface InvoiceLineItemView {
  amount: string;
  amount_tax: string;
  is_discount: boolean;
  project_name: string;
  quantity?: null | string;
  specification: string;
  tax_amount: string;
  tax_rate: string;
  unit: string;
  unit_price?: null | string;
}

export interface InvoiceItemView {
  _row_key?: string;
  amount_no_tax: string;
  amount_tax: string;
  amount_uppercase: string;
  buyer_credit_code: string;
  buyer_name: string;
  duplicate_user_count: number | string;
  invoice_clerk: string;
  invoice_date: string;
  invoice_id: number | string;
  invoice_no: string;
  invoice_type: string;
  line_items: InvoiceLineItemView[];
  original_file_name: string;
  parse_source: string;
  seller_credit_code: string;
  seller_name: string;
  source_page_index: number;
  submitted_at?: null | number | string;
  submitted_to_finance: boolean;
  tax_amount: string;
  tax_rate: string;
  uid: number | string;
  upload_id: number | string;
  uploaded_at: number | string;
}

export interface InvoiceUploadView {
  file_name: string;
  invoices: InvoiceItemView[];
  message: string;
  other_user_count: number | string;
  parse_state: InvoiceParseState;
  same_user_duplicate: boolean;
  upload_id: number | string;
  used_by_other_users: boolean;
}

export interface InvoiceStatisticsView {
  amount_tax_total: string;
  needs_review_count: number | string;
  submitted_count: number | string;
  tax_amount_total: string;
  total_count: number | string;
  unsubmitted_count: number | string;
}

export interface InvoiceDuplicateUserView {
  original_file_name: string;
  submitted_to_finance: boolean;
  uid: number | string;
  uploaded_at: number | string;
  user_name: string;
}

export interface InvoiceUpdateWrite {
  amount_no_tax: string;
  amount_tax: string;
  amount_uppercase: string;
  buyer_credit_code: string;
  buyer_name: string;
  invoice_clerk: string;
  invoice_date: string;
  invoice_no: string;
  invoice_type: string;
  line_items: InvoiceLineItemView[];
  seller_credit_code: string;
  seller_name: string;
  tax_amount: string;
  tax_rate: string;
}

export interface InvoiceReferenceKey {
  invoice_id: number | string;
  uid: number | string;
}

export interface InvoiceExportCreateWrite {
  filter?: InvoiceListQuery;
  mark_submitted_to_finance?: boolean;
  scope: InvoiceExportScope;
  selected?: InvoiceReferenceKey[];
}

export interface InvoiceExportView {
  actual_count: number | string;
  completed_at?: null | number | string;
  created_at: number | string;
  error_message: string;
  id: number | string;
  mark_submitted_to_finance: boolean;
  output_file_id?: null | number | string;
  scope: InvoiceExportScope;
  state: InvoiceExportState;
  task_run_id?: null | number | string;
  uid: number | string;
  updated_at: number | string;
}

export interface InvoiceExportDispatchView {
  duplicate: boolean;
  export: InvoiceExportView;
  message: string;
  task_run?: null | TaskRun;
}

export const InvoiceApi = {
  detail: (id: number | string, uid?: number | string) =>
    requestClient.get<InvoiceItemView>(`/invoice/items/${id}`, {
      params: { uid },
    }),
  duplicateUsers: (id: number | string) =>
    requestClient.get<InvoiceDuplicateUserView[]>(
      `/invoice/items/${id}/duplicate-users`,
    ),
  exportContent: (id: number | string) =>
    plaintextRequestClient.download<Blob>(`/invoice/exports/${id}/content`),
  exportDetail: (id: number | string) =>
    requestClient.get<InvoiceExportView>(`/invoice/exports/${id}`),
  fileContent: (id: number | string) =>
    plaintextRequestClient.download<Blob>(`/invoice/files/${id}/content`),
  list: (params?: InvoiceListQuery) =>
    requestClient.get<Page<InvoiceItemView>>('/invoice/items', { params }),
  statistics: (params?: InvoiceListQuery) =>
    requestClient.get<InvoiceStatisticsView>('/invoice/statistics', {
      params,
    }),
  update: (id: number | string, data: InvoiceUpdateWrite) =>
    requestClient.put<InvoiceItemView>(`/invoice/items/${id}`, data),
  uploadFiles: async (files: File[]) => {
    const results = await Promise.all(
      files.map((file) =>
        plaintextRequestClient.upload<InvoiceUploadView[]>('/invoice/files', {
          file,
        }),
      ),
    );
    return results.flat();
  },
  createExport: (data: InvoiceExportCreateWrite) =>
    requestClient.post<InvoiceExportDispatchView>('/invoice/exports', data),
};
