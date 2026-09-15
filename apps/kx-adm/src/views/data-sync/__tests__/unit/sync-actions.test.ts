import { describe, expect, it } from 'vitest';

import { syncActions } from '../../sync-actions';

describe('同步控制按状态展示', () => {
  it('待对账只显示对账，不显示启动、停止或重复强停', () => {
    expect(
      syncActions({
        state: 'blocked',
        schedule_paused: true,
        active_run_id: 1,
      }),
    ).toEqual({ start: false, stop: false, forceStop: false, reconcile: true });
  });
  it('对账完成保持暂停，仅显示启动', () => {
    expect(syncActions({ state: 'paused', schedule_paused: true })).toEqual({
      start: true,
      stop: false,
      forceStop: false,
      reconcile: false,
    });
  });
  it('运行中显示停止和强停，全库使用父任务指针', () => {
    expect(
      syncActions({
        state: 'running',
        schedule_paused: false,
        active_task_id: 2,
      }),
    ).toEqual({ start: false, stop: true, forceStop: true, reconcile: false });
  });
  it('停止中只保留强停', () => {
    expect(
      syncActions({
        state: 'cancelling',
        schedule_paused: true,
        active_run_id: 1,
      }),
    ).toEqual({ start: false, stop: false, forceStop: true, reconcile: false });
  });
  it('未就绪和已替代配置不显示执行控制', () => {
    for (const state of [
      'draft',
      'validated',
      'schema_conflict',
      'superseded',
    ]) {
      expect(
        Object.values(syncActions({ state, schedule_paused: false })).some(
          Boolean,
        ),
      ).toBe(false);
    }
  });
});
