export function displayValue(value: null | number | string | undefined) {
  return value === null || value === undefined || value === '' ? '未知' : value;
}

export function formatPaginationTotal(total: number): string {
  return `共 ${total} 条`;
}

export function createIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `web-${crypto.randomUUID()}`;
  }
  return `web-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function statusMeta(status: string) {
  const value = status.toLowerCase();
  if (
    ['active', 'online', 'processed', 'published', 'sent', 'success'].includes(
      value,
    )
  ) {
    return { color: 'success', label: statusLabel(value) };
  }
  if (['failed', 'offline', 'retired'].includes(value)) {
    return { color: 'error', label: statusLabel(value) };
  }
  if (['pending', 'publishing', 'sending'].includes(value)) {
    return { color: 'processing', label: statusLabel(value) };
  }
  return { color: 'warning', label: statusLabel(value || 'unknown') };
}

function statusLabel(status: string) {
  return (
    {
      active: '正常',
      disabled: '停用',
      failed: '失败',
      offline: '离线',
      online: '在线',
      pending: '待发送',
      processed: '已处理',
      published: '已发布',
      publishing: '发布中',
      retired: '退役',
      sending: '发送中',
      sent: '已发送',
      success: '成功',
      ignored: '已忽略',
      unknown: '未知',
    }[status] ?? status
  );
}
