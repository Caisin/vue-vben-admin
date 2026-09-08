import type {
  AccountDetail,
  AccountType,
  AccountTypeWrite,
  AccountWrite,
} from '../../src/api/account-manager';

import { Buffer } from 'node:buffer';

import { KxEd } from '@kx/admin-core';
import { expect, test } from '@playwright/test';

test.use({ headless: true, actionTimeout: 10_000 });
for (const readonly of [false, true]) {
  test(`动态账户${readonly ? '只读隔离' : '类型、字段、账户和密码查看'}`, async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const types: AccountType[] = [
      {
        id: 1,
        code: 'third_party_payment',
        name: '第三方支付账户',
        enabled: true,
        version: 1,
        created_at: 1,
        updated_at: 1,
        fields: [
          {
            key: 'login_url',
            label: '登录地址',
            kind: 'url',
            required: false,
            sensitive: false,
            enabled: true,
            options: [],
          },
          {
            key: 'certified_subject',
            label: '认证主体',
            kind: 'text',
            required: false,
            sensitive: false,
            enabled: true,
            options: [],
          },
          {
            key: 'account',
            label: '账号',
            kind: 'text',
            required: true,
            sensitive: false,
            enabled: true,
            options: [],
          },
          {
            key: 'password',
            label: '密码',
            kind: 'password',
            required: false,
            sensitive: true,
            enabled: true,
            options: [],
          },
          {
            key: 'email',
            label: '邮箱',
            kind: 'email',
            required: false,
            sensitive: false,
            enabled: true,
            options: [],
          },
        ],
      },
    ];
    const initialType = types[0];
    if (!initialType) throw new Error('missing type');
    const records: AccountDetail[] = [
      {
        id: 1,
        type_id: 1,
        name: '已有账户',
        owner_uid: 7,
        version: 1,
        created_at: 1,
        updated_at: 1,
        values: { account: 'owner@example.test' },
        configured_secrets: ['password'],
        account_type: initialType,
      },
    ];
    const writes: AccountWrite[] = [];
    const secrets = new Map<number, string>([[1, 'existing-test-only-secret']]);
    let revealCount = 0;
    await page
      .context()
      .route('**/{auth,notify,account-manager}/**', async (route) => {
        if (!['fetch', 'xhr'].includes(route.request().resourceType()))
          return route.continue();
        const request = route.request();
        const path = new URL(request.url()).pathname.replace(
          /^\/api(?=\/)/,
          '',
        );
        const method = request.method();
        const bytes = request.postDataBuffer();
        const body = bytes
          ? JSON.parse(
              request.headers().security === 'true'
                ? KxEd.decodeText(KxEd.decrypt(bytes))
                : bytes.toString(),
            )
          : {};
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
            name: '账户管理员',
            enabled: true,
            home_path: '/account-manager/types',
            avatar: '',
            permission_count: 1,
            is_guest: false,
          };
        else if (path === '/auth/per/codes')
          result = readonly
            ? []
            : [
                'account-manager:write',
                'account-manager:type-write',
                'account-manager:reveal',
              ];
        else if (path === '/auth/menu/current')
          result = [
            {
              id: 1,
              pid: 0,
              name: 'ManagedAccountTypes',
              title: '账户类型',
              path: '/account-manager/types',
              component: '/account-manager/types',
              perm_type: 'menu',
              enabled: true,
              order_no: 1,
              auth_code: '',
              meta: {},
              redirect: null,
            },
            {
              id: 2,
              pid: 0,
              name: 'ManagedAccounts',
              title: '账户列表',
              path: '/account-manager/accounts',
              component: '/account-manager/accounts',
              perm_type: 'menu',
              enabled: true,
              order_no: 2,
              auth_code: '',
              meta: {},
              redirect: null,
            },
          ];
        else if (path === '/auth/user/mfa/step-up')
          result = {
            grant_token: 'test-reveal-grant',
            expires_at: 4_102_444_800,
            action: 'credential.reveal',
          };
        else if (path === '/notify/inbox')
          result = { items: [], unread_count: 0 };
        else if (path === '/account-manager/types' && method === 'GET')
          result = types;
        else if (path === '/account-manager/types' && method === 'POST') {
          const input = body as AccountTypeWrite;
          const row = {
            ...input,
            id: types.length + 1,
            version: 1,
            created_at: 1,
            updated_at: 1,
          };
          types.push(row);
          result = row;
        } else if (/\/types\/\d+$/.test(path)) {
          const type = types.find(
            (row) => row.id === Number(path.split('/').at(-1)),
          );
          if (!type) throw new Error('unknown type');
          if (method === 'PUT')
            Object.assign(type, body, { version: type.version + 1 });
          result = type;
        } else if (path === '/account-manager/accounts' && method === 'GET')
          result = {
            items: records.map(
              ({
                id,
                name,
                type_id,
                version,
                owner_uid,
                created_at,
                updated_at,
              }) => ({
                id,
                name,
                type_id,
                version,
                owner_uid,
                created_at,
                updated_at,
              }),
            ),
            total: records.length,
          };
        else if (path.endsWith('/reveal')) {
          expect(request.headers()['x-kx-step-up-token']).toBe(
            'test-reveal-grant',
          );
          revealCount++;
          result = { value: secrets.get(Number(path.split('/').at(-4))) };
        } else if (path.startsWith('/account-manager/accounts')) {
          const id =
            method === 'POST'
              ? records.length + 1
              : Number(path.split('/').at(-1));
          let record = records.find((row) => row.id === id);
          if (method === 'POST' || method === 'PUT') {
            const input = body as AccountWrite;
            writes.push(input);
            const type = types.find((row) => row.id === input.type_id);
            if (!type) throw new Error('missing account type');
            expect(input.type_version).toBe(type.version);
            const publicValues = { ...record?.values, ...input.values };
            if (typeof publicValues.password === 'string')
              secrets.set(id, publicValues.password);
            delete publicValues.password;
            const updated: AccountDetail = {
              id,
              name: input.name,
              type_id: input.type_id,
              owner_uid: 7,
              version: (record?.version ?? 0) + 1,
              created_at: 1,
              updated_at: 2,
              values: publicValues,
              account_type: type,
              configured_secrets: secrets.has(id) ? ['password'] : [],
            };
            if (record) Object.assign(record, updated);
            else {
              records.push(updated);
              record = updated;
            }
          }
          result = record;
        }
        const text = JSON.stringify({ code: 200, msg: 'ok', result });
        await route.fulfill({
          contentType: 'application/json',
          body:
            request.headers().security === 'true'
              ? Buffer.from(KxEd.encryptText(text))
              : text,
        });
      });
    await page.goto('/');
    await page.locator("input[name='username']").fill('account-admin');
    await page.locator("input[name='password']").fill('test-only');
    await page.getByRole('button', { name: /登录|login/i }).click();
    await expect(page).toHaveURL(/\/account-manager\/types$/, {
      timeout: 30_000,
    });
    if (readonly) {
      await expect(
        page.getByRole('button', { name: '新增账户类型' }),
      ).toHaveCount(0);
      await expect(page.getByRole('button', { name: '维护字段' })).toHaveCount(
        0,
      );
      await page.goto('/account-manager/accounts');
      await expect(page.getByRole('button', { name: '新增账户' })).toHaveCount(
        0,
      );
      await page.getByRole('button', { name: '详情', exact: true }).click();
      await expect(
        page.getByRole('dialog', { name: '账户详情' }),
      ).toContainText('已设置');
      await expect(page.getByRole('button', { name: '查看密码' })).toHaveCount(
        0,
      );
      expect(writes).toEqual([]);
      expect(revealCount).toBe(0);
      return;
    }
    await page.getByRole('button', { name: '维护字段' }).click();
    const typeDialog = page.getByRole('dialog', {
      name: '编辑账户类型',
      exact: true,
    });
    await typeDialog
      .getByRole('button', { name: '添加字段', exact: true })
      .click();
    await typeDialog
      .getByRole('textbox', { name: '字段名称 6', exact: true })
      .fill('商户编号');
    await typeDialog
      .getByRole('checkbox', { name: '必填', exact: true })
      .last()
      .check();
    await typeDialog.getByRole('button', { name: /确\s*定|OK/ }).click();
    await expect(typeDialog).toBeHidden();
    await page.goto('/account-manager/accounts');
    await page.getByRole('button', { name: '新增账户', exact: true }).click();
    const form = page.getByRole('dialog', { name: '新增账户', exact: true });
    await form
      .getByRole('textbox', { name: '账户名称', exact: true })
      .fill('Stripe 测试账户');
    for (const [label, value] of [
      ['登录地址', 'https://example.test/login'],
      ['认证主体', '测试公司'],
      ['账号', 'merchant@example.test'],
      ['邮箱', 'finance@example.test'],
      ['商户编号', 'merchant-42'],
    ]) {
      await form.getByLabel(label, { exact: true }).fill(value);
    }
    await form
      .locator('input[type="password"]')
      .fill('test-only-private-password');
    await form.getByRole('button', { name: /确\s*定|OK/ }).click();
    await expect(form).toBeHidden();
    const row = page.getByRole('row').filter({ hasText: 'Stripe 测试账户' });
    await row.getByRole('button', { name: '详情', exact: true }).click();
    const details = page.getByRole('dialog', { name: '账户详情', exact: true });
    await expect(details).toContainText('merchant-42');
    await expect(details).not.toContainText('test-only-private-password');
    await details
      .getByRole('button', { name: '查看密码', exact: true })
      .click();
    const reveal = page.getByRole('dialog', { name: '查看密码', exact: true });
    await reveal
      .getByRole('textbox', { name: '动态验证码', exact: true })
      .fill('123456');
    await reveal
      .getByRole('button', { name: '验证并查看', exact: true })
      .click();
    await expect(
      reveal.getByRole('textbox', { name: '敏感字段明文', exact: true }),
    ).toHaveValue('test-only-private-password');
    await reveal.getByRole('button', { name: '关闭', exact: true }).click();
    await details.getByRole('button', { name: '关闭', exact: true }).click();
    await row.getByRole('button', { name: '编辑', exact: true }).click();
    const edit = page.getByRole('dialog', { name: '编辑账户', exact: true });
    await expect(edit.locator('input[type="password"]')).toHaveValue('');
    await edit.getByLabel('邮箱', { exact: true }).fill('new@example.test');
    await edit.getByRole('button', { name: /确\s*定|OK/ }).click();
    await expect(edit).toBeHidden();
    expect(writes.at(-1)?.values.password).toBeUndefined();
    expect(revealCount).toBe(1);
    await page.goto('/account-manager/types');
    await page
      .getByRole('button', { name: '新增账户类型', exact: true })
      .click();
    const newType = page.getByRole('dialog', {
      name: '新增账户类型',
      exact: true,
    });
    await newType.getByRole('textbox', { name: '类型名称' }).fill('社交账户');
    await newType.getByRole('textbox', { name: '类型编码' }).fill('social');
    await newType.getByRole('button', { name: '添加字段' }).click();
    await newType
      .getByRole('textbox', { name: '字段名称 1', exact: true })
      .fill('用户名');
    await newType.getByRole('button', { name: /确\s*定|OK/ }).click();
    await expect(newType).toBeHidden();
    expect(types).toHaveLength(2);
    await page.goto('/account-manager/accounts');
    await page.getByRole('button', { name: '新增账户', exact: true }).click();
    await form
      .getByRole('textbox', { name: '账户名称', exact: true })
      .fill('社交测试账户');
    await form.getByRole('combobox').first().click();
    await page.getByTitle('社交账户', { exact: true }).click();
    await form.getByLabel('用户名', { exact: true }).fill('social-user');
    await expect(form.locator('input[type="password"]')).toHaveCount(0);
    await form.getByRole('button', { name: /确\s*定|OK/ }).click();
    await expect(form).toBeHidden();
    expect(writes.at(-1)?.type_id).toBe(2);
    expect(Object.values(writes.at(-1)?.values ?? {})).toEqual(['social-user']);
  });
}
