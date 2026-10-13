import { Buffer } from 'node:buffer';

import { KxEd } from '@kx/admin-core';
import { expect, test } from '@playwright/test';

test.use({ headless: true, viewport: { width: 1400, height: 1100 } });
test('交付按编码预览多个版本，移除单版、批量授权和取消、资料单独授权', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const writes: { path: string; body: any }[] = [];
  let reads = 0;
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
        name: '负责人',
        enabled: true,
        home_path: '/production/authorizations',
      };
    else if (path === '/auth/per/codes')
      result = [
        'api:res.delivery.grants.batch.authorize',
        'api:res.delivery.grants.batch.revoke',
      ];
    else if (path === '/auth/menu/current')
      result = [
        {
          id: 1,
          pid: 0,
          name: 'ResDeliveryAuthorization',
          title: '交付授权维护',
          perm_type: 'menu',
          path: '/production/authorizations',
          component: '/res/seas/review/authorizations',
          enabled: true,
          order_no: 1,
          meta: {},
        },
      ];
    else if (path === '/adm/res/delivery/grant-maintenance/users')
      result = [7, 8].map((id) => ({
        value: String(id),
        title: `成员${id}`,
        selectable: true,
        disabled: false,
        children: [],
      }));
    else if (path === '/adm/res/download-user-groups')
      result = [{ id: 1, name: '剪辑组', uids: [7, 8], revision: 1 }];
    else if (path === '/adm/res/delivery/grant-maintenance') {
      reads++;
      result = { items: [], total: 0 };
    } else if (path.includes('/delivery/grant-maintenance/batch/')) {
      const body =
        request.headers().security === 'true'
          ? JSON.parse(KxEd.decryptText(request.postDataBuffer() as Buffer))
          : request.postDataJSON();
      expect(body.matching.mode).toBe('code');
      expect(body.matching.text).toBe('AIGC0002');
      expect(body.matching.uids).toEqual([7, 8]);
      expect(body.matching.expected_res_ids).toBeUndefined();
      const materials = body.version_kind === 'materials';
      const versionNames: Record<number, string> = {
        11: '成片首版',
        12: '成片第二版',
        21: '成片首版',
        31: '项目资料',
      };
      const matches = (materials ? [31] : [11, 12, 21]).map((id) => ({
        res_id: id === 21 ? -2 : -1,
        res_name: id === 21 ? '作品二' : '作品一',
        resource_code: 'AIGC0002',
        seq_num: 80,
        distribution_region: 'domestic',
        version_id: id,
        version_name: versionNames[id],
        version_kind: materials ? 'materials' : 'film',
      }));
      const apply = !path.endsWith('/preview');
      if (apply) {
        expect(body.expected_version_ids).toEqual(
          materials ? [31] : [11, 12, 21],
        );
        expect(body.selected_version_ids).toEqual(materials ? [31] : [11]);
        if (!path.endsWith('/revoke'))
          expect(body.modules).toEqual(
            materials ? ['prompt', 'poster'] : ['film'],
          );
        writes.push({ path, body });
      }
      result = {
        matched_res_ids: materials ? [-1] : [-1, -2],
        matched_version_ids: materials ? [31] : [11, 12, 21],
        granted_count: apply ? 1 : 0,
        granted_user_count: apply ? 2 : 0,
        revoked_count: path.endsWith('/revoke') ? 2 : 0,
        lines: [
          {
            line: 1,
            input: 'AIGC0002',
            status: 'matched',
            message: `匹配 ${matches.length} 个交付版本`,
            matches,
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
  const dialog = page.getByRole('dialog');
  async function open(revoke = false) {
    await page
      .getByRole('button', {
        name: revoke ? '按剧名 / 编码取消授权' : '按剧名 / 编码批量授权',
        exact: true,
      })
      .click();
    await dialog.getByRole('combobox', { name: '我的快速选择组' }).click();
    await page.getByTitle('剪辑组（2人）', { exact: true }).click();
    await dialog
      .getByRole('textbox', { name: '作品编码列表' })
      .fill('AIGC0002');
  }
  async function removeOthers() {
    await dialog
      .getByRole('button', {
        name: '移除交付版本 作品一 成片第二版',
        exact: true,
      })
      .click();
    await dialog
      .getByRole('button', {
        name: '移除交付版本 作品二 成片首版',
        exact: true,
      })
      .click();
  }
  await open();
  await expect(
    dialog.getByRole('combobox', { name: '交付版本范围' }),
  ).toBeVisible();
  await dialog.getByRole('button', { name: '预览匹配' }).click();
  await expect(dialog).toContainText('成片第二版');
  await page.screenshot({
    path: test.info().outputPath('delivery-batch-preview.png'),
    fullPage: true,
  });
  await expect(
    dialog.getByRole('button', { name: '确认向 2 人授权 3 个交付版本' }),
  ).toBeEnabled();
  await removeOthers();
  const before = reads;
  await dialog
    .getByRole('button', { name: '确认向 2 人授权 1 个交付版本' })
    .click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0]?.path).toContain('/batch/authorize');
  await expect.poll(() => reads).toBeGreaterThan(before);
  await dialog.getByRole('button', { name: /完\s*成/ }).click();
  await open(true);
  await dialog.getByRole('button', { name: '预览匹配' }).click();
  await removeOthers();
  await dialog
    .getByRole('button', { name: '确认取消 2 人的 1 个交付版本授权' })
    .click();
  await expect.poll(() => writes.length).toBe(2);
  expect(writes[1]?.path).toContain('/batch/revoke');
  await expect(dialog).toContainText('已取消 2 条授权');
  await dialog.getByRole('button', { name: /完\s*成/ }).click();
  await open();
  await dialog.getByRole('button', { name: '预览匹配' }).click();
  await dialog.getByRole('combobox', { name: '交付版本范围' }).click();
  await page.getByTitle('项目资料', { exact: true }).click();
  await expect(
    dialog.getByRole('button', { name: '确认向 2 人授权 0 个交付版本' }),
  ).toBeDisabled();
  await dialog.getByLabel('海报', { exact: true }).check();
  await dialog.getByRole('button', { name: '预览匹配' }).click();
  await dialog
    .getByRole('button', { name: '确认向 2 人授权 1 个交付版本' })
    .click();
  await expect.poll(() => writes.length).toBe(3);
});
