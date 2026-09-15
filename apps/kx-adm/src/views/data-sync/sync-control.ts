import type { Job } from '#/api/data-sync';
import type { DatabaseSync } from '#/api/data-sync-database';

import { message } from 'antdv-next';

import { DataSyncApi } from '#/api/data-sync';
import { DatabaseSyncApi } from '#/api/data-sync-database';

export async function stopJob(id: number) {
  const job = await DataSyncApi.state({ id, version: 0 }, true);
  if (job.active_run_id && ['cancelling', 'running'].includes(job.state)) {
    try {
      await DataSyncApi.cancel(job.active_run_id);
    } catch (error) {
      message.warning('本表后续调度已停止，但本次运行停止失败，请重试');
      throw error;
    }
  }
}

export async function startJob(target: Pick<Job, 'id'>) {
  const detail = await DataSyncApi.detail(target.id);
  const job = detail.job;
  if (job.state === 'blocked')
    throw new Error('本表仍有提交结果待确认，请先执行回执对账');
  if (job.active_run_id) throw new Error('本表已有执行中的新运行，请刷新查看');
  if (job.database_id) {
    const parent = await DatabaseSyncApi.detail(job.database_id);
    if (parent.state === 'blocked')
      throw new Error('所属全库仍待对账，请先执行所属全库回执对账');
    if (parent.active_task_id)
      throw new Error(
        '所属全库仍有运行未结束，请停止该运行或等待完成后重新启动',
      );
    if (parent.schedule_paused || parent.state === 'paused') {
      await DatabaseSyncApi.pause(parent.id, false, parent.version);
      message.info('所属全库调度已恢复，本次仅同步所选表');
    }
  }
  if (job.schedule_paused || job.state === 'paused')
    await DataSyncApi.state(job, false);
  return job.database_id
    ? DatabaseSyncApi.dispatch(
        job.database_id,
        'sync',
        undefined,
        job.target_table,
      )
    : DataSyncApi.dispatch(job.id, 'sync', {});
}

export async function stopDatabase(id: number) {
  const database = await DatabaseSyncApi.pause(id, true, 0);
  if (database.active_task_id) {
    try {
      await DatabaseSyncApi.cancel(id);
    } catch (error) {
      message.warning('全库后续调度已停止，但本次运行停止失败，请重试');
      throw error;
    }
  }
}

export async function startDatabase(target: Pick<DatabaseSync, 'id'>) {
  const database = await DatabaseSyncApi.detail(target.id);
  if (database.state === 'blocked')
    throw new Error('全库仍有提交结果待确认，请先执行回执对账');
  if (database.active_task_id)
    throw new Error('全库已有执行中的新运行，请刷新查看');
  if (database.schedule_paused || database.state === 'paused')
    await DatabaseSyncApi.pause(database.id, false, database.version);
  return DatabaseSyncApi.dispatch(database.id, 'sync');
}
