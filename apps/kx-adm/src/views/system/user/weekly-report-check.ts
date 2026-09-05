import type { TaskRun } from '#/api/task/run';

import { SystemUserApi } from '#/api/system/user';

export async function waitForWeeklyReportCheck(
  publishId: number | string,
  task: TaskRun,
  isCurrent: () => boolean,
) {
  for (let attempt = 0; attempt < 120 && isCurrent(); attempt++) {
    const publish = await SystemUserApi.weekly_report_publish(
      publishId,
      task.id,
    );
    if (!isCurrent()) return;
    const run = publish.task_run;
    if (!run) throw new Error('周报检查任务状态不可用');
    if (run.status === 'succeeded') {
      if (String(publish.last_reminder_task_run_id) !== String(task.id)) {
        throw new Error('周报检查记录已变化，请刷新名单');
      }
      const participants =
        await SystemUserApi.weekly_report_participants(publishId);
      if (!isCurrent()) return;
      return {
        participants: participants.filter(
          (item) => item.status !== 'completed',
        ),
        publish,
      };
    }
    if (!['queued', 'retrying', 'running'].includes(run.status)) {
      throw new Error(run.error_message || run.message || '周报检查失败');
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  if (isCurrent()) throw new Error('周报检查仍在执行，请稍后刷新名单');
}
