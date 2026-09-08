import type { Device } from '../../src/api/msg/types';

import { Buffer } from 'node:buffer';

import { KxEd } from '@kx/admin-core';
import { expect, test } from '@playwright/test';

test.use({ headless: true, actionTimeout: 10_000 });

for (const readonly of [false, true]) {
  test(`设备和卡片 MQTT 定位${readonly ? '权限隔离' : '不依赖 HTTP 地址'}`, async ({
    page,
  }) => {
    test.setTimeout(90_000);
    let locateCount = 0;
    let rejectLocate = false;
    const requests: string[] = [];
    const device: Device = {
      device_code: 'device-1',
      name: '测试设备',
      online_state: 'online',
      base_url: '',
      last_seen_at: 1,
      software_version: '',
      hardware_version: '',
      mac: '',
      slot_1_phone_number: '13800138000',
      slot_2_phone_number: '',
      credential_ready: false,
      sta_ip: '',
      device_system_time: '',
      online_changed_at: 1,
      reported_status: '',
      uid: '',
      updated_at: 1,
      wifi: '',
    };
    const sim = {
      iccid: 'test-locate-sim',
      phone_number: '13800138000',
      real_name: '',
      ownership: '',
      management_note: '',
      carrier: 'CMCC',
      device_code: 'device-1',
      device_name: '测试设备',
      slot_code: '1',
      online_state: 'online',
      lifecycle_state: 'active',
      phone_region: 'mainland_china',
      balance: '',
      balance_currency: '',
      expires_at: 0,
      last_seen_at: 1,
      apple_developer_registered: false,
      account_count: 0,
    };
    await page
      .context()
      .route('**/{auth,notify,param,msg}/**', async (route) => {
        if (!['fetch', 'xhr'].includes(route.request().resourceType()))
          return route.continue();
        const request = route.request();
        const path = new URL(request.url()).pathname.replace(
          /^\/api(?=\/)/,
          '',
        );
        requests.push(`${request.method()} ${path}`);
        let result: unknown = {};
        let error = '';
        if (path === '/auth/user/access_token')
          result = {
            access_token: 'test-only',
            token_type: 'Bearer',
            uid: 7,
            exp_at: 4_102_444_800,
            exp_in: 3600,
          };
        else if (path === '/auth/user/user_info')
          result = {
            id: 7,
            name: '定位测试',
            enabled: true,
            home_path: '/msg/sim-cards',
            avatar: '',
            is_guest: false,
          };
        else if (path === '/auth/per/codes')
          result = readonly ? [] : ['devices:locate'];
        else if (path === '/auth/menu/current')
          result = [
            {
              name: 'MsgSimCards',
              title: '电话卡',
              path: '/msg/sim-cards',
              component: '/msg/sim-cards/list',
            },
            {
              name: 'MsgDevices',
              title: '设备管理',
              path: '/msg/devices',
              component: '/msg/devices/list',
            },
          ].map((menu, index) => ({
            ...menu,
            id: index + 1,
            pid: 0,
            perm_type: 'menu',
            enabled: true,
            order_no: index,
            auth_code: '',
            meta: {},
            redirect: null,
          }));
        else if (path === '/notify/inbox')
          result = { items: [], unread_count: 0 };
        else if (path === '/msg/sim-cards') result = { items: [sim], total: 1 };
        else if (path === '/msg/devices')
          result = { items: [device], total: 1 };
        else if (path.endsWith('/filter-options'))
          result = {
            carriers: [],
            ownerships: [],
            real_names: [],
            devices: [],
            lifecycle_states: [],
            phone_regions: [],
            slot_codes: [],
            online_states: ['online'],
            software_versions: [],
          };
        else if (path === '/msg/devices/device-1/actions/locate') {
          expect(request.method()).toBe('POST');
          locateCount++;
          if (rejectLocate) error = 'MQTT连接不可用';
          else result = { operation_id: locateCount, status: 'published' };
        } else if (path.endsWith('/http-access'))
          throw new Error('定位不应请求 HTTP 凭据');
        const body = JSON.stringify({
          code: error ? 500 : 200,
          msg: error || 'ok',
          result,
        });
        await route.fulfill({
          contentType: 'application/json',
          body:
            request.headers().security === 'true'
              ? Buffer.from(KxEd.encryptText(body))
              : body,
        });
      });
    await page.goto('/');
    await page.locator("input[name='username']").fill('locate-user');
    await page.locator("input[name='password']").fill('test-only');
    await page.getByRole('button', { name: /登录|login/i }).click();
    await expect(
      page.getByText('test-locate-sim', { exact: true }),
    ).toBeVisible();
    const cardLocate = page.getByRole('button', {
      name: '定位卡片所在设备',
      exact: true,
    });
    if (readonly) await expect(cardLocate).toHaveCount(0);
    else {
      await cardLocate.click();
      await expect(
        page.getByText('卡片所在设备的定位命令已通过 MQTT 提交', {
          exact: true,
        }),
      ).toBeVisible();
      expect(locateCount).toBe(1);
    }
    await page.goto('/msg/devices');
    await expect(
      page.getByRole('button', { name: 'device-1', exact: true }),
    ).toBeVisible();
    const locate = page.getByRole('button', { name: '定位', exact: true });
    if (readonly) await expect(locate).toHaveCount(0);
    else {
      rejectLocate = true;
      await locate.click();
      await expect(
        page.getByText('MQTT连接不可用', { exact: true }),
      ).toBeVisible();
      rejectLocate = false;
      await expect(locate).not.toHaveClass(/ant-btn-loading/);
      await locate.click();
      await expect.poll(() => locateCount).toBe(3);
      await expect(
        page.getByText('定位命令已通过 MQTT 提交', { exact: true }),
      ).toBeVisible();
      expect(locateCount).toBe(3);
    }
    expect(requests.some((path) => path.includes('/http-access'))).toBe(false);
    if (readonly) expect(locateCount).toBe(0);
  });
}
