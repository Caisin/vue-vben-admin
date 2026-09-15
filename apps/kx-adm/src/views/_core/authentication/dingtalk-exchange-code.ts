import type { LocationQuery } from 'vue-router';

export function getDingTalkExchangeCode(query: LocationQuery, href: string) {
  const routeCode = query.exchange_code;
  if (typeof routeCode === 'string' && routeCode) return routeCode;

  const url = new URL(href);
  const hashQuery = url.hash.split('?')[1];
  return (
    url.searchParams.get('exchange_code') ||
    (hashQuery
      ? new URLSearchParams(hashQuery).get('exchange_code') || undefined
      : undefined)
  );
}

export function stripDingTalkExchangeCode(href: string) {
  const url = new URL(href);
  url.searchParams.delete('exchange_code');
  if (url.hash.includes('?')) {
    const [path, query = ''] = url.hash.slice(1).split('?');
    const params = new URLSearchParams(query);
    params.delete('exchange_code');
    url.hash = `${path}${params.toString() ? `?${params}` : ''}`;
  }
  return url.toString();
}
