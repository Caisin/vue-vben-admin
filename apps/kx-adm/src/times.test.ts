import dayjs from 'dayjs';
import { describe, expect, it } from 'vitest';

import { Times } from './times';

describe('times', () => {
  it('formats unix seconds', () => {
    expect(Times.formatUnix(1_700_000_000)).toContain('2023');
  });

  it('formats unix milliseconds during migration', () => {
    expect(Times.formatUnix(1_700_000_000_000)).toBe(
      Times.formatUnix(1_700_000_000),
    );
  });

  it('uses explicit fallback for empty and invalid values', () => {
    expect(Times.formatUnix(undefined)).toBe('未知');
    expect(Times.formatOptionalUnix(0)).toBe('-');
    expect(Times.formatOptionalUnix('not-a-time', '无')).toBe('无');
  });

  it('encodes and decodes unix second ranges', () => {
    const range = [
      dayjs.unix(1_700_000_000),
      dayjs.unix(1_700_003_600),
    ] as const;
    expect(Times.toUnixRange(range)).toBe('1700000000,1700003600');
    expect(
      Times.parseUnixRange('1700000000,1700003600')?.map((item) => item.unix()),
    ).toEqual([1_700_000_000, 1_700_003_600]);
  });

  it('rejects malformed unix second ranges', () => {
    expect(Times.parseUnixRange('1700000000')).toBeUndefined();
    expect(Times.parseUnixRange('1700003600,1700000000')).toBeUndefined();
    expect(Times.toUnixRange('1700000000,1700003600')).toBeUndefined();
  });
});
