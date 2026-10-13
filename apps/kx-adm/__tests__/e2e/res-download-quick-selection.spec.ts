import { Buffer } from 'node:buffer';

import { KxEd } from '@kx/admin-core';
import { expect, test } from '@playwright/test';

test.use({ headless: true, viewport: { width: 1400, height: 1100 } });
test('个人组保存复用、多部门去重与作品编码取模预览提交', async ({ page }) => {
  test.setTimeout(90_000);
  const writes: any[] = [];
  const groups: any[] = [];
  const user = (id: number) => ({
    value: String(id),
    title: `成员${id}（${id}）`,
    selectable: true,
    disabled: id === 9,
    children: [],
  });
  const tree = [
    {
      value: 'company:a',
      title: '测试公司',
      selectable: false,
      disabled: false,
      children: [
        {
          value: 'dept:1',
          title: '制作部',
          selectable: false,
          disabled: false,
          children: [user(7), user(8), user(9)],
        },
        {
          value: 'dept:2',
          title: '配音部',
          selectable: false,
          disabled: false,
          children: [user(7)],
        },
      ],
    },
  ];
  const decode = (request: any) =>
    request.headers().security === 'true'
      ? JSON.parse(KxEd.decryptText(request.postDataBuffer() as Buffer))
      : request.postDataJSON();
  await page.route('**/{auth,param,storage,notify,adm}/**', async (route) => {
    const request = route.request();
    if (!['fetch', 'xhr'].includes(request.resourceType()))
      return route.continue();
    const path = new URL(request.url()).pathname.replace(/^\/api(?=\/)/, '');
    let result: unknown = [];
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
    else if (path === '/auth/per/codes')
      result = ['api:res.admin.res.download_permissions.batch.save'];
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
    else if (path.endsWith('/grant-maintenance/users')) result = tree;
    else if (path.endsWith('/grant-maintenance'))
      result = { items: [], total: 0 };
    else if (path === '/adm/res/download-user-groups') {
      if (request.method() === 'GET') result = groups;
      else {
        const data = decode(request);
        expect(data.uids).toEqual([7, 8]);
        result = { id: 1, ...data, revision: 1 };
        groups.push(result);
      }
    } else if (path === '/adm/res/download-user-groups/1') {
      const data = decode(request);
      const group = groups[0];
      expect(data.revision).toBe(group.revision);
      if (request.method() === 'PUT') {
        expect(data.name).toBe('制作组二');
        expect(data.uids).toEqual([7, 8]);
        result = { ...group, ...data, revision: group.revision + 1 };
        groups[0] = result;
      } else {
        expect(request.method()).toBe('DELETE');
        groups.splice(0);
        result = true;
      }
    } else if (path.endsWith('/batch') || path.endsWith('/batch/preview')) {
      const data = decode(request);
      expect(data.mode).toBe('code_range');
      expect(data.uids).toEqual([7, 8]);
      expect(data.code_range).toEqual({
        start: '海外 aigc 1000',
        end: '海外AIGC2000',
        distribution_region: 'overseas',
        modulus: 3,
        remainder: 1,
      });
      const apply = path.endsWith('/batch');
      if (apply) {
        expect(data.expected_res_ids).toEqual([3, 4]);
        expect(data.selected_res_ids).toEqual([3, 4]);
        writes.push(data);
      }
      result = {
        matched_res_ids: [3, 4],
        granted_count: apply ? 2 : 0,
        granted_user_count: apply ? 2 : 0,
        revoked_count: 0,
        lines: [
          {
            line: 1,
            input: 'AIGC1000～AIGC2000，尾数 % 3 = 1',
            status: 'matched',
            message: '匹配 2 部剧',
            matches: [
              {
                res_id: 3,
                res_name: '第一剧',
                resource_code: 'AIGC1000',
                distribution_region: 'overseas',
                seq_num: 80,
              },
              {
                res_id: 4,
                res_name: '第二剧',
                resource_code: 'AIGC1003',
                distribution_region: 'overseas',
                seq_num: 50,
              },
            ],
          },
        ],
      };
    } else if (path === '/notify/inbox')
      result = { items: [], unread_count: 0 };
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
  await page
    .getByRole('button', { name: '按剧名 / 编码批量授权', exact: true })
    .click();
  const dialog = page.getByRole('dialog');
  const picker = dialog.getByRole('combobox', { name: '授权用户' });
  await picker.click();
  await picker.fill('成员7');
  await page
    .locator('.ant-select-tree-title:visible')
    .filter({ hasText: '成员7（7）' })
    .first()
    .click();
  await picker.fill('成员7');
  await page
    .locator('.ant-select-tree-title:visible')
    .filter({ hasText: '成员7（7）' })
    .nth(1)
    .click();
  await picker.fill('成员8');
  await page
    .locator('.ant-select-tree-title:visible')
    .filter({ hasText: '成员8（8）' })
    .click();
  await dialog.getByRole('textbox', { name: '快速选择组名称' }).fill('制作组');
  await dialog.getByRole('button', { name: '将当前选择保存为新组' }).click();
  await expect(dialog).toContainText('已保存“制作组”，共 2 人');
  await dialog
    .getByRole('button', { name: /关\s*闭/ })
    .last()
    .click();
  await page
    .getByRole('button', { name: '按剧名 / 编码批量授权', exact: true })
    .click();
  await dialog.getByRole('combobox', { name: '我的快速选择组' }).click();
  await page.getByTitle('制作组（2人）', { exact: true }).click();
  await expect(dialog).toContainText('已选择 2 人');
  await dialog.getByRole('combobox', { name: '匹配方式' }).click();
  await page
    .getByTitle('作品编码范围取模（尾部数字）', { exact: true })
    .click();
  await dialog
    .getByRole('textbox', { name: '起始作品编码（含）' })
    .fill('海外 aigc 1000');
  await dialog
    .getByRole('textbox', { name: '结束作品编码（含）' })
    .fill('海外AIGC2000');
  await dialog.getByRole('combobox', { name: '地区标签' }).click();
  await page.getByTitle('海外', { exact: true }).click();
  await dialog.getByRole('spinbutton', { name: '模数' }).fill('3');
  await dialog.getByRole('spinbutton', { name: '余数' }).fill('1');
  await dialog.getByRole('button', { name: '预览匹配' }).click();
  await expect(dialog).toContainText('AIGC1003');
  await expect(dialog).not.toContainText('#3');
  await expect(dialog).not.toContainText('#4');
  await expect(
    dialog.locator('span.text-xs').filter({ hasText: '第一剧' }),
  ).toHaveCSS('font-size', '12px');
  await expect(page.locator('.ant-select-dropdown:visible')).toHaveCount(0);
  await page.screenshot({
    path: test.info().outputPath('quick-selection.png'),
    fullPage: true,
  });
  await expect(
    dialog.getByRole('button', { name: '确认向 2 人授权 2 部剧' }),
  ).toBeEnabled();
  await dialog.getByRole('spinbutton', { name: '余数' }).fill('2');
  await expect(
    dialog.getByRole('button', { name: '确认向 2 人授权 0 部剧' }),
  ).toBeDisabled();
  await dialog.getByRole('spinbutton', { name: '余数' }).fill('1');
  await dialog.getByRole('button', { name: '预览匹配' }).click();
  await dialog.getByRole('button', { name: '确认向 2 人授权 2 部剧' }).click();
  await expect.poll(() => writes.length).toBe(1);
  await expect(dialog).toContainText('已向 2 位用户授权 2 部剧');
  await dialog
    .getByRole('textbox', { name: '快速选择组名称' })
    .fill('制作组二');
  await dialog.getByRole('button', { name: '覆盖当前组名称和成员' }).click();
  await expect(dialog).toContainText('已保存“制作组二”，共 2 人');
  await dialog.getByRole('button', { name: '删除组', exact: true }).click();
  await page.getByRole('button', { name: /^确\s*定$/ }).click();
  await expect(dialog).toContainText('已删除快速选择组，当前已选用户保留');
  expect(groups).toEqual([]);
});
