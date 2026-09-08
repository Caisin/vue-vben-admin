import { Buffer } from 'node:buffer';

import { KxEd } from '@kx/admin-core';
import { expect, test } from '@playwright/test';

test.use({ headless: true });

for (const scenario of ['管理', '只读', '余额反馈']) {
  const readonly = scenario === '只读';
  test(`SIM 归属展示和${scenario}`, async ({ page }) => {
    test.setTimeout(90_000);
    const cards = [
      {
        iccid: '898600000000001',
        phone_number: '13800138000',
        ownership: '运营部',
        real_name: '测试实名',
        management_note: '测试备注',
        carrier: 'CMCC',
        device_code: '',
        device_name: '',
        slot_code: '',
        online_state: 'offline',
        lifecycle_state: 'active',
        phone_region: 'mainland_china',
        balance: '',
        balance_currency: 'CNY',
        expires_at: 0,
        last_seen_at: 1,
        apple_developer_registered: false,
        account_count: 0,
      },
      {
        iccid: '898600000000002',
        phone_number: '13800138001',
        ownership: '',
        real_name: '',
        management_note: '',
        carrier: 'CMCC',
        device_code: 'device-1',
        device_name: '测试设备',
        slot_code: '1',
        online_state: 'online',
        lifecycle_state: 'active',
        phone_region: 'mainland_china',
        balance: '',
        balance_currency: 'CNY',
        expires_at: 0,
        last_seen_at: 1,
        apple_developer_registered: false,
        account_count: 0,
      },
    ];
    const deleted: string[] = [];
    let balanceSubmissions = 0;
    const balanceReads = new Map<string, number>();
    const groupMembers = [cards[1]];
    const groupWrites: string[][] = [];
    const membershipWrites: string[][] = [];
    let rejectDelete = true;
    await page
      .context()
      .route('**/{auth,notify,param,msg}/**', async (route) => {
        if (!['fetch', 'xhr'].includes(route.request().resourceType()))
          return route.continue();
        const path = new URL(route.request().url()).pathname.replace(
          /^\/api(?=\/)/,
          '',
        );
        let result: unknown = null;
        let error = '';
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
            name: 'SIM 管理员',
            enabled: true,
            home_path: '/msg/sim-cards',
            avatar: '',
            permission_count: 1,
            is_guest: false,
          };
        else if (path === '/auth/per/codes')
          result = readonly ? [] : ['sim_cards:manage', 'phone_groups:manage'];
        else if (path === '/auth/menu/current')
          result = [
            {
              id: 1,
              pid: 0,
              name: 'MsgSimCards',
              title: 'SIM 卡',
              path: '/msg/sim-cards',
              component: '/msg/sim-cards/list',
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
              name: 'MsgPhoneGroups',
              title: '号码分组',
              path: '/msg/phone-groups',
              component: '/msg/phone-groups/list',
              perm_type: 'menu',
              enabled: true,
              order_no: 2,
              auth_code: '',
              meta: {},
              redirect: null,
            },
          ];
        else if (path === '/notify/inbox')
          result = { items: [], unread_count: 0 };
        else if (path === '/msg/sim-cards')
          result = { items: cards, total: cards.length };
        else if (
          path.endsWith('/actions/refresh-balance') ||
          path === '/msg/sim-cards/actions/refresh-balances'
        ) {
          balanceSubmissions++;
          if (balanceSubmissions === 1)
            error = 'msg_balance_query_carrier_unsupported';
          else
            result = {
              id: balanceSubmissions,
              status: 'queued',
              message: '查询已受理',
            };
        } else if (path.startsWith('/msg/sim-cards/balance-queries/')) {
          const id = path.split('/').at(-1) ?? '';
          const reads = (balanceReads.get(id) ?? 0) + 1;
          balanceReads.set(id, reads);
          if (id === '3' && reads === 1) error = 'temporary_progress_error';
          const done = reads >= 2;
          const terminalStatus: Record<string, string> = {
            '2': 'failed',
            '4': 'partially_succeeded',
          };
          result = {
            id,
            status: done ? (terminalStatus[id] ?? 'succeeded') : 'running',
            message: done ? '指令处理完成' : '正在发送查询指令',
            error_message: done && id === '2' ? '设备发送失败' : '',
            succeeded_count: done && id !== '2' ? 1 : 0,
            failed_count: done && id !== '3' ? 1 : 0,
          };
          if (done && id === '3' && cards[0]) cards[0].balance = '18.50';
        } else if (path === '/msg/phone-groups/options')
          result = [{ value: 1, grp_code: 'ops', label: '运营组' }];
        else if (path === '/msg/phone-groups')
          result = {
            items: [
              {
                id: 1,
                grp_code: 'ops',
                grp_name: '运营组',
                enabled: true,
                order_no: 1,
                remark: '',
                sim_count: groupMembers.length,
                user_count: 0,
                notification_channel_count: 0,
              },
            ],
            total: 1,
          };
        else if (path === '/msg/phone-groups/1/sims') {
          if (route.request().method() === 'PUT') {
            const bytes = route.request().postDataBuffer();
            if (!bytes) throw new Error('missing group membership payload');
            const data = JSON.parse(KxEd.decodeText(KxEd.decrypt(bytes))) as {
              iccids: string[];
            };
            membershipWrites.push(data.iccids);
            const remaining = groupMembers.filter((card) =>
              data.iccids.includes(card?.iccid ?? ''),
            );
            groupMembers.splice(0, groupMembers.length, ...remaining);
          }
          result = {
            items: groupMembers,
            iccids: groupMembers.map((card) => card?.iccid),
          };
        } else if (path === '/msg/phone-groups/1/sims/actions/add-by-phones') {
          const bytes = route.request().postDataBuffer();
          if (!bytes) throw new Error('missing phone input payload');
          const data = JSON.parse(KxEd.decodeText(KxEd.decrypt(bytes))) as {
            phone_numbers: string[];
          };
          groupWrites.push(data.phone_numbers);
          if (groupMembers.length === 1) groupMembers.push(cards[0]);
          result = {
            inserted: groupWrites.length === 1 ? 1 : 0,
            existing: groupWrites.length === 1 ? 0 : 1,
            duplicates: 1,
            failed: [
              { phone_number: '13800138999', reason: '未找到可访问的 SIM 卡' },
            ],
          };
        } else if (path === '/msg/sim-cards/filter-options')
          result = {
            carriers: ['CMCC'],
            ownerships: cards.map((card) => card.ownership).filter(Boolean),
            real_names: [],
            devices: [],
            lifecycle_states: [],
            phone_regions: [],
            software_versions: [],
            slot_codes: [],
          };
        else if (path.endsWith('/location')) result = null;
        else if (
          path.endsWith('/location-history') ||
          path.endsWith('/messages')
        )
          result = [];
        else if (route.request().method() === 'DELETE') {
          const iccid = path.split('/').at(-1);
          if (!iccid) throw new Error('missing SIM ICCID');
          deleted.push(iccid);
          if (rejectDelete) {
            rejectDelete = false;
            error = 'msg_sim_in_device';
          } else {
            cards.splice(
              cards.findIndex((card) => card.iccid === iccid),
              1,
            );
            result = true;
          }
        }
        const text = JSON.stringify({
          code: error ? 500 : 200,
          msg: error || 'ok',
          result,
        });
        await route.fulfill({
          contentType: 'application/json',
          body:
            route.request().headers().security === 'true'
              ? Buffer.from(KxEd.encryptText(text))
              : text,
        });
      });
    await page.goto('/');
    await page.locator("input[name='username']").fill('sim-admin');
    await page.locator("input[name='password']").fill('test-only');
    await page.getByRole('button', { name: /登录|login/i }).click();
    await expect(page).toHaveURL(/\/msg\/sim-cards$/, { timeout: 30_000 });
    await expect(
      page.getByText('运营部', { exact: true }).first(),
    ).toBeVisible();
    if (readonly) {
      await expect(
        page.getByRole('button', { name: '查余额', exact: true }),
      ).toHaveCount(0);
      await expect(page.getByRole('button', { name: '编辑归属' })).toHaveCount(
        0,
      );
      await expect(
        page.getByRole('button', { name: '删除 SIM 卡', exact: true }),
      ).toHaveCount(0);
      expect(deleted).toEqual([]);
      await expect(
        page.getByRole('button', { name: '加入分组', exact: true }),
      ).toHaveCount(0);
      return;
    }
    if (scenario === '余额反馈') {
      const query = page
        .getByRole('button', { name: '查余额', exact: true })
        .first();
      const progress = page.getByRole('dialog', {
        name: '余额查询进度',
        exact: true,
      });
      await query.click();
      await expect(progress).toContainText('该运营商尚未配置余额查询协议');
      await progress.getByRole('button', { name: '关闭', exact: true }).click();
      await query.click();
      await expect(progress).toContainText('正在发送查询指令');
      await expect(progress).toContainText('余额查询失败：设备发送失败');
      await progress.getByRole('button', { name: '关闭', exact: true }).click();
      await query.click();
      await expect(progress).toContainText('查询进度暂时不可用，正在重试');
      await progress.getByRole('button', { name: '关闭', exact: true }).click();
      await page
        .getByRole('button', { name: '查看余额查询进度', exact: true })
        .click();
      await expect(progress).toContainText(
        '余额查询指令提交成功，等待设备发送及运营商回复',
      );
      expect(balanceSubmissions).toBe(3);
      await progress.getByRole('button', { name: '关闭', exact: true }).click();
      await expect(
        page.getByRole('button', { name: '修改余额', exact: true }).first(),
      ).toContainText('18.50');
      await page
        .getByRole('button', { name: '批量查询余额', exact: true })
        .click();
      await page
        .getByRole('dialog', { name: '确认批量查询余额', exact: true })
        .getByRole('button', { name: '开始查询', exact: true })
        .click();
      await expect(progress).toContainText('余额查询部分失败');
      expect(balanceSubmissions).toBe(4);
      return;
    }
    const ownership = page.getByRole('button', { name: '编辑归属' });
    await expect(ownership.first()).toHaveText('运营部');
    await expect(ownership.nth(1)).toHaveText('未知');
    await page.getByRole('button', { name: '加入分组', exact: true }).click();
    const groupDialog = page.getByRole('dialog', {
      name: '加入号码分组',
      exact: true,
    });
    await groupDialog.getByRole('combobox').nth(1).click();
    await page.getByTitle('运营组（ops）', { exact: true }).click();
    await groupDialog
      .getByRole('textbox', { name: '每行一个号码' })
      .fill('13800138000\n\n13800138000\n13800138999');
    await groupDialog
      .getByRole('button', { name: '添加到分组', exact: true })
      .click();
    await expect(groupDialog).toContainText('新增 1 个');
    await expect(groupDialog).toContainText('未找到可访问的 SIM 卡');
    expect(groupWrites[0]).toEqual([
      '13800138000',
      '13800138000',
      '13800138999',
    ]);
    await groupDialog.getByRole('button', { name: /close|关闭/i }).click();
    const templateCard = cards[0];
    if (!templateCard) throw new Error('missing SIM fixture');
    for (let index = 0; index < 12; index++) {
      groupMembers.push({
        ...templateCard,
        iccid: `8986000000001${String(index).padStart(2, '0')}`,
        phone_number: `139000000${String(index).padStart(2, '0')}`,
        real_name: `实名${index}`,
      });
    }
    await page.goto('/msg/phone-groups');
    await page.getByRole('button', { name: '14 个号码', exact: true }).click();
    const simModal = page.getByRole('dialog', {
      name: '分配号码：运营组',
      exact: true,
    });
    await expect(simModal).toBeVisible();
    await expect
      .poll(async () => {
        const bounds = await simModal.boundingBox();
        return bounds?.width ?? 0;
      })
      .toBeGreaterThan(1000);
    await expect(
      simModal.getByText('13900000011', { exact: true }),
    ).toHaveCount(0);
    const search = simModal.getByRole('textbox', { name: '搜索分组号码' });
    // 第 14 个成员不在当前页，搜索仍需找到；手机号可带国家码和空格。
    await search.fill('+86 13900000011');
    await expect(
      simModal.getByText('13900000011', { exact: true }),
    ).toBeVisible();
    await expect(simModal.getByRole('status')).toContainText('当前匹配 1 个');
    await search.fill('实名11');
    await expect(
      simModal.getByText('13900000011', { exact: true }),
    ).toBeVisible();
    await simModal.getByRole('button', { name: '移除', exact: true }).click();
    await page.getByRole('button', { name: /确\s*定/ }).click();
    await expect(simModal).toContainText('没有匹配的号码');
    expect(membershipWrites[0]).toHaveLength(13);
    expect(membershipWrites[0]).toContain('898600000000001');
    expect(membershipWrites[0]).toContain('898600000000002');
    expect(membershipWrites[0]).not.toContain('898600000000111');
    await search.fill('');
    await expect(simModal.getByRole('status')).toContainText(
      '分组共 13 个号码',
    );
    await page.setViewportSize({ width: 480, height: 900 });
    await expect
      .poll(async () => {
        const bounds = await simModal.boundingBox();
        return bounds?.width ?? Infinity;
      })
      .toBeLessThanOrEqual(448);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page
      .getByRole('button', { name: '按行输入号码', exact: true })
      .click();
    const inputDialog = page.getByRole('dialog', {
      name: '按行添加号码到分组',
      exact: true,
    });
    await inputDialog
      .getByRole('textbox', { name: '每行一个号码' })
      .fill('13800138000\n13800138000\n13800138999');
    await inputDialog
      .getByRole('button', { name: '添加到分组', exact: true })
      .click();
    await expect(inputDialog).toContainText('已存在 1 个');
    expect(groupWrites).toHaveLength(2);
    await inputDialog.getByRole('button', { name: /close|关闭/i }).click();
    await expect(simModal).toBeVisible();
    await search.fill('没有这个号码');
    await expect(simModal).toContainText('没有匹配的号码');
    await simModal.getByRole('button', { name: '关闭', exact: true }).click();
    await page.getByRole('button', { name: '13 个号码', exact: true }).click();
    await expect(search).toHaveValue('');
    await page.goto('/msg/sim-cards');
    const remove = page.getByRole('button', {
      name: '删除 SIM 卡',
      exact: true,
    });
    await expect(remove.nth(1)).toBeDisabled();
    await remove.first().click();
    const dialog = page.getByRole('dialog', { name: '删除 SIM 卡' });
    await expect(dialog).toContainText('898600000000001');
    await dialog.getByRole('button', { name: /取\s*消/ }).click();
    expect(deleted).toEqual([]);
    await remove.first().click();
    await dialog.getByRole('button', { name: /删\s*除/ }).click();
    await expect(dialog).toContainText('请先拔卡');
    expect(cards).toHaveLength(2);
    await dialog.getByRole('button', { name: /删\s*除/ }).click();
    await expect(dialog).toBeHidden();
    await expect(
      page.getByText('898600000000001', { exact: true }),
    ).toHaveCount(0);
    expect(deleted).toEqual(['898600000000001', '898600000000001']);
  });
}
