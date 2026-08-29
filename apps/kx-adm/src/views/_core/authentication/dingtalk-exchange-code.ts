import type { LocationQuery } from 'vue-router';

export function getDingTalkExchangeCode(query: LocationQuery, href: string) {
  const routeCode = query.exchange_code;
  if (typeof routeCode === 'string' && routeCode) return routeCode;

  const url = new URL(href);
  return url.searchParams.get('exchange_code') || undefined;
}

export function stripDingTalkExchangeCode(href: string) {
  const url = new URL(href);
  url.searchParams.delete('exchange_code');
  return url.toString();
}
