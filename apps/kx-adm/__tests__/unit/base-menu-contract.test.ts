import { describe, expect, it } from 'vitest';

import { overridesPreferences } from '../../src/preferences';
import { componentKeys } from '../../src/router/routes';

describe('rES base menu contract', () => {
  it('uses the current user overview as the fallback home page', () => {
    expect(overridesPreferences.app?.defaultHomePath).toBe('/user-overview');
  });

  it.each([
    '/system/user/list',
    '/system/role/list',
    '/system/tasks/index',
    '/param/parameters/list',
    '/param/dictionaries/list',
    '/asset/items/list',
    '/asset/pay-orders/list',
    '/storage/configs/list',
    '/storage/files/list',
    '/storage/groups/list',
    '/developer-account/tiktok-mini-apps',
  ])('registers the base menu component %s', (component) => {
    expect(componentKeys).toContain(component);
  });
});
