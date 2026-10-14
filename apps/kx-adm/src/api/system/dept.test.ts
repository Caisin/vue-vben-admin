import { expect, it, vi } from 'vitest';

import { SystemDeptApi } from './dept';
const get = vi.hoisted(() => vi.fn());
vi.mock('#/api/request', () => ({ requestClient: { get } }));

it('公司部门选择只读取后端组织树，保留技术与产品两个分支及手工部门', async () => {
  const row = (id: number | string, name: string, pid = 0) => ({
    id,
    name,
    pid,
    enabled: true,
    sort_no: 0,
    created_at: 1,
    updated_at: 1,
  });
  get.mockResolvedValue([
    {
      ...row(-1, '公司'),
      source_id: 'a',
      children: [
        {
          ...row(10, '技术研发中心'),
          children: [
            row(11, '产品部', 10),
            { ...row(12, '技术部', 10), children: [row(13, '技术子组', 12)] },
          ],
        },
      ],
    },
    {
      ...row('-9223372036854775808', '未关联公司的部门'),
      children: [row(30, '手工部门')],
    },
  ]);
  const result = await SystemDeptApi.companies();
  expect(get).toHaveBeenCalledExactlyOnceWith('/auth/dept/companies');
  expect(result[0]?.children?.[0]?.children?.map((d) => d.name)).toEqual([
    '产品部',
    '技术部',
  ]);
  expect(result[0]?.children?.[0]?.children?.[1]?.children?.[0]?.id).toBe('13');
  expect(result[0]).toMatchObject({
    disabled: true,
    isCompany: true,
    sourceId: 'a',
  });
  expect(result[1]).toMatchObject({ disabled: true, isCompany: true });
  expect(result[1]?.children?.[0]).toMatchObject({
    id: '30',
    disabled: false,
    isCompany: false,
  });
});
