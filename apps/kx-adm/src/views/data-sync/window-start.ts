import type { Dayjs } from 'dayjs';

import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone.js';
import utc from 'dayjs/plugin/utc.js';

dayjs.extend(utc);
dayjs.extend(timezone);

export function validWindowTimezone(zone: string) {
  if (!zone.trim()) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone }).format(0);
    return true;
  } catch {
    return false;
  }
}

export function readWindowStart(value: string, zone: string): Dayjs | null {
  if (!value || !validWindowTimezone(zone)) return null;
  // 后端把无偏移的旧时间字符串解释为 UTC，不能按浏览器本地时间解析。
  const parsed = dayjs.utc(value);
  return parsed.isValid() ? parsed.tz(zone) : null;
}

export function writeWindowStart(
  value: Dayjs | null,
  zone: string,
  unit: 'day' | 'hour',
): string {
  if (!value?.isValid() || !validWindowTimezone(zone)) return '';
  const wallTime = value.format(
    unit === 'day' ? 'YYYY-MM-DD[ 00:00:00]' : 'YYYY-MM-DD HH[:00:00]',
  );
  return dayjs.tz(wallTime, zone).format('YYYY-MM-DDTHH:mm:ssZ');
}
