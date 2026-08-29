import type { VxeGridProps } from 'vxe-table';

import { describe, expect, it } from 'vitest';

import { enableProxySortForRemoteSort } from './extends';

describe('enableProxySortForRemoteSort', () => {
  it('enables proxy queries for remote sorting', () => {
    const options = {
      proxyConfig: {},
      sortConfig: { remote: true },
    } as VxeGridProps;

    enableProxySortForRemoteSort(options);

    expect(options.proxyConfig?.sort).toBe(true);
  });

  it('preserves an explicitly disabled proxy sort', () => {
    const options = {
      proxyConfig: { sort: false },
      sortConfig: { remote: true },
    } as VxeGridProps;

    enableProxySortForRemoteSort(options);

    expect(options.proxyConfig?.sort).toBe(false);
  });

  it('does not enable proxy sorting for local sorting', () => {
    const options = {
      proxyConfig: {},
      sortConfig: { remote: false },
    } as VxeGridProps;

    enableProxySortForRemoteSort(options);

    expect(options.proxyConfig?.sort).toBeUndefined();
  });
});
