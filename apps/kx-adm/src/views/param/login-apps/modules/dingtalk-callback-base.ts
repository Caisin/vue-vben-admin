export function buildDingtalkCallbackBase(apiUrl: string, origin: string) {
  const normalizedApiUrl = apiUrl.replace(/\/$/, '');
  return new URL(`${normalizedApiUrl}/auth/dt/callback`, origin).toString();
}

export function hasDingtalkCallbackBase(value: string) {
  return value.trim().length > 0;
}
