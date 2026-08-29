import type { SystemSettings } from '#/api/system/settings';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildPublicSystemSettingsPreferences,
  initPublicSystemSettings,
} from './system-settings-init';

const { publicSettings, updatePreferences } = vi.hoisted(() => ({
  publicSettings: vi.fn(),
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
});
