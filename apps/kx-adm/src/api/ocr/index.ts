import type { CredentialKind } from '#/api/credential';
import type { TaskRun } from '#/api/task';

import { requestClient } from '#/api/request';

export type OcrMode = 'ai' | 'local';
export type OcrProviderKind =
  | 'gemini_vision'
  | 'local_paddle'
  | 'openai_vision';
export type OcrModelState =
  | 'checksum_mismatch'
  | 'invalid_dir'
  | 'invalid_file'
  | 'missing'
  | 'ready';

export interface OcrProviderFieldSpec {
  label: string;
  name: string;
  required: boolean;
  secret: boolean;
}

export interface OcrProviderSpec {
  available?: boolean;
  description: string;
  fields: OcrProviderFieldSpec[];
  kind: OcrProviderKind;
  label: string;
  requires_credential: boolean;
  unavailable_reason?: string;
}

export interface OcrProvidersView {
  providers: OcrProviderSpec[];
}

export interface OcrModelFileStatus {
  actual_sha256?: null | string;
  exists: boolean;
  expected_sha256: string;
  file_name: string;
  valid: boolean;
}

export interface OcrModelStatus {
  files: OcrModelFileStatus[];
  message: string;
  model_dir: string;
  ready: boolean;
  state: OcrModelState;
  version: string;
}

export interface OcrSettingsView {
  default_provider: OcrProviderKind;
  enabled: boolean;
  gemini_base_url: string;
  gemini_credential_code: string;
  gemini_model: string;
  model_dir: string;
  model_status: OcrModelStatus;
  model_version: string;
  openai_base_url: string;
  openai_credential_code: string;
  openai_model: string;
  timeout_seconds: number;
}

export interface OcrSettingsWrite {
  default_provider: OcrProviderKind;
  enabled: boolean;
  gemini_base_url: string;
  gemini_credential_code: string;
  gemini_model: string;
  model_dir: string;
  openai_base_url: string;
  openai_credential_code: string;
  openai_model: string;
  timeout_seconds: number;
}

export const ocrAiCredentialKinds: CredentialKind[] = [
  'http_token',
  'http_header',
];

export const OcrApi = {
  checkModels: () =>
    requestClient.post<OcrModelStatus>('/ocr/models/actions/check'),
  downloadModels: () =>
    requestClient.post<TaskRun>('/ocr/models/actions/download'),
  providers: async () => {
    const response =
      await requestClient.get<OcrProvidersView>('/ocr/providers');
    return response.providers;
  },
  settings: () => requestClient.get<OcrSettingsView>('/ocr/settings'),
  updateSettings: (data: OcrSettingsWrite) =>
    requestClient.put<OcrSettingsView>('/ocr/settings', data),
};
