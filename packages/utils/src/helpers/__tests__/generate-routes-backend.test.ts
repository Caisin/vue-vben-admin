import type { RouteRecordStringComponent } from '@vben-core/typings';

import { describe, expect, it, vi } from 'vitest';

import { generateRoutesByBackend } from '../generate-routes-backend';

describe('generateRoutesByBackend', () => {
  it('falls back to the route path when a menu component is stale', async () => {
    const page = vi.fn();
    const routes = await generateRoutesByBackend({
      fetchMenuListAsync: async () =>
        [
          {
            component: 'DeveloperAccountTikTokMiniApps',
            meta: {},
            name: 'DeveloperAccountTikTokMiniApps',
            path: '/developer-account/tiktok-mini-apps',
          },
        ] as RouteRecordStringComponent[],
      pageMap: {
        '/developer-account/tiktok-mini-apps.vue': page,
      },
    });

    expect(routes[0]?.component).toBe(page);
  });

  it('maps application view keys to their route paths', async () => {
    const page = vi.fn();
    const routes = await generateRoutesByBackend({
      fetchMenuListAsync: async () =>
        [
          {
            component: '/developer-account/tiktok-mini-apps',
            meta: {},
            name: 'DeveloperAccountTikTokMiniApps',
            path: '/developer-account/tiktok-mini-apps',
          },
        ] as RouteRecordStringComponent[],
      pageMap: {
        '../../apps/kx-adm/src/views/developer-account/tiktok-mini-apps.vue':
          page,
      },
    });

    expect(routes[0]?.component).toBe(page);
  });

  it('falls back to directory index or list pages for stale menu components', async () => {
    const indexPage = vi.fn();
    const routes = await generateRoutesByBackend({
      fetchMenuListAsync: async () =>
        [
          {
            component: 'LegacyForwardConfigView',
            meta: {},
            name: 'MsgForwardConfig',
            path: '/msg/forward-config',
          },
        ] as RouteRecordStringComponent[],
      pageMap: {
        '/msg/forward-config/index.vue': indexPage,
      },
    });

    expect(routes[0]?.component).toBe(indexPage);
  });
});
