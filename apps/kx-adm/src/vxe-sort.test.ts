import { describe, expect, it } from 'vitest';

import { vxeSortArray, vxeSortLocalRows, vxeSortParams } from './vxe-sort';

describe('vxe sort params', () => {
  it('maps active vxe sort to backend sort parameters', () => {
    expect(
      vxeSortParams({ sort: { field: 'device_code', order: 'desc' } }, [
        'device_code',
      ]),
    ).toEqual({ descending: true, sort: 'device_code' });
  });

  it('uses property when field is missing', () => {
    expect(
      vxeSortParams({ sorts: [{ order: 'asc', property: 'last_seen_at' }] }, [
        'last_seen_at',
      ]),
    ).toEqual({ descending: false, sort: 'last_seen_at' });
  });

  it('ignores cleared or unsupported sorts', () => {
    expect(
      vxeSortParams({ sort: { field: 'password', order: 'desc' } }, [
        'device_code',
      ]),
    ).toEqual({});
    expect(
      vxeSortParams({ sort: { field: 'device_code', order: undefined } }, [
        'device_code',
      ]),
    ).toEqual({});
  });

  it('maps active vxe sort to prefixed sort arrays', () => {
    expect(
      vxeSortArray({ sort: { field: 'last_seen_at', order: 'desc' } }, [
        'last_seen_at',
      ]),
    ).toEqual(['-last_seen_at']);
  });

  it('sorts local rows without mutating source rows', () => {
    const rows = [{ order_no: 2 }, { order_no: 1 }];

    expect(
      vxeSortLocalRows(rows, { sort: { field: 'order_no', order: 'asc' } }, [
        'order_no',
      ]),
    ).toEqual([{ order_no: 1 }, { order_no: 2 }]);
    expect(rows).toEqual([{ order_no: 2 }, { order_no: 1 }]);
  });
});
