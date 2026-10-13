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

it('部门筛选树与部门管理合并后的公司树保持一致', async () => {
  const { buildCompanyDepartmentTree } = await import('../dept/company-tree');
  const companies = [
    {
      id: '-1',
      sourceId: 'company-a',
      name: '公司 A',
      status: 1 as const,
      children: [{ id: '11', name: '研发部', status: 1 as const }],
    },
  ];
  const departments = [
    {
      id: '11',
      pid: '0',
      name: '研发部',
      status: 0 as const,
      children: [{ id: '12', pid: '11', name: '后端', status: 1 as const }],
    },
  ];
  const tree = buildCompanyDepartmentTree(companies, departments);
  expect(tree[0]?.children?.[0]).toMatchObject({ id: '11', status: 0 });
  expect(collectDeptIdsIncludingDescendants(tree, '11')).toEqual(['11', '12']);
  expect(collectDeptIdsIncludingDescendants(tree, 'company:company-a')).toEqual(
    [],
  );
});

it('未关联公司分组只收集真实部门，虚拟 ID 不传给用户查询', () => {
  const tree = [
    {
      id: 'company:local',
      name: '未关联公司的部门',
      status: 1 as const,
      children: [
        {
          id: '30',
          name: '本地部门',
          status: 1 as const,
          children: [{ id: '31', name: '本地下级', status: 1 as const }],
        },
      ],
    },
  ];
  expect(collectDeptIdsIncludingDescendants(tree, 'company:local')).toEqual([
    '30',
    '31',
  ]);
});
