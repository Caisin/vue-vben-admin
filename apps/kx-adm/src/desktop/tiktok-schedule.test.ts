import { describe, expect, it, vi } from 'vitest';

import { localDateTime, scheduleTimestamp } from './tiktok';
vi.mock('./tiktok-accounts', () => ({ tikTokAccounts: {} }));
describe('预约时间', () => {
  it('本地时间转换为 Unix 秒且拒绝无效日期与非五分钟时间', () => {
    const timestamp = Math.ceil((Date.now() / 1000 + 7200) / 300) * 300;
    expect(scheduleTimestamp(localDateTime(timestamp))).toBe(timestamp);
    expect(() => scheduleTimestamp('2026-02-31T12:00')).toThrow(
      '预约日期或本地时间无效',
    );
    expect(() => scheduleTimestamp('2026-09-20T12:01')).toThrow(
      '预约时间须按 5 分钟对齐',
    );
  });
});
