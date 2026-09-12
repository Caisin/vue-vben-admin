import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SystemUserApi } from './user';

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('#/api/request', () => ({
  requestClient: { get },
  plaintextRequestClient: {},
}));

describe('用户筛选请求', () => {
  beforeEach(() => {
    get.mockReset();
    get.mockResolvedValue({ items: [], total: 0 });
  });
  it('公司部门范围与关键词、状态、用户编号同时送往后端', async () => {
    await SystemUserApi.list({
      page: 1,
      pageSize: 20,
      deptIds: ['-1', '11', '12'],
      keyword: '张',
      status: 0,
      id: '102',
      remark: '研发',
    });
    expect(get).toHaveBeenCalledWith('/auth/user-admin', {
      params: expect.objectContaining({
        page: 1,
        size: 20,
        dept_ids: '-1,11,12',
        keyword: '张',
        enabled: false,
        id: '102',
        remark: '研发',
      }),
    });
  });
  it('清除部门选择不会携带上次范围', async () => {
    await SystemUserApi.list({ deptIds: [], keyword: '李' });
    expect(get.mock.calls[0]?.[1].params.dept_ids).toBeUndefined();
  });
  it('日期选择转换成秒时间戳', async () => {
    await SystemUserApi.list({
      startTime: '2026-09-01',
      endTime: '2026-09-02',
    });
    const params = get.mock.calls[0]?.[1].params;
    expect(params.created_to - params.created_from).toBe(172_799);
  });
});
