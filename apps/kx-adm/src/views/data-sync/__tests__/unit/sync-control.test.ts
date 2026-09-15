import { beforeEach, describe, expect, it, vi } from 'vitest';

import { startDatabase, startJob } from '../../sync-control';

const api = vi.hoisted(() => ({
  detail: vi.fn(),
  state: vi.fn(),
  dispatch: vi.fn(),
  parent: vi.fn(),
  pause: vi.fn(),
  parentDispatch: vi.fn(),
}));
vi.mock('#/api/data-sync', () => ({
  DataSyncApi: { detail: api.detail, state: api.state, dispatch: api.dispatch },
}));
vi.mock('#/api/data-sync-database', () => ({
  DatabaseSyncApi: {
    detail: api.parent,
    pause: api.pause,
    dispatch: api.parentDispatch,
  },
}));
vi.mock('antdv-next', () => ({ message: { info: vi.fn(), warning: vi.fn() } }));

beforeEach(() => vi.resetAllMocks());
describe('取消后重新启动', () => {
  it('使用最新版本恢复独立任务，并提交新的运行请求', async () => {
    const current = {
      id: 1,
      state: 'paused',
      schedule_paused: true,
      version: 9,
    };
    api.detail.mockResolvedValue({ job: current });
    api.dispatch.mockResolvedValue({ id: 102, status: 'running' });
    expect(await startJob({ id: 1 })).toMatchObject({ id: 102 });
    expect(api.state).toHaveBeenCalledWith(current, false);
    expect(api.dispatch).toHaveBeenCalledWith(1, 'sync', {});
  });
  it('托管表同时恢复暂停的父配置，仍只提交该表', async () => {
    const parent = {
      id: 10,
      state: 'paused',
      schedule_paused: true,
      version: 7,
    };
    const current = {
      id: 1,
      database_id: 10,
      target_table: 'orders',
      state: 'paused',
      schedule_paused: true,
      version: 8,
    };
    api.detail.mockResolvedValue({ job: current });
    api.parent.mockResolvedValue(parent);
    api.pause.mockImplementation(async () => {
      parent.schedule_paused = false;
    });
    api.parentDispatch.mockImplementation(async () => {
      if (parent.schedule_paused) throw new Error('data_sync_schedule_paused');
      return { id: 103 };
    });
    expect(await startJob({ id: 1 })).toEqual({ id: 103 });
    expect(api.pause).toHaveBeenCalledWith(10, false, 7);
    expect(api.state).toHaveBeenCalledWith(current, false);
    expect(api.parentDispatch).toHaveBeenCalledWith(
      10,
      'sync',
      undefined,
      'orders',
    );
  });
  it('未知提交和已经启动的新运行不能被旧取消记录覆盖', async () => {
    for (const current of [
      { state: 'blocked' },
      { state: 'running', active_run_id: 4 },
    ]) {
      api.detail.mockResolvedValue({ job: { id: 1, ...current } });
      await expect(startJob({ id: 1 })).rejects.toThrow(
        /回执对账|已有执行中的新运行/,
      );
    }
    expect(api.state).not.toHaveBeenCalled();
    expect(api.dispatch).not.toHaveBeenCalled();
  });
  it('全库重新启动也使用最新版本', async () => {
    api.parent.mockResolvedValue({
      id: 10,
      state: 'paused',
      schedule_paused: true,
      version: 23,
    });
    api.parentDispatch.mockResolvedValue({ id: 104 });
    expect(await startDatabase({ id: 10 })).toEqual({ id: 104 });
    expect(api.pause).toHaveBeenCalledWith(10, false, 23);
    expect(api.parentDispatch).toHaveBeenCalledWith(10, 'sync');
  });
});
