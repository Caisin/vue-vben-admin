import type { SystemSettings } from '#/api/system/settings';

import { computed, readonly, ref } from 'vue';

import { preferences, updatePreferences } from '@vben/preferences';

import { StorageFileApi } from '#/api/storage';
import { SystemSettingsApi } from '#/api/system/settings';

const settings = ref<SystemSettings>();
const resolvedLogo = ref('');
const resolvedSloganImage = ref('');
let loadPromise: Promise<SystemSettings | undefined> | undefined;

function trimText(value: string | undefined) {
  const text = value?.trim();
  return text || undefined;
}

function isImageUrl(value: string | undefined) {
  return Boolean(value && /^(?:blob:|data:|https?:\/\/|\/)/i.test(value));
}

function configuredLogo(value: SystemSettings | undefined) {
  const logo = trimText(value?.login_logo_url);
  return isImageUrl(logo) ? logo : resolvedLogo.value || undefined;
}

function resolveStoredImage(value: string) {
  if (!value.trim()) return Promise.resolve('');
  return isImageUrl(value) ? Promise.resolve(value) : StorageFileApi.url(value);
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
  return configuredLogo(value) ?? preferences.logo.source;
}

export function buildPublicSystemSettingsPreferences(value: SystemSettings) {
  const logo = configuredLogo(value);

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

export async function applyPublicSystemSettings(
  value: SystemSettings,
  resolveStoredFiles = false,
) {
  for (const current of [resolvedLogo.value, resolvedSloganImage.value]) {
    if (current.startsWith('blob:')) URL.revokeObjectURL(current);
  }
  settings.value = value;
  resolvedLogo.value = '';
  resolvedSloganImage.value = '';
  if (resolveStoredFiles) {
    const [logo, slogan] = await Promise.allSettled([
      resolveStoredImage(value.login_logo_url),
      resolveStoredImage(value.login_banner_url),
    ]);
    if (logo.status === 'fulfilled') resolvedLogo.value = logo.value;
    if (slogan.status === 'fulfilled') resolvedSloganImage.value = slogan.value;
  }
  updatePreferences(buildPublicSystemSettingsPreferences(value));
}

export async function loadPublicSystemSettings(resolveStoredFiles = false) {
  if (!loadPromise) {
    loadPromise = SystemSettingsApi.public()
      .then(async (value) => {
        await applyPublicSystemSettings(value);
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
  const value = await loadPromise;
  if (resolveStoredFiles && value) {
    await applyPublicSystemSettings(value, true);
  }
  return value;
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
  sloganImage: computed(() => {
    const image = trimText(settings.value?.login_banner_url);
    return isImageUrl(image) ? image : resolvedSloganImage.value;
  }),
};
