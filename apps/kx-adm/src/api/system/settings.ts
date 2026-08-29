import { encryptedRequestClient, requestClient } from '#/api/request';

export interface SystemSettings {
  copyright_text: string;
  display_name: string;
  login_banner_url: string;
  login_description: string;
  login_logo_url: string;
  login_title: string;
  meilisearch_credential_code: string;
  meilisearch_installation_id?: null | number | string;
  meilisearch_source: 'custom' | 'installation' | string;
  meilisearch_url: string;
  system_name: string;
}

export interface MfaKeyStatusView {
  configured: boolean;
  generated_at?: null | number | string;
  key_fingerprint?: null | string;
  updated_at?: null | number | string;
}

export type SystemSettingsImageField = 'login_banner_url' | 'login_logo_url';

export const SystemSettingsApi = {
  public: () =>
    encryptedRequestClient.get<SystemSettings>('/param/system-settings/public'),
  ensureMfaKey: () =>
    requestClient.post<MfaKeyStatusView>(
      '/param/system-settings/security/mfa-key/generate',
    ),
  get: () => requestClient.get<SystemSettings>('/param/system-settings'),
  mfaKeyStatus: () =>
    requestClient.get<MfaKeyStatusView>(
      '/param/system-settings/security/mfa-key',
    ),
  save: (data: SystemSettings) =>
    requestClient.put<SystemSettings>('/param/system-settings', data),
  uploadImage: (field: SystemSettingsImageField, file: File) =>
    requestClient.upload<SystemSettings>(
      `/param/system-settings/images/${field}`,
      { file },
    ),
};
