import type { Page, PageQuery } from './request';

import { plaintextRequestClient, requestClient } from './request';

export interface ImportExportDefinition {
  accepted_extensions: string[];
  code: string;
  direction: 'export' | 'import';
  display_name: string;
  input_modes: string[];
  max_file_size: number;
  options_schema: {
    properties?: Record<
      string,
      { default?: unknown; title?: string; type?: string }
    >;
    required?: string[];
  };
  version: number;
}

export type TransferRunStatus =
  | 'cancelled'
  | 'failed'
  | 'partially_succeeded'
  | 'running'
  | 'submit_failed'
  | 'submitted'
  | 'succeeded';

export interface TransferRun {
  created_at: number;
  definition_code: string;
  direction: 'export' | 'import';
  error_code?: null | string;
  error_message?: null | string;
  failed_count: number;
  finished_at?: null | number;
  has_errors: boolean;
  has_result: boolean;
  id: number | string;
  message: string;
  status: TransferRunStatus;
  succeeded_count: number;
  task_run_id?: null | number | string;
  total_count?: null | number;
  updated_at: number;
  expires_at: number;
}

export interface TransferRunListItem extends TransferRun {
  definition_name: string;
  error_file_name?: null | string;
  input_file_name?: null | string;
  result_file_name?: null | string;
}

export interface TransferRunQuery extends PageQuery {
  definition_code?: string;
  direction?: 'export' | 'import';
  status?: TransferRunStatus;
}

export const ImportExportApi = {
  runs: (params?: TransferRunQuery) =>
    requestClient.get<Page<TransferRunListItem>>('/import-export/runs', {
      params,
    }),
  runFile: (id: number | string, kind: 'errors' | 'input' | 'result') =>
    plaintextRequestClient.download<Blob>(
      `/import-export/runs/${id}/files/${kind}`,
    ),
  activeImportRun: (code: string) =>
    requestClient.get<null | TransferRun>(
      `/import-export/imports/${encodeURIComponent(code)}/active-run`,
    ),
  createImportRun: (code: string, file: File) =>
    plaintextRequestClient.upload<TransferRun>(
      `/import-export/imports/${encodeURIComponent(code)}/runs`,
      { file },
    ),
  activeExportRun: (code: string) =>
    requestClient.get<null | TransferRun>(
      `/import-export/exports/${encodeURIComponent(code)}/active-run`,
    ),
  createExportRun: (code: string, options: Record<string, unknown>) =>
    requestClient.post<TransferRun>(
      `/import-export/exports/${encodeURIComponent(code)}/runs`,
      options,
    ),
  definition: (code: string) =>
    requestClient.get<ImportExportDefinition>(
      `/import-export/definitions/${encodeURIComponent(code)}`,
    ),
  importRun: (code: string, id: number | string) =>
    requestClient.get<TransferRun>(
      `/import-export/imports/${encodeURIComponent(code)}/runs/${id}`,
    ),
  exportRun: (code: string, id: number | string) =>
    requestClient.get<TransferRun>(
      `/import-export/exports/${encodeURIComponent(code)}/runs/${id}`,
    ),
  exportFile: (code: string, id: number | string) =>
    plaintextRequestClient.download<Blob>(
      `/import-export/exports/${encodeURIComponent(code)}/runs/${id}/file`,
    ),
  template: (code: string) =>
    plaintextRequestClient.download<Blob>(
      `/import-export/imports/${encodeURIComponent(code)}/template`,
    ),
};
