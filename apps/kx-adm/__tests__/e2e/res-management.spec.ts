import type { Route } from '@playwright/test';

import { Buffer } from 'node:buffer';

import { KxEd } from '@kx/admin-core';
import { expect, test } from '@playwright/test';

test.use({ headless: true });

const ok = (result: unknown) => ({ code: 200, msg: 'ok', result });

test('loads dynamic RES menu and renders the resource workspace', async ({
  page,
}) => {
  const queries: URL[] = [];
  await page.route('**/api/**', (route) => {
    if (!new URL(route.request().url()).pathname.startsWith('/api/'))
      return route.continue();
    return fulfillApi(route, { items: [], unread_count: 0 });
  });
  await page.route('**/auth/**', async (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api/, '');
    if (!path.startsWith('/auth/')) return route.continue();
    if (path === '/auth/user/access_token') {
      expect(route.request().headers().security).toBe('true');
      const body = route.request().postDataBuffer();
      expect(body).not.toBeNull();
      expect(JSON.parse(KxEd.decodeText(KxEd.decrypt(body as Buffer)))).toEqual(
        {
          app_id: 'admin',
          login_type: 'user_name',
          password: '123456',
          user_name: 'admin',
        },
      );
    }
    const result = authFixture(path);
    await fulfillApi(route, result);
  });
  await page.route('**/adm/res?**', async (route) => {
    const query = new URL(route.request().url());
    queries.push(query);
    const found =
      !query.searchParams.has('id') || query.searchParams.get('id') === '10';
    await fulfillApi(route, {
      items: found
        ? [
            {
              cover: 'https://example.test/cover.jpg',
              ext_info: { tags: [] },
              id: 10,
              lang_info: { en: { res_name: 'Migration Drama' } },
              res_name: '迁移验收短剧',
              res_type: 'drama',
              state: 1,
            },
          ]
        : [],
      page_no: 1,
      page_size: 20,
      pages: 1,
      total: found ? 1 : 0,
    });
  });

  await page.goto('/');
  await page.locator("input[name='username']").fill('admin');
  await page.locator("input[name='password']").fill('123456');
  await page.getByRole('button', { name: /登录|login/i }).click();

  await expect(
    page.getByRole('button', { name: '迁移验收短剧', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('资源管理', { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByRole('menu').getByText('资源模块')).toBeVisible();
  const id = page.getByRole('spinbutton', { name: 'ID', exact: true });
  await id.fill('10');
  await expect.poll(() => queries.at(-1)?.searchParams.get('id')).toBe('10');
  expect(queries.at(-1)?.searchParams.has('id.eq')).toBe(false);
  await expect(
    page.getByRole('button', { name: '迁移验收短剧', exact: true }),
  ).toBeVisible();
  await id.fill('999999');
  await expect
    .poll(() => queries.at(-1)?.searchParams.get('id'))
    .toBe('999999');
  await expect(
    page.getByRole('button', { name: '迁移验收短剧', exact: true }),
  ).toHaveCount(0);
  await id.fill('');
  await expect.poll(() => queries.at(-1)?.searchParams.has('id')).toBe(false);
  await expect(
    page.getByRole('button', { name: '迁移验收短剧', exact: true }),
  ).toBeVisible();
});

async function fulfillApi(route: Route, result: unknown) {
  const body = JSON.stringify(ok(result));
  const encrypted = route.request().headers().security === 'true';
  await route.fulfill({
    contentType: 'application/json',
    body: encrypted ? Buffer.from(KxEd.encryptText(body)) : body,
  });
}

function authFixture(path: string) {
  switch (path) {
    case '/auth/dt/apps':
    case '/auth/per/codes': {
      return [];
    }
    case '/auth/menu/current': {
      return menuFixture();
    }
    case '/auth/user/access_token': {
      return {
        access_token: 'e2e-token',
        exp_at: 4_102_444_800,
        exp_in: 3600,
        token_type: 'Bearer',
        uid: 1,
      };
    }
    case '/auth/user/user_info': {
      return {
        avatar: '',
        created_at: 1,
        dept_id: 0,
        email: 'admin@example.test',
        enabled: true,
        home_path: '/res/seas/global/source_manage',
        id: 1,
        is_guest: false,
        name: '管理员',
        os: 'web',
        permission_count: 4,
        platform: 'web',
        reg_ip: '127.0.0.1',
        tel: '',
        updated_at: 1,
      };
    }
    default: {
      return null;
    }
  }
}

function menuFixture() {
  return [
    {
      auth_code: '',
      component: 'BasicLayout',
      enabled: true,
      id: 1,
      meta: { icon: 'lucide:library', keep_alive: true },
      name: 'Res',
      order_no: 1,
      path: '/res',
      perm_type: 'catalog',
      pid: 0,
      redirect: '/res/seas/global/source_manage',
      title: '资源模块',
    },
    {
      auth_code: '',
      component: '/res/seas/global/source_manage/index',
      enabled: true,
      id: 2,
      meta: { keep_alive: true },
      name: 'ResContent',
      order_no: 1,
      path: '/res/seas/global/source_manage',
      perm_type: 'menu',
      pid: 1,
      redirect: null,
      title: '资源管理',
    },
  ];
}
