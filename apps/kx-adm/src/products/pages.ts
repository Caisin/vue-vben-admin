import type { ComponentRecordType } from '@vben/types';

const pageMap: ComponentRecordType = import.meta.glob('../views/**/*.vue');

const tiktokMiniAppPage = Object.entries(pageMap).find(([key]) =>
  key.endsWith('/developer-account/tiktok-mini-apps.vue'),
)?.[1];
if (tiktokMiniAppPage) {
  pageMap['/DeveloperAccountTikTokMiniApps'] = tiktokMiniAppPage;
  pageMap['/DeveloperAccountTikTokMiniApps.vue'] = tiktokMiniAppPage;
}

const appleDevicePage = Object.entries(pageMap).find(([key]) =>
  key.endsWith('/developer-account/devices/list.vue'),
)?.[1];
if (appleDevicePage) {
  pageMap['/developer-account/apple-devices/list'] = appleDevicePage;
}

export { pageMap };
