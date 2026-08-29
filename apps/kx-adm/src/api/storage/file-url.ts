export function resolveFileAccessUrl(url: string, baseURL: string) {
  const value = url.trim();
  if (!value || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(value)) return value;
  const base = baseURL.trim().replace(/\/+$/, '');
  const path = `/${value.replace(/^\/+/, '')}`;
  return base ? `${base}${path}` : path;
}
