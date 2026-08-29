import { describe, expect, it } from 'vitest';

import { resolvePermissionRefreshTarget } from './permission-refresh';

describe('resolvePermissionRefreshTarget', () => {
  it('keeps the current location while its route remains available', () => {
    expect(
      resolvePermissionRefreshTarget({
        currentFullPath: '/system/users?page=2',
        currentRouteAvailable: true,
        homePath: '/overview',
      }),
    ).toBe('/system/users?page=2');
  });

  it('uses the refreshed home path after current access is revoked', () => {
    expect(
      resolvePermissionRefreshTarget({
        currentFullPath: '/system/users',
        currentRouteAvailable: false,
        homePath: '/res/overview',
      }),
    ).toBe('/res/overview');
  });

  it('falls back to the user overview without an available home path', () => {
    expect(
      resolvePermissionRefreshTarget({
        currentFullPath: '/system/users',
        currentRouteAvailable: false,
      }),
    ).toBe('/user-overview');
  });
});
