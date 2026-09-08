import dayjs from 'dayjs';
import { describe, expect, it } from 'vitest';

import { readWindowStart, writeWindowStart } from '../../window-start';

describe('首次同步起点时间选择', () => {
  it('按窗口时区回显，兼容后端按 UTC 解释的旧格式', () => {
    expect(
      readWindowStart('2025-12-31T16:00:00Z', 'Asia/Shanghai')?.format(
        'YYYY-MM-DD HH:mm:ss',
      ),
    ).toBe('2026-01-01 00:00:00');
    expect(
      readWindowStart('2025-12-31 16:00:00', 'Asia/Shanghai')?.format(
        'YYYY-MM-DD HH:mm:ss',
      ),
    ).toBe('2026-01-01 00:00:00');
  });
  it('按天保存窗口时区零点，而非浏览器时区', () => {
    expect(
      writeWindowStart(dayjs('2026-01-02T13:42:15'), 'Asia/Shanghai', 'day'),
    ).toBe('2026-01-02T00:00:00+08:00');
    expect(writeWindowStart(dayjs('2026-01-02T13:42:15'), 'UTC', 'day')).toBe(
      '2026-01-02T00:00:00+00:00',
    );
  });
  it('按小时保存整点，保留选择的小时', () => {
    expect(
      writeWindowStart(dayjs('2026-01-02T13:42:15'), 'Asia/Shanghai', 'hour'),
    ).toBe('2026-01-02T13:00:00+08:00');
  });
  it('使用所选日期的夏令时偏移', () => {
    expect(
      writeWindowStart(dayjs('2026-01-02'), 'America/New_York', 'day'),
    ).toBe('2026-01-02T00:00:00-05:00');
    expect(
      writeWindowStart(dayjs('2026-07-02'), 'America/New_York', 'day'),
    ).toBe('2026-07-02T00:00:00-04:00');
  });
  it('支持清空，非法日期或正在编辑的时区不使表单崩溃', () => {
    expect(writeWindowStart(null, 'UTC', 'day')).toBe('');
    expect(readWindowStart('', 'UTC')).toBeNull();
    expect(readWindowStart('invalid', 'UTC')).toBeNull();
    expect(readWindowStart('2026-01-02T00:00:00Z', 'Asia/')).toBeNull();
  });
});
