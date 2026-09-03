import { describe, expect, it } from 'vitest';

import { deviceBackendUrl } from './device-backend-url';

describe('deviceBackendUrl', () => {
  it('优先使用配置的后台地址', () => {
    expect(
      deviceBackendUrl({
        base_url: 'https://device.example.com/admin',
        sta_ip: '192.168.1.20',
      }),
    ).toBe('https://device.example.com/admin');
  });

  it('后台地址为空时使用局域网 IP', () => {
    expect(deviceBackendUrl({ base_url: '', sta_ip: '192.168.1.20' })).toBe(
      'http://192.168.1.20/',
    );
  });

  it('忽略无效后台地址并回退局域网 IP', () => {
    expect(
      deviceBackendUrl({ base_url: 'ftp://invalid', sta_ip: '10.0.0.8:8080' }),
    ).toBe('http://10.0.0.8:8080/');
  });
});
