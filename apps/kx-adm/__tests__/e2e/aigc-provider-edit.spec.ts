import { Buffer } from 'node:buffer';

import { KxEd } from '@kx/admin-core';
import { expect, test } from '@playwright/test';

test.use({ headless: true });

test('网关配置编辑只提交写入 DTO 并刷新列表', async ({ page }, info) => {
  const groups = [
    {
      id: 1,
      code: 'group',
      name: '测试分组',
      priority: 0,
      load_strategy: 'priority',
      enabled: true,
      created_at: 123,
    },
  ];
  const providers = [
    {
      id: 2,
      group_id: 1,
      code: 'provider',
      name: '测试供应商',
      protocol: 'openai',
      base_url: 'https://example.com/v1',
      credential_code: 'test-credential',
      priority: 0,
      weight: 1,
      enabled: true,
      fail_threshold: 3,
      open_duration_secs: 30,
      breaker_statuses: [401, 429],
      created_at: 123,
      updated_at: 456,
    },
  ];
  const models = [
    {
      id: 3,
      provider_id: 2,
      canonical_model: 'test-model',
      upstream_model: 'upstream-model',
      aliases: [],
      capabilities: ['chat'],
      input_price: '1',
      output_price: '2',
      enabled: true,
      created_at: 123,
    },
  ];
  const writes: Record<string, unknown>[] = [];
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page
    .context()
    .route('**/{auth,notify,param,adm,credential,aigc}/**', async (route) => {
      if (!['fetch', 'xhr'].includes(route.request().resourceType()))
        return route.continue();
      const path = new URL(route.request().url()).pathname.replace(
        /^\/api(?=\/)/,
        '',
      );
      let result: unknown = null;
      if (path === '/auth/user/access_token')
        result = {
          access_token: 'test-token',
          token_type: 'Bearer',
          uid: 7,
          exp_at: 4_102_444_800,
          exp_in: 3600,
        };
      else if (path === '/auth/user/user_info')
        result = {
          id: 7,
          name: '网关管理员',
          enabled: true,
          home_path: '/aigc-gateway',
          avatar: '',
          permission_count: 1,
          is_guest: false,
        };
      else if (path === '/auth/per/codes') result = [];
      else if (path === '/auth/menu/current')
        result = [
          {
            id: 1,
            pid: 0,
            name: 'AigcGateway',
            title: 'AI 网关',
            path: '/aigc-gateway',
            component: '/aigc-gateway/index',
            perm_type: 'menu',
            enabled: true,
            order_no: 1,
            auth_code: '',
            meta: {},
            redirect: null,
          },
        ];
      else if (path === '/notify/inbox')
        result = { items: [], unread_count: 0 };
      else if (path === '/aigc/admin/overview')
        result = {
          providers: 1,
          active_keys: 0,
          requests: 0,
          total_tokens: 0,
          total_cost: '0',
          open_breakers: 0,
        };
      else if (path === '/aigc/admin/requests') result = { items: [] };
      else if (
        [
          '/aigc/admin/api-keys',
          '/aigc/admin/breakers',
          '/aigc/admin/media/jobs',
          '/credential/items/all',
        ].includes(path)
      )
        result = [];
      else {
        for (const [resource, rows] of [
          ['groups', groups],
          ['providers', providers],
          ['models', models],
        ] as const) {
          if (path === `/aigc/admin/${resource}`) result = rows;
          else if (
            path === `/aigc/admin/${resource}/${rows[0].id}` &&
            route.request().method() === 'PUT'
          ) {
            const bytes = route.request().postDataBuffer();
            if (!bytes) throw new Error('missing request body');
            const data = JSON.parse(
              KxEd.decodeText(KxEd.decrypt(bytes)),
            ) as Record<string, unknown>;
            const expectedKeys = Object.keys(rows[0]).filter(
              (key) => !['created_at', 'id', 'updated_at'].includes(key),
            );
            expect(Object.keys(data).toSorted()).toEqual(
              expectedKeys.toSorted(),
            );
            writes.push(data);
            Object.assign(rows[0], data);
            result = rows[0];
          }
        }
      }
      const text = JSON.stringify({ code: 200, msg: 'ok', result });
      await route.fulfill({
        body:
          route.request().headers().security === 'true'
            ? Buffer.from(KxEd.encryptText(text))
            : text,
        contentType: 'application/json',
      });
    });
  await page.goto('/');
  await page.locator("input[name='username']").fill('gateway-admin');
  await page.locator("input[name='password']").fill('test-only');
  await page.getByRole('button', { name: /登录|login/i }).click();
  await expect(page).toHaveURL(/\/aigc-gateway$/, { timeout: 30_000 });

  for (const [tab, title, before, after, label] of [
    ['Provider', 'Provider', '测试供应商', '修改后的供应商', '名称'],
    ['分组', 'Provider 分组', '测试分组', '修改后的分组', '名称'],
    ['模型路由', '模型路由', 'test-model', 'updated-model', '内部模型 ID'],
  ]) {
    await page.getByRole('tab', { name: tab, exact: true }).click();
    await page.getByRole('button', { name: before, exact: true }).click();
    const dialog = page.getByRole('dialog', { name: title, exact: true });
    await expect(dialog).toBeVisible();
    await dialog
      .locator('.ant-form-item')
      .filter({
        has: page.locator('label', { hasText: new RegExp(`^${label}$`) }),
      })
      .getByRole('textbox')
      .fill(after);
    await dialog.getByRole('button', { name: /确\s*定|OK/ }).click();
    await expect(dialog).toBeHidden();
    await expect(
      page.getByRole('button', { name: after, exact: true }),
    ).toBeVisible();
  }
  expect(writes).toHaveLength(3);
  expect(writes[0]?.name).toBe('修改后的供应商');
  expect(writes[1]?.name).toBe('修改后的分组');
  expect(writes[2]?.canonical_model).toBe('updated-model');
  expect(errors).toEqual([]);
  await page.screenshot({
    path: info.outputPath('aigc-config-edited.png'),
    animations: 'disabled',
  });
});
