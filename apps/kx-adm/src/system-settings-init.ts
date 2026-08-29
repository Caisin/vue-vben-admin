import type { SystemSettings } from '#/api/system/settings';

import { computed, readonly, ref } from 'vue';

import { preferences, updatePreferences } from '@vben/preferences';

import { SystemSettingsApi } from '#/api/system/settings';

const settings = ref<SystemSettings>();
let loadPromise: Promise<SystemSettings | undefined> | undefined;

function trimText(value: string | undefined) {
  const text = value?.trim();
  return text || undefined;
}

function resolveDisplayName(value: SystemSettings | undefined) {
  return (
    trimText(value?.display_name) ??
    trimText(value?.system_name) ??
    preferences.app.name
  );
}

function resolveSystemName(value: SystemSettings | undefined) {
  return (
    trimText(value?.system_name) ??
    trimText(value?.display_name) ??
    preferences.app.name
  );
}

function resolveLogo(value: SystemSettings | undefined) {
  return trimText(value?.login_logo_url) ?? preferences.logo.source;
}

export function buildPublicSystemSettingsPreferences(value: SystemSettings) {
  const logo = trimText(value.login_logo_url);

  return {
    app: {
      name: resolveSystemName(value),
    },
    ...(logo
      ? {
          logo: {
            source: logo,
            sourceDark: logo,
          },
        }
      : {}),
  };
}

export function applyPublicSystemSettings(value: SystemSettings) {
  settings.value = value;
  updatePreferences(buildPublicSystemSettingsPreferences(value));
}

export async function loadPublicSystemSettings() {
  if (!loadPromise) {
    loadPromise = SystemSettingsApi.public()
      .then((value) => {
        applyPublicSystemSettings(value);
        return value;
      })
      .catch((error) => {
        console.warn('Failed to load public system settings:', error);
        return undefined;
      })
      .finally(() => {
        loadPromise = undefined;
      });
  }
  return loadPromise;
}

export const initPublicSystemSettings = loadPublicSystemSettings;
export const publicSystemSettings = readonly(settings);

export const systemSettingsState = {
  appName: computed(() => resolveDisplayName(settings.value)),
  copyrightText: computed(() => trimText(settings.value?.copyright_text) ?? ''),
  logo: computed(() => resolveLogo(settings.value)),
  pageDescription: computed(
    () => trimText(settings.value?.login_description) ?? '安全登录后继续',
  ),
  pageTitle: computed(
    () => trimText(settings.value?.login_title) ?? 'KX 管理后台',
  ),
  settings: publicSystemSettings,
  sloganImage: computed(() => trimText(settings.value?.login_banner_url) ?? ''),
};
