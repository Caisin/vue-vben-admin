import type { SystemSettings } from '#/api/system/settings';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  applyPublicSystemSettings,
  buildPublicSystemSettingsPreferences,
  initPublicSystemSettings,
} from './system-settings-init';

const { publicSettings, storageUrl, updatePreferences } = vi.hoisted(() => ({
  publicSettings: vi.fn(),
  storageUrl: vi.fn(),
  updatePreferences: vi.fn(),
}));

vi.mock('@vben/preferences', () => ({
  preferences: {
    app: { name: 'Fallback App' },
    logo: { source: '/fallback-logo.png' },
  },
  updatePreferences,
}));

vi.mock('#/api/system/settings', () => ({
  SystemSettingsApi: {
    public: publicSettings,
  },
}));

vi.mock('#/api/storage', () => ({
  StorageFileApi: { url: storageUrl },
}));

const baseSettings: SystemSettings = {
  copyright_text: '© KX',
  display_name: 'KX Admin',
  login_banner_url: '/banner.png',
  login_description: '安全登录',
  login_logo_url: '/logo.png',
  login_title: '欢迎登录',
  system_name: 'kx-adm',
  meilisearch_url: '',
  meilisearch_source: 'custom',
  meilisearch_installation_id: null,
  meilisearch_credential_code: '',
};

describe('public system settings init', () => {
  beforeEach(() => {
    updatePreferences.mockClear();
    publicSettings.mockReset();
    storageUrl.mockReset();
  });

  it('maps public settings to app name and light/dark logo preferences', async () => {
    expect(buildPublicSystemSettingsPreferences(baseSettings)).toEqual({
      app: { name: 'kx-adm' },
      logo: { source: '/logo.png', sourceDark: '/logo.png' },
    });
  });

  it('uses display_name when system_name is blank', async () => {
    expect(
      buildPublicSystemSettingsPreferences({
        ...baseSettings,
        system_name: ' ',
      }).app.name,
    ).toBe('KX Admin');
  });

  it('loads settings without rethrowing failures', async () => {
    publicSettings.mockRejectedValueOnce(new Error('network down'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(initPublicSystemSettings()).resolves.toBeUndefined();
    expect(updatePreferences).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('applies loaded settings to preferences', async () => {
    publicSettings.mockResolvedValueOnce(baseSettings);
    await initPublicSystemSettings();

    expect(updatePreferences).toHaveBeenCalledWith({
      app: { name: 'kx-adm' },
      logo: { source: '/logo.png', sourceDark: '/logo.png' },
    });
  });

  it('does not use a storage file id as an image URL before login', () => {
    expect(
      buildPublicSystemSettingsPreferences({
        ...baseSettings,
        login_logo_url: '107',
      }),
    ).toEqual({ app: { name: 'kx-adm' } });
  });

  it('resolves a storage file id after login', async () => {
    storageUrl.mockResolvedValueOnce('blob:http://localhost/logo');
    await applyPublicSystemSettings(
      { ...baseSettings, login_logo_url: '107' },
      true,
    );

    expect(storageUrl).toHaveBeenCalledWith('107');
    expect(updatePreferences).toHaveBeenLastCalledWith({
      app: { name: 'kx-adm' },
      logo: {
        source: 'blob:http://localhost/logo',
        sourceDark: 'blob:http://localhost/logo',
      },
    });
  });
});
