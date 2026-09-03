import type { Device } from '#/api/msg';

export function deviceBackendUrl(device: Pick<Device, 'base_url' | 'sta_ip'>) {
  for (const candidate of [device.base_url, device.sta_ip]) {
    const value = candidate.trim();
    if (!value) continue;
    try {
      const url = new URL(value.includes('://') ? value : `http://${value}`);
      if (url.protocol === 'http:' || url.protocol === 'https:')
        return url.href;
    } catch {
      // 当前候选不可用时继续尝试局域网地址。
    }
  }
  return undefined;
}
