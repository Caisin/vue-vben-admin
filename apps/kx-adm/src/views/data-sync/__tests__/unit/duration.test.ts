import { describe, expect, it } from 'vitest';

import { formatSyncDuration } from '../../duration';

describe('同步运行耗时', () => {
  it('使用持久化起止时间格式化秒、分钟和小时', () => {
    expect(formatSyncDuration({ started_at: 100, finished_at: 108 })).toBe(
      '8s',
    );
    expect(formatSyncDuration({ started_at: 100, finished_at: 165 })).toBe(
      '1m5s',
    );
    expect(formatSyncDuration({ started_at: '100', finished_at: '3780' })).toBe(
      '1h1m20s',
    );
    expect(formatSyncDuration({ started_at: 100, finished_at: 100 })).toBe(
      '0s',
    );
  });

  it('运行中、历史时间缺失或时间无效时不伪造耗时', () => {
    for (const run of [
      {},
      { started_at: 100, finished_at: null },
      { started_at: null, finished_at: 100 },
      { started_at: 0, finished_at: 100 },
      { started_at: 100, finished_at: 99 },
      { started_at: 'invalid', finished_at: 100 },
      { started_at: 100, finished_at: Number.POSITIVE_INFINITY },
    ]) {
      expect(formatSyncDuration(run)).toBe('-');
    }
  });
});
