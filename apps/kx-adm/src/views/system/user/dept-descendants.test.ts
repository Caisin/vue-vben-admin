import { describe, expect, it } from 'vitest';

import { collectDeptIdsIncludingDescendants } from './dept-descendants';

describe('collectDeptIdsIncludingDescendants', () => {
  const tree = [
    {
      id: 1,
      name: '总部',
      children: [
        { id: 2, name: '技术部', children: [{ id: 3, name: '后端' }] },
        { id: 4, name: '产品部' },
      ],
    },
  ] as any;

  it('collects selected department and all descendants', () => {
    expect(collectDeptIdsIncludingDescendants(tree, 2)).toEqual(['2', '3']);
  });

  it('returns empty list when selection is missing', () => {
    expect(collectDeptIdsIncludingDescendants(tree, undefined)).toEqual([]);
    expect(collectDeptIdsIncludingDescendants(tree, 99)).toEqual([]);
  });
});
