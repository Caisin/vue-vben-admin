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

  it('选择公司不附带部门条件，包含尚未分配部门的成员', () => {
    expect(
      collectDeptIdsIncludingDescendants(
        [
          {
            id: '-1',
            sourceId: 'company-a',
            name: '公司 A',
            status: 1,
            children: [{ id: '11', name: '研发部', status: 1 }],
          },
        ],
        '-1',
      ),
    ).toEqual([]);
  });
});
