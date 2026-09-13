import { describe, expect, it } from 'vitest';

import {
  operationActive,
  operationProgress,
  recoveryAdvice,
} from '../../operation-data';
describe('operation feedback', () => {
  it('counts only completed items and caps progress', () => {
    expect(operationProgress({ total: 0, succeeded: 0, failed: 0 })).toBe(0);
    expect(operationProgress({ total: 4, succeeded: 1, failed: 1 })).toBe(50);
    expect(operationProgress({ total: 1, succeeded: 1, failed: 1 })).toBe(100);
  });
  it('keeps unknown submissions separate from safe retries', () => {
    expect(operationActive('running')).toBe(true);
    expect(operationActive('blocked')).toBe(false);
    expect(recoveryAdvice.data_sync_dispatch_outcome_unknown).toContain(
      '不能直接重发',
    );
    expect(recoveryAdvice.data_sync_preflight_stale).toContain('重新预检');
  });
});
