import { Buffer } from 'node:buffer';

import { KxEd } from '@kx/admin-core';
import { expect, test } from '@playwright/test';

test.use({ headless: true });
for (const writable of [true, false])
  test(`角色成员${writable ? '维护' : '只读'}入口`, async ({ page }) => {
    const role = {
      role_id: 'editor',
      role_name: '内容编辑',
      enabled: true,
      order_no: 1,
      created_at: 1,
    };
    const self = {
      id: 1,
      name: '当前管理员',
      enabled: true,
      tel: '',
      email: '',
    };
    const member = {
      id: 51,
      name: '张三',
      enabled: true,
      tel: '13800000000',
      email: 'zhang@example.test',
    };
    const candidate = {
      id: 52,
      name: '李四',
      enabled: true,
      tel: '',
      email: 'li@example.test',
    };
    const disabledMember = {
      id: 53,
      name: '停用成员',
      enabled: false,
      tel: '',
      email: '',
    };
    let members = [self, member, disabledMember];
    let failedOnce = false;
    const writes: string[] = [];
    const requests: string[] = [];
    await page.route('**/{auth,param,storage,notify,adm}/**', async (route) => {
      const request = route.request();
      if (!['fetch', 'xhr'].includes(request.resourceType()))
        return route.continue();
      const url = new URL(request.url());
      const path = url.pathname.replace(/^\/api(?=\/)/, '');
      requests.push(path);
      let result: unknown = null;
      let code = 200;
      let msg = 'ok';
      if (path === '/auth/user/access_token')
        result = {
          access_token: 'fixture',
          uid: 1,
          exp_in: 3600,
          exp_at: 4_102_444_800,
        };
      else if (path.startsWith('/auth/user/tz')) result = 'Asia/Shanghai';
      else if (path === '/auth/user/user_info')
        result = { ...self, home_path: '/system/role' };
      else if (path === '/auth/per/codes')
        result = [
          'api:auth.role_assignment.members',
          ...(writable
            ? [
                'api:auth.role_assignment.candidates',
                'api:auth.role_assignment.members.add',
                'api:auth.role_assignment.members.remove',
              ]
            : []),
        ];
      else if (path === '/auth/dt/apps') result = [];
      else if (path === '/auth/menu/current')
        result = [
          {
            id: 1,
            pid: 0,
            name: 'SystemRole',
            title: '角色管理',
            perm_type: 'menu',
            path: '/system/role',
            component: '/system/role/list',
            enabled: true,
            order_no: 1,
            meta: {},
          },
        ];
      else if (path === '/auth/role') result = { items: [role], total: 1 };
      else if (
        path === '/auth/role-assignment/editor/members' &&
        request.method() === 'GET'
      ) {
        expect(url.searchParams.get('include_self')).toBe('true');
        const keyword = url.searchParams.get('keyword') ?? '';
        const status = url.searchParams.get('enabled');
        const filtered = members.filter(
          (user) =>
            user.name.includes(keyword) &&
            (status === null || user.enabled === (status === 'true')),
        );
        result = { items: filtered, total: filtered.length };
      } else if (path === '/auth/role-assignment/editor/candidates') {
        result = {
          items: members.some((user) => user.id === 52) ? [] : [candidate],
          total: members.some((user) => user.id === 52) ? 0 : 1,
        };
      } else if (
        path === '/auth/role-assignment/editor/members' &&
        request.method() === 'POST'
      ) {
        const payload =
          request.headers().security === 'true'
            ? JSON.parse(KxEd.decryptText(request.postDataBuffer() as Buffer))
            : request.postDataJSON();
        expect(payload.uids).toEqual([52]);
        if (failedOnce) {
          members.push(candidate);
          writes.push('add:52');
        } else {
          failedOnce = true;
          code = 500;
          msg = '测试添加失败';
        }
      } else if (
        path === '/auth/role-assignment/editor/members/52' &&
        request.method() === 'DELETE'
      ) {
        members = members.filter((user) => user.id !== 52);
        writes.push('remove:52');
      } else if (path === '/notify/inbox')
        result = { items: [], unread_count: 0 };
      const body = JSON.stringify({ code, msg, result });
      await route.fulfill({
        contentType: 'application/json',
        body:
          request.headers().security === 'true'
            ? Buffer.from(KxEd.encryptText(body))
            : body,
      });
    });
    await page.goto('/');
    await page.locator("input[name='username']").fill('admin');
    await page.locator("input[name='password']").fill('123456');
    await page.getByRole('button', { name: /登录|login/i }).click();
    await page.getByRole('button', { name: '管理角色成员：内容编辑' }).click();
    const drawer = page.getByRole('dialog').filter({
      has: page.getByRole('heading', { name: '角色成员：内容编辑' }),
    });
    await expect(drawer.getByText('张三', { exact: true })).toBeVisible();
    if (writable)
      await expect(
        drawer.getByText('不可移除自己', { exact: true }),
      ).toBeVisible();
    await drawer.getByPlaceholder('搜索姓名、ID、电话或邮箱').fill('张三');
    await drawer.getByRole('button', { name: '查询成员' }).click();
    await expect(drawer.getByText('当前可见成员 1 人')).toBeVisible();
    await drawer.getByPlaceholder('搜索姓名、ID、电话或邮箱').fill('');
    await drawer.getByRole('button', { name: '查询成员' }).click();
    await drawer.getByRole('combobox', { name: '账号状态' }).click();
    await page.getByTitle('停用', { exact: true }).click();
    await expect(drawer.getByText('停用成员', { exact: true })).toBeVisible();
    await expect(drawer.getByText('张三', { exact: true })).toHaveCount(0);
    await drawer.getByRole('button', { name: '重置筛选' }).click();
    await expect(drawer.getByText('张三', { exact: true })).toBeVisible();
    if (!writable) {
      await expect(
        drawer.getByRole('button', { name: '添加用户', exact: true }),
      ).toHaveCount(0);
      await expect(
        drawer.getByRole('button', { name: /^移除角色成员：/ }),
      ).toHaveCount(0);
      expect(writes).toEqual([]);
      return;
    }
    await drawer.getByRole('button', { name: '添加用户', exact: true }).click();
    const add = page
      .getByRole('dialog')
      .filter({ has: page.getByText('添加用户到：内容编辑', { exact: true }) });
    await add
      .getByRole('row')
      .filter({ hasText: '李四' })
      .getByRole('checkbox')
      .check();
    await add.getByRole('button', { name: /确\s*定/ }).click();
    await expect(add).toBeVisible();
    await expect(
      page.getByText('测试添加失败', { exact: false }).first(),
    ).toBeVisible();
    await expect(
      add.getByText('已选 1 人，最多 100 人，支持跨页选择'),
    ).toBeVisible();
    await add.getByRole('button', { name: /确\s*定/ }).click();
    await expect(add).not.toBeVisible();
    await expect(drawer.getByText('李四', { exact: true })).toBeVisible();
    await drawer.getByRole('button', { name: '移除角色成员：李四' }).click();
    await page.getByRole('button', { name: /确\s*定/ }).click();
    await expect(drawer.getByText('李四', { exact: true })).toHaveCount(0);
    expect(writes).toEqual(['add:52', 'remove:52']);
    expect(
      requests.some((path) => path.startsWith('/auth/role/editor/users')),
    ).toBe(false);
  });
