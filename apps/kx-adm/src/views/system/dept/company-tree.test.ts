import { describe, expect, it } from 'vitest';

import { buildCompanyDepartmentTree } from './company-tree';

describe('部门管理公司树', () => {
  it('同名部门按公司隔离，保留真实状态、父级和手动新增的下级部门', () => {
    const companies = [
      {
        id: '-1',
        sourceId: 'a',
        name: '甲公司',
        status: 1 as const,
        children: [{ id: '10', name: '研发部', status: 1 as const }],
      },
      {
        id: '-2',
        sourceId: 'b',
        name: '乙公司',
        status: 1 as const,
        children: [{ id: '20', name: '研发部', status: 1 as const }],
      },
    ];
    const departments = [
      {
        id: '10',
        pid: '0',
        name: '研发部',
        status: 0 as const,
        remark: '本地备注',
        children: [
          { id: '11', pid: '10', name: '手动子部门', status: 1 as const },
        ],
      },
      { id: '20', pid: '0', name: '研发部', status: 1 as const },
      { id: '30', pid: '0', name: '本地部门', status: 1 as const },
    ];
    const result = buildCompanyDepartmentTree(companies, departments);
    expect(result.map((row) => row.name)).toEqual([
      '甲公司',
      '乙公司',
      '未关联公司的部门',
    ]);
    expect(result[0]?.children?.[0]).toMatchObject({
      id: '10',
      status: 0,
      remark: '本地备注',
      pid: '0',
    });
    expect(result[0]?.children?.[0]?.children?.[0]?.id).toBe('11');
    expect(result[1]?.children?.map((row) => row.id)).toEqual(['20']);
    expect(result[2]?.children?.map((row) => row.id)).toEqual(['30']);
    expect(result.every((row) => row.isCompany)).toBe(true);
    expect(companies[0]?.children?.[0]?.status).toBe(1);
  });
});
