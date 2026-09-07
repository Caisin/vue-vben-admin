import type { Job } from '#/api/data-sync';
import type { DatabaseSync } from '#/api/data-sync-database';

import { message } from 'antdv-next';

import { DataSyncApi } from '#/api/data-sync';
import { DatabaseSyncApi } from '#/api/data-sync-database';

export async function stopJob(id: number) {
  const job = await DataSyncApi.state({ id, version: 0 }, true);
  if (job.active_run_id && job.state === 'running') {
    try {
      await DataSyncApi.cancel(job.active_run_id);
    } catch (error) {
      message.warning('本表后续调度已停止，但本次运行停止失败，请重试');
      throw error;
    }
  }
}

export async function startJob(job: Job) {
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

export async function startDatabase(database: DatabaseSync) {
  if (database.schedule_paused || database.state === 'paused')
    await DatabaseSyncApi.pause(database.id, false, database.version);
  return DatabaseSyncApi.dispatch(database.id, 'sync');
}
