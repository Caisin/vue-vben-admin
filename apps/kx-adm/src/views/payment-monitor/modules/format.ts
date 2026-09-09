import type { Id } from '#/api/payment-monitor';
export const states: Record<string, string> = {
  queued: '等待执行',
  pending: '待处理',
  running: '执行中',
  succeeded: '成功',
  failed: '失败',
  canceled: '已取消',
  cancelled: '已取消',
  needs_response: '待举证',
  under_review: '审理中',
  won: '已胜诉',
  lost: '已败诉',
  warning_needs_response: '查询待回复',
  warning_under_review: '查询审理中',
  warning_closed: '查询已关闭',
  prevented: '已预防',
  open: '待处理',
  acknowledged: '已确认',
  resolved: '已处理',
  not_configured: '未配置渠道',
  retry: '等待重试',
};
export const severity: Record<string, { label: string; color: string }> = {
  watch: { label: '关注', color: 'warning' },
  high: { label: '高风险', color: 'error' },
  critical: { label: '紧急', color: 'red' },
  data: { label: '数据异常', color: 'orange' },
};
export function percent(bps?: null | number) {
  return bps === null || bps === undefined ? '—' : `${(bps / 100).toFixed(2)}%`;
}
export function money(amount: Id, currency: string) {
  const code = currency.toUpperCase();
  const zero = [
    'BIF',
    'CLP',
    'DJF',
    'GNF',
    'JPY',
    'KMF',
    'KRW',
    'MGA',
    'PYG',
    'RWF',
    'UGX',
    'VND',
    'VUV',
    'XAF',
    'XOF',
    'XPF',
  ];
  let digits = 2;
  if (zero.includes(code)) digits = 0;
  else if (['BHD', 'JOD', 'KWD', 'OMR', 'TND'].includes(code)) digits = 3;
  try {
    const minor = BigInt(amount);
    const negative = minor < 0n;
    const text = (negative ? -minor : minor)
      .toString()
      .padStart(digits + 1, '0');
    const value = digits
      ? `${text.slice(0, -digits)}.${text.slice(-digits)}`
      : text;
    return `${code} ${negative ? '-' : ''}${value}`;
  } catch {
    return `${code} —`;
  }
}
export const defaultPolicy = () => ({
  visa_region: 'unconfirmed',
  watch_bps: 50,
  high_bps: 75,
  critical_bps: 100,
  min_payments: 100,
  min_disputes: 3,
  efw_count: 3,
  deadline_hours: 72,
  stale_hours: 24,
  cooldown_hours: 24,
  channel_id: null,
});
