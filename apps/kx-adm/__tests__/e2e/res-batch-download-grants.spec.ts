import { Buffer } from 'node:buffer';

import { KxEd } from '@kx/admin-core';
import { expect, test } from '@playwright/test';

test.use({ headless: true });
test('批量下载授权按名称和编码预览、提交、失败反馈与刷新', async ({ page }) => {
  test.setTimeout(90_000);
  const writes: any[] = [];
  let grantReads = 0;
  const singleWrites: any[] = [];
  const filterRequests: URL[] = [];
  let failSave = false;
  let failTree = true;
  const user = { id: 7, name: '测试用户', tel: '', email: '' };
  const match = {
    res_id: 3,
    res_name: '匹配剧',
    resource_code: 'DR-3',
    seq_num: 80,
  };
  const second = {
    res_id: 4,
    res_name: '同编码剧',
    resource_code: 'DR-3',
    seq_num: 60,
  };
  const third = {
    res_id: 5,
    res_name: '其他编码剧',
    resource_code: 'DR-5',
    seq_num: 100,
  };
  await page.route('**/{auth,param,storage,notify,adm}/**', async (route) => {
    const request = route.request();
    if (!['fetch', 'xhr'].includes(request.resourceType()))
      return route.continue();
    const path = new URL(request.url()).pathname.replace(/^\/api(?=\/)/, '');
    let result: unknown = null;
    if (path === '/auth/user/access_token')
      result = {
        access_token: 'fixture',
        uid: 1,
        exp_in: 3600,
        exp_at: 4_102_444_800,
      };
    else if (path.startsWith('/auth/user/tz')) result = 'Asia/Shanghai';
    else if (path === '/auth/user/user_info')
      result = {
        id: 1,
        name: '管理员',
        enabled: true,
        home_path: '/res/seas/download-authorizations',
      };
    else if (path === '/auth/per/codes') result = ['res:download:authorize'];
    else if (path === '/auth/dt/apps') result = [];
    else if (path === '/auth/menu/current')
      result = [
        {
          id: 1,
          pid: 0,
          name: 'ResDownloadAuthorization',
          title: '授权维护',
          perm_type: 'menu',
          path: '/res/seas/download-authorizations',
          component: '/res/seas/download-authorizations/index',
          enabled: true,
          order_no: 1,
          meta: {},
        },
      ];
    else if (path === '/adm/res/download-users/tree') {
      if (failTree)
        return route.fulfill({ status: 503, body: '组织树暂时不可用' });
      result = [
        {
          value: 'company:test',
          title: '测试公司',
          selectable: false,
          disabled: false,
          children: [
            {
              value: 'dept:10',
              title: '运营部',
              selectable: false,
              disabled: false,
              children: [
                {
                  value: '7',
                  title: '测试用户（7）',
                  selectable: true,
                  disabled: false,
                  children: [],
                },
                {
                  value: '8',
                  title: '第二用户（8）',
                  selectable: true,
                  disabled: false,
                  children: [],
                },
                {
                  value: '9',
                  title: '停用用户（9）',
                  selectable: true,
                  disabled: true,
                  children: [],
                },
              ],
            },
          ],
        },
      ];
    } else if (path === '/adm/res/download-users')
      result = { items: [user], total: 1 };
    else if (path.endsWith('/batch') || path.endsWith('/batch/preview')) {
      const body =
        request.headers().security === 'true'
          ? JSON.parse(KxEd.decryptText(request.postDataBuffer() as Buffer))
          : request.postDataJSON();
      const apply = path.endsWith('/batch');
      if (apply && failSave)
        return route.fulfill({
          status: 409,
          body: JSON.stringify({
            code: 409,
            msg: '匹配结果已变化，请重新预览后授权',
          }),
        });
      if (apply) {
        if (body.grant.can_download) {
          expect(body.grant.uid).toBe(7);
          expect(body.uids).toEqual([7, 8]);
        }
        expect(body.expected_res_ids).toEqual(
          body.mode === 'name' ? [3] : [3, 4, 5],
        );
        expect(body.selected_res_ids).toEqual([3]);
        writes.push(body);
      }
      const input = body.mode === 'name' ? '匹配剧' : 'DR-3';
      expect(body.text).toContain(body.mode === 'name' ? '匹配剧' : 'dr-3');
      result = {
        matched_res_ids: body.mode === 'name' ? [3] : [3, 4, 5],
        granted_count: apply && body.grant.can_download ? 1 : 0,
        granted_user_count: apply && body.grant.can_download ? 2 : 0,
        revoked_count: apply && !body.grant.can_download ? 2 : 0,
        lines: [
          ...(body.mode === 'code'
            ? [
                {
                  line: 4,
                  input: 'DR-5',
                  status: 'matched',
                  message: '匹配 1 部剧',
                  matches: [third],
                },
              ]
            : []),
          {
            line: 1,
            input,
            status: 'matched',
            message: body.mode === 'name' ? '匹配 1 部剧' : '匹配 2 部剧',
            matches: body.mode === 'name' ? [match] : [match, second],
          },
          {
            line: 2,
            input: 'missing',
            status: 'not_found',
            message: '未找到匹配短剧',
            matches: [],
          },
          {
            line: 3,
            input,
            status: 'duplicate',
            message: '重复输入，已忽略',
            matches: [],
          },
        ],
      };
    } else if (path === '/adm/res/list')
      result = [{ id: 3, res_name: '匹配剧' }];
    else if (
      path === '/adm/res/3/download-permissions' &&
      request.method() === 'PUT'
    ) {
      singleWrites.push(
        JSON.parse(KxEd.decryptText(request.postDataBuffer() as Buffer)),
      );
      result = [];
    } else if (path === '/adm/res/download-permissions') {
      filterRequests.push(new URL(request.url()));
      grantReads += 1;
      result = {
        items:
          writes.length > 0
            ? [
                {
                  id: 1,
                  ...match,
                  uid: 7,
                  user_name: user.name,
                  granted_by: 1,
                  granted_by_name: '授权管理员',
                  created_at: 1_700_000_000,
                  updated_at: 1_700_000_000,
                  can_download: true,
                  valid_from: 0,
                  valid_until: 0,
                },
              ]
            : [],
        total: writes.length,
      };
    } else if (path.startsWith('/adm/res')) result = [];
    else if (path === '/notify/inbox') result = { items: [], unread_count: 0 };
    const body = JSON.stringify({ code: 200, msg: 'ok', result });
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
  await page.getByRole('button', { name: '批量授权', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(
    dialog.getByRole('textbox', { name: '作品编码列表' }),
  ).toBeVisible();
  await expect(dialog.getByPlaceholder('生效时间')).not.toHaveValue('');
  await expect(dialog.getByPlaceholder('失效时间')).not.toHaveValue('');
  await dialog.getByRole('combobox', { name: '匹配方式' }).click();
  await page.getByTitle('每行一个剧名关键字', { exact: true }).click();
  await expect(
    dialog.getByRole('combobox', { name: '授权用户' }),
  ).toBeDisabled();
  failTree = false;
  await dialog.getByRole('button', { name: '重新加载组织树' }).click();
  await dialog.getByRole('combobox', { name: '授权用户' }).click();
  await expect(page.getByText('测试公司', { exact: true })).toBeVisible();
  await page
    .locator('.ant-select-tree-treenode:visible')
    .filter({ hasText: '测试公司' })
    .locator('.ant-select-tree-switcher')
    .click();
  await page
    .locator('.ant-select-tree-treenode:visible')
    .filter({ hasText: '运营部' })
    .locator('.ant-select-tree-switcher')
    .click();
  await page.getByText('测试用户（7）', { exact: true }).click();
  await page.getByText('第二用户（8）', { exact: true }).click();
  await dialog
    .getByRole('textbox', { name: '剧名列表' })
    .fill('匹配剧\nmissing\n匹配剧');
  await expect(
    dialog.getByRole('button', { name: '确认向 2 人授权 0 部剧' }),
  ).toBeDisabled();
  await dialog.getByRole('button', { name: '预览匹配' }).click();
  await expect(dialog).toContainText('未找到匹配短剧');
  await expect(dialog).toContainText('重复输入，已忽略');
  const before = grantReads;
  await dialog.getByRole('button', { name: '确认向 2 人授权 1 部剧' }).click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0].grant.valid_until - writes[0].grant.valid_from).toBe(
    7 * 86_400,
  );
  expect(Math.abs(writes[0].grant.valid_from - Date.now() / 1000)).toBeLessThan(
    120,
  );
  await expect.poll(() => grantReads).toBeGreaterThan(before);
  await expect(
    dialog.getByRole('button', { name: '确认向 2 人授权 1 部剧' }),
  ).toBeDisabled();
  await dialog.getByRole('combobox', { name: '匹配方式' }).click();
  await page.getByTitle('每行一个作品编码关键字', { exact: true }).click();
  await dialog
    .getByRole('textbox', { name: '作品编码列表' })
    .fill('dr-3\nmissing\ndr-3\nDR-5');
  await expect(
    dialog.getByRole('button', { name: '确认向 2 人授权 0 部剧' }),
  ).toBeDisabled();
  await dialog.getByPlaceholder('生效时间').click();
  await page.getByText('未来 30 天', { exact: true }).click();
  await dialog.getByRole('button', { name: '预览匹配' }).click();
  await expect(dialog).toContainText('80 集');
  await expect(dialog).toContainText('60 集');
  await expect(dialog).toContainText('100 集');
  await dialog
    .getByRole('button', { name: '移除剧目 同编码剧 #4', exact: true })
    .click();
  await dialog
    .getByRole('button', { name: '移除 DR-5 全部剧目', exact: true })
    .click();
  await expect(
    dialog.getByRole('button', { name: '移除 DR-3 全部剧目', exact: true }),
  ).toHaveText(/移\s*除/);
  failSave = true;
  await dialog.getByRole('button', { name: '确认向 2 人授权 1 部剧' }).click();
  await expect(
    dialog.getByRole('button', { name: '确认向 2 人授权 0 部剧' }),
  ).toBeDisabled();
  await expect(
    dialog.getByRole('alert').filter({ hasText: /失败|变化/ }),
  ).toBeVisible();
  expect(writes).toHaveLength(1);
  failSave = false;
  await dialog.getByRole('button', { name: '预览匹配' }).click();
  await expect(
    dialog.getByRole('button', { name: '确认向 2 人授权 3 部剧' }),
  ).toBeEnabled();
  await dialog
    .getByRole('button', { name: '移除剧目 同编码剧 #4', exact: true })
    .click();
  await dialog
    .getByRole('button', { name: '移除 DR-5 全部剧目', exact: true })
    .click();
  await dialog.getByRole('button', { name: '确认向 2 人授权 1 部剧' }).click();
  await expect.poll(() => writes.length).toBe(2);
  expect(writes[1].mode).toBe('code');
  expect(writes[1].grant.valid_until - writes[1].grant.valid_from).toBe(
    30 * 86_400,
  );
  await dialog.getByRole('button', { name: /完\s*成/ }).click();
  const grantRow = page
    .getByRole('main')
    .getByRole('row')
    .filter({ hasText: '匹配剧' });
  await expect(
    grantRow.getByRole('cell').filter({ hasText: '授权管理员' }),
  ).toContainText('ID：1');
  await expect(
    grantRow.getByRole('cell').filter({ hasText: '测试用户' }),
  ).toContainText('ID：7');
  await expect(grantRow).toContainText('2023-11');
  const userFilter = page.getByRole('combobox', { name: /^用户\s*:?$/ });
  await userFilter.click();
  await userFilter.fill('停用用户');
  await page
    .getByText('停用用户（9）', { exact: true })
    .and(page.locator(':visible'))
    .click();
  await page.getByRole('button', { name: /查\s*询/ }).click();
  await expect(userFilter).toHaveAttribute('aria-expanded', 'false');
  await expect(
    page
      .getByText('停用用户（9）', { exact: true })
      .and(page.locator(':visible')),
  ).toBeVisible();
  await expect
    .poll(() => filterRequests.at(-1)?.searchParams.get('uids[0]'))
    .toBe('9');
  await userFilter.click();
  await userFilter.fill('测试用户');
  await page
    .getByText('测试用户（7）', { exact: true })
    .and(page.locator(':visible'))
    .click();
  await page.getByRole('button', { name: /查\s*询/ }).click();
  await expect
    .poll(() => filterRequests.at(-1)?.searchParams.getAll('uids[1]'))
    .toEqual(['7']);
  await page.getByRole('button', { name: '新增授权', exact: true }).click();
  const single = page.getByRole('dialog', { name: '新增授权', exact: true });
  await single.getByRole('combobox').first().click();
  await page.getByTitle('匹配剧（3）', { exact: true }).click();
  const selectedUsers = single.getByRole('combobox', { name: '授权用户' });
  await selectedUsers.click();
  await selectedUsers.fill('测试用户');
  await page
    .getByText('测试用户（7）', { exact: true })
    .and(page.locator('.ant-select-tree-title:visible'))
    .click();
  await selectedUsers.fill('第二用户');
  await page
    .getByText('第二用户（8）', { exact: true })
    .and(page.locator('.ant-select-tree-title:visible'))
    .click();
  await single.getByText('允许下载', { exact: true }).click();
  await single.getByRole('button', { name: '保存授权', exact: true }).click();
  await expect(single).not.toBeVisible();
  expect(singleWrites).toEqual([
    [7, 8].map((uid) => ({
      uid,
      can_download: true,
      seq_from: 0,
      seq_until: 0,
      valid_from: 0,
      valid_until: 0,
    })),
  ]);
  await page.getByRole('button', { name: '批量取消授权', exact: true }).click();
  await expect(dialog.getByPlaceholder('生效时间')).toHaveCount(0);
  await dialog
    .getByRole('textbox', { name: '作品编码列表' })
    .fill('dr-3\nDR-5');
  await dialog.getByRole('button', { name: '预览匹配' }).click();
  await dialog
    .getByRole('button', { name: '移除 DR-3 全部剧目', exact: true })
    .click();
  await dialog
    .getByRole('button', { name: '移除 DR-5 全部剧目', exact: true })
    .click();
  await expect(
    dialog.getByRole('button', { name: '确认取消 2 人的 0 部剧授权' }),
  ).toBeDisabled();
  await dialog.getByRole('button', { name: '预览匹配' }).click();
  await dialog
    .getByRole('button', { name: '移除剧目 同编码剧 #4', exact: true })
    .click();
  await dialog
    .getByRole('button', { name: '移除 DR-5 全部剧目', exact: true })
    .click();
  const beforeRevoke = grantReads;
  await dialog
    .getByRole('button', { name: '确认取消 2 人的 1 部剧授权' })
    .click();
  await expect.poll(() => writes.length).toBe(3);
  expect(writes[2].grant.can_download).toBe(false);
  expect(writes[2].uids).toEqual([9, 7]);
  await expect(dialog).toContainText('已取消 2 条授权');
  await expect.poll(() => grantReads).toBeGreaterThan(beforeRevoke);
  await expect(
    dialog.getByRole('button', { name: '确认取消 2 人的 1 部剧授权' }),
  ).toBeDisabled();
});
