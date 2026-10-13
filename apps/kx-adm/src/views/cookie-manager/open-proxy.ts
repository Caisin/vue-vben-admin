import type { Site } from '#/api/cookie-manager';

import { CookieApi } from '#/api/cookie-manager';
import { desktop, openCookieProxy } from '#/desktop';

function grantUrl(value: string, expected: string): string {
  const url = new URL(value);
  const entry = new URL(expected);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.origin !== entry.origin ||
    url.username ||
    url.password ||
    url.pathname !== '/_kx/complete'
  )
    throw new Error('代理入口地址无效，请刷新授权或联系管理员检查代理配置');
  return url.href;
}

export async function openProxySite(site: Site, mobile: boolean) {
  if (!site.proxy_url) throw new Error('请先配置网站代理');
  if (desktop) {
    await openCookieProxy(String(site.id));
    return;
  }
  // 必须在第一个await前保留用户点击手势。noopener会让成功打开的窗口也返回null，
  // 因此打开空白页后立即断开opener，之后才允许导航到代理网站。
  const popup = mobile ? undefined : window.open('about:blank', '_blank');
  if (!mobile && !popup)
    throw new Error('浏览器阻止了新窗口，请允许本站弹窗后重试');
  try {
    if (popup) {
      popup.opener = null;
      popup.document.title = '正在进入代理网站';
      popup.document.body.textContent = '正在验证网站授权，请稍候…';
    }
    const result = await CookieApi.proxyGrantDirect(site.id);
    const url = grantUrl(result.url, site.proxy_url);
    if (popup) {
      if (popup.closed) throw new Error('代理窗口已关闭，请重新点击进入');
      popup.location.replace(url);
    } else window.location.assign(url);
  } catch (error) {
    if (popup && !popup.closed) popup.close();
    throw error;
  }
}
