import { requestClient } from '#/api/request';

export interface WmxtStorageSettingsView {
  private_storage_code?: string;
  public_storage_code?: string;
  ready: boolean;
}

export interface WmxtStorageSettingsWrite {
  private_storage_code: string;
  public_storage_code: string;
}

export interface WmxtAppearanceSettingsView {
  home_background_file_id: number | string;
  home_background_url: string;
  home_header_height: number;
  profile_background_file_id: number | string;
  profile_background_url: string;
  profile_header_height: number;
}

export interface WmxtAppearanceSettingsWrite {
  home_background_file_id: number;
  home_header_height: number;
  profile_background_file_id: number;
  profile_header_height: number;
}

export const WmxtStorageSettingsApi = {
  detail: () =>
    requestClient.get<WmxtStorageSettingsView>('/wmxt/admin/settings/storage'),
  update: (data: WmxtStorageSettingsWrite) =>
    requestClient.put<WmxtStorageSettingsView>(
      '/wmxt/admin/settings/storage',
      data,
    ),
};

export const WmxtAppearanceSettingsApi = {
  detail: () =>
    requestClient.get<WmxtAppearanceSettingsView>(
      '/wmxt/admin/settings/appearance',
    ),
  update: (data: WmxtAppearanceSettingsWrite) =>
    requestClient.put<WmxtAppearanceSettingsView>(
      '/wmxt/admin/settings/appearance',
      data,
    ),
};
