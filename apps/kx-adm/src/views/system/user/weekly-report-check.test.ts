import type { TaskRun } from '#/api/task/run';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { waitForWeeklyReportCheck } from './weekly-report-check';

const { detail, participants } = vi.hoisted(() => ({
  detail: vi.fn(),
  participants: vi.fn(),
}));
vi.mock('#/api/system/user', () => ({
  SystemUserApi: {
    weekly_report_publish: detail,
    weekly_report_participants: participants,
  },
}));

const task = { id: 42 } as TaskRun;
const snapshot = (status: string) => ({
  id: 7,
  last_reminder_task_run_id: 42,
  task_run: { id: 42, status },
});

describe('周报异步填写检查', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('检查成功后才读取名单，映射异常与未填写均保留', async () => {
    detail
      .mockResolvedValueOnce(snapshot('running'))
      .mockResolvedValueOnce(snapshot('succeeded'));
    participants.mockResolvedValue([
      { id: 1, status: 'completed' },
      { id: 2, status: 'pending' },
      { id: 3, status: 'mapping_invalid' },
    ]);
    const result = waitForWeeklyReportCheck(7, task, () => true);
    await vi.advanceTimersByTimeAsync(0);
    expect(participants).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1000);
    const checked = await result;
    expect(checked?.participants.map((p) => p.id)).toEqual([2, 3]);
    expect(detail).toHaveBeenCalledWith(7, 42);
  });

  it('任务失败不能显示为空名单', async () => {
    detail.mockResolvedValue({
      ...snapshot('failed'),
      task_run: { status: 'failed', error_message: '读取失败' },
    });
    await expect(waitForWeeklyReportCheck(7, task, () => true)).rejects.toThrow(
      '读取失败',
    );
    expect(participants).not.toHaveBeenCalled();
  });

  it('切换记录或关闭弹窗后忽略旧请求结果', async () => {
    let current = true;
    detail.mockImplementation(async () => {
      current = false;
      return snapshot('succeeded');
    });
    await expect(
      waitForWeeklyReportCheck(7, task, () => current),
    ).resolves.toBeUndefined();
    expect(participants).not.toHaveBeenCalled();
  });

  it('其他轮次的快照不能冒充本次检查结果', async () => {
    detail.mockResolvedValue({
      ...snapshot('succeeded'),
      last_reminder_task_run_id: 43,
    });
    await expect(waitForWeeklyReportCheck(7, task, () => true)).rejects.toThrow(
      '记录已变化',
    );
    expect(participants).not.toHaveBeenCalled();
  });
});
