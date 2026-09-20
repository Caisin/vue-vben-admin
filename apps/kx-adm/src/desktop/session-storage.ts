export const desktopSessionKey = 'kx-adm.desktop-session.v1';

export function saveDesktopSession(session: {
  apiBase: string;
  token: string;
}) {
  localStorage.setItem(
    desktopSessionKey,
    JSON.stringify({ apiBase: session.apiBase, token: session.token }),
  );
}
export function removeDesktopSession() {
  localStorage.removeItem(desktopSessionKey);
}
export function readDesktopSession(apiBase: string): null | string {
  const raw = localStorage.getItem(desktopSessionKey);
  if (!raw) return null;
  try {
    const saved: unknown = JSON.parse(raw);
    if (
      saved &&
      typeof saved === 'object' &&
      'apiBase' in saved &&
      saved.apiBase === apiBase &&
      'token' in saved &&
      typeof saved.token === 'string' &&
      saved.token.length > 0 &&
      saved.token.length < 32_768
    ) {
      return saved.token;
    }
  } catch {
    /* 损坏缓存不能阻止打开登录页。 */
  }
  removeDesktopSession();
  return null;
}
