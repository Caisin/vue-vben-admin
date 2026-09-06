import { describe, expect, it } from 'vitest';

import { packageConfigFrom, packageDefaults } from './package-config';

describe('package settings', () => {
  it('never implicitly adopts an existing service', () => {
    expect(packageDefaults().adopt_existing).toBe(false);
    expect(packageConfigFrom({ adopt_existing: 'false' }).adopt_existing).toBe(
      false,
    );
    expect(packageConfigFrom({ adopt_existing: true }).adopt_existing).toBe(
      true,
    );
  });
  it('keeps pinned package identity', () => {
    expect(
      packageConfigFrom({
        manager: 'brew',
        name: 'postgresql@17',
        service: 'postgresql@17',
      }),
    ).toMatchObject({
      manager: 'brew',
      name: 'postgresql@17',
      service: 'postgresql@17',
    });
    expect(packageConfigFrom(undefined)).toEqual(packageDefaults());
  });
});
