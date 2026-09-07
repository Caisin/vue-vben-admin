import type { TimeInput } from '../../times';

import { Times } from '../../times';

export function formatSyncDuration(run: {
  finished_at?: TimeInput;
  started_at?: TimeInput;
}): string {
  const start = Times.toUnixSeconds(run.started_at);
  const finish = Times.toUnixSeconds(run.finished_at);
  if (start === undefined || finish === undefined) return '-';
  return Times.formatDurationSeconds(finish - start);
}
