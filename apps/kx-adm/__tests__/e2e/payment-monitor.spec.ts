import { Buffer } from 'node:buffer';

import { KxEd } from '@kx/admin-core';
import { expect, test } from '@playwright/test';

test.use({ headless: true, actionTimeout: 10_000 });
test('支付监控账户配置、采集、排行分析、账单和预警处理闭环', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const now = Math.floor(Date.now() / 1000);
  let account = {
    id: 1,
    provider: 'stripe',
    name: '商户A',
    owner_uid: 7,
    connected_account: '',
    remote_account_id: 'acct_fixture',
    livemode: true,
    enabled: true,
    interval_seconds: 900,
    history_days: 180,
    version: 1,
    last_success_at: now,
    next_sync_at: now + 900,
    coverage: [[now - 200 * 86_400, now]],
    last_error: '',
    health: {
      country: 'US',
      charges_enabled: true,
      payouts_enabled: false,
      disabled_reason: 'requirements.past_due',
      balance: { available: [{ amount: -500, currency: 'usd' }], pending: [] },
    },
    policy: {
      watch_bps: 50,
      high_bps: 75,
      critical_bps: 100,
      min_payments: 100,
      min_disputes: 3,
      efw_count: 3,
      deadline_hours: 72,
      stale_hours: 24,
      cooldown_hours: 24,
      channel_id: 1,
    },
  };
  let savedKey = '';
  let syncCount = 0;
  let handled = false;
  let jobReads = 0;
  const metrics = {
    payments: 1000,
    card_payments: 1000,
    disputes: 10,
    efws: 5,
    cohort_disputed: 3,
    unknown_brand: 0,
    actionable_efws: 2,
    payment_amounts: { usd: 100_000 },
    disputed_amounts: { usd: 1000 },
    open_amounts: { usd: 500 },
    refunds: { usd: 100 },
    reasons: { fraudulent: 6, product_not_received: 4 },
    brands: { visa: 600, mastercard: 400 },
    activity_bps: 100,
    cohort_bps: 30,
  };
  const alert = () => ({
    id: 9,
    account_id: 1,
    rule: 'dispute_activity_30d',
    severity: 'critical',
    title: '争议发生率升高',
    detail: {
      rate_bps: 100,
      payments: 1000,
      disputes: 10,
      action: '检查履约与退款时效',
    },
    state: handled ? 'acknowledged' : 'open',
    note: handled ? '已安排复查' : '',
    channel_id: 1,
    notification_id: 20,
    notify_error: '',
    version: handled ? 2 : 1,
    created_at: now,
    updated_at: now,
  });
  const paginate = (items: unknown[]) => ({
    items,
    total: items.length,
    total_pages: 1,
    paging: { page: 1, size: 20 },
  });
  await page
    .context()
    .route('**/{auth,payment-monitor,notify,param}/**', async (route) => {
      const req = route.request();
      if (!['fetch', 'xhr'].includes(req.resourceType()))
        return route.continue();
      const url = new URL(req.url());
      const path = url.pathname.replace(/^\/api(?=\/)/, '');
      let result: unknown = {};
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
          name: '风控测试',
          enabled: true,
          home_path: '/payment-monitor/accounts',
          avatar: '',
          is_guest: false,
        };
      else if (path.startsWith('/auth/user/tz')) result = 'UTC';
      else if (path === '/auth/per/codes')
        result = [
          'payment-monitor:manage',
          'payment-monitor:sync',
          'payment-monitor:handle',
        ];
      else if (path === '/auth/menu/current')
        result = [
          {
            id: 1,
            pid: 0,
            name: 'PaymentMonitor',
            title: '支付风险监控',
            path: '/payment-monitor',
            component: 'BasicLayout',
            perm_type: 'catalog',
            enabled: true,
            order_no: 1,
            meta: {},
          },
          ...['accounts', 'analysis', 'records', 'jobs', 'alerts'].map(
            (name, i) => ({
              id: i + 2,
              pid: 1,
              name: `Payment${name}`,
              title: ['支付账户', '排行分析', '账单', '采集任务', '风险告警'][
                i
              ],
              path: `/payment-monitor/${name}`,
              component: `/payment-monitor/${name}`,
              perm_type: 'menu',
              enabled: true,
              order_no: i + 1,
              meta: {},
            }),
          ),
        ];
      else if (path === '/notify/inbox')
        result = { items: [], unread_count: 0, server_time: now };
      else if (path === '/payment-monitor/channels')
        result = [{ id: 1, name: '风控钉钉群', type: 'dingtalk_custom_robot' }];
      else if (path === '/payment-monitor/providers')
        result = [
          {
            code: 'stripe',
            name: 'Stripe',
            early_fraud_warnings: true,
            balance: true,
            card_network_estimates: true,
          },
        ];
      else if (
        path === '/payment-monitor/accounts/1' &&
        req.method() === 'PUT'
      ) {
        const bytes = req.postDataBuffer();
        const body = bytes
          ? JSON.parse(
              req.headers().security === 'true'
                ? KxEd.decryptText(bytes)
                : bytes.toString(),
            )
          : {};
        savedKey = body.api_key || '';
        account = { ...account, ...body, version: account.version + 1 };
        delete (account as Record<string, unknown>).api_key;
        result = account;
      } else if (path === '/payment-monitor/accounts')
        result = paginate([account]);
      else if (path === '/payment-monitor/accounts/1') result = account;
      else if (path === '/payment-monitor/accounts/1/sync') {
        syncCount++;
        result = {
          id: 42,
          account_id: 1,
          status: 'queued',
          phase: 'charge',
          processed: 0,
          from_at: now - 86_400,
          to_at: now,
          created_at: now,
        };
      } else if (path === '/payment-monitor/jobs') {
        jobReads++;
        result = paginate([
          {
            id: 42,
            account_id: 1,
            status: jobReads > 1 ? 'succeeded' : 'running',
            phase: jobReads > 1 ? 'done' : 'charge',
            processed: 1015,
            from_at: now - 86_400,
            to_at: now,
            created_at: now,
            error_message: '',
          },
        ]);
      } else if (path === '/payment-monitor/analysis') {
        const from = Number(url.searchParams.get('from'));
        const to = Number(url.searchParams.get('to'));
        result = {
          items: [
            {
              account_id: 1,
              name: account.name,
              livemode: true,
              from,
              to,
              metrics,
              complete: true,
              stale: false,
              provisional: true,
              efw_available: true,
              updates_available: true,
              last_success_at: now,
              last_error: '',
            },
          ],
          timezone: 'UTC',
          warning: 'API估算；赢诉仍计入争议，近120天批次未成熟',
        };
      } else if (path === '/payment-monitor/accounts/1/network')
        result = [
          {
            program: 'Visa VAMP 参考',
            from: now - 86_400,
            to: now,
            numerator: 15,
            denominator: 600,
            rate_bps: 250,
            count_threshold: 1500,
            rate_threshold_bps: 150,
            meets_reference: false,
            missing: ['API可见数据估算'],
            formula: '争议 + EFW / 成功卡支付',
            rule_source: 'Stripe docs',
            guidance: '不代表正式认定',
          },
        ];
      else if (path === '/payment-monitor/records')
        result = paginate([
          {
            account_id: 1,
            kind: 'dispute',
            object_id: 'du_fixture',
            charge_id: 'ch_fixture',
            payment_intent: 'pi_fixture',
            created_at: now - 100,
            charge_created_at: now - 86_400,
            brand: 'visa',
            currency: 'usd',
            amount: 10_000,
            refunded: 0,
            status: 'needs_response',
            reason: 'fraudulent',
            paid: true,
            captured: true,
            is_card: true,
            due_by: now + 3600,
            actionable: false,
            updated_at: now,
          },
        ]);
      else if (path === '/payment-monitor/alerts') result = paginate([alert()]);
      else if (path === '/payment-monitor/alerts/9' && req.method() === 'PUT') {
        handled = true;
        result = alert();
      } else if (path === '/payment-monitor/alerts/9/delivery')
        result = { status: 'succeeded', attempt_count: 1 };
      const text = JSON.stringify({ code: 200, msg: 'ok', result });
      await route.fulfill({
        contentType: 'application/json',
        body:
          req.headers().security === 'true'
            ? Buffer.from(KxEd.encryptText(text))
            : text,
      });
    });
  await page.goto('/');
  await page.locator("input[name='username']").fill('monitor');
  await page.locator("input[name='password']").fill('test-only');
  await page.getByRole('button', { name: /登录|login/i }).click();
  await expect(
    page.getByRole('cell', { name: '商户A', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: /配\s*置/ }).click();
  const modal = page.getByRole('dialog');
  await expect(
    modal.getByText('风险阈值与通知', { exact: true }),
  ).toBeVisible();
  await modal.getByPlaceholder('公司/站点/用途').fill('商户A-已配置');
  await modal
    .getByPlaceholder('优先配置 rk_live_ 受限只读密钥')
    .fill('rk_live_fixture_only');
  await modal.getByRole('button', { name: /确\s*定|保\s*存/ }).click();
  await expect(
    page.getByRole('cell', { name: '商户A-已配置', exact: true }),
  ).toBeVisible();
  expect(savedKey).toBe('rk_live_fixture_only');
  await page.getByRole('button', { name: /状\s*态/ }).click();
  await expect(
    modal.getByText('requirements.past_due', { exact: true }),
  ).toBeVisible();
  await modal.getByRole('button', { name: /关闭/ }).click();
  await page.getByRole('button', { name: /采\s*集/, exact: true }).click();
  await modal.getByRole('button', { name: /确\s*定/ }).click();
  expect(syncCount).toBe(1);
  await expect(
    page.getByRole('heading', { name: '历史采集任务' }),
  ).toBeVisible();
  await expect(page.getByText('成功', { exact: true })).toBeVisible();
  await page.goto('/payment-monitor/analysis');
  await expect(
    page.getByRole('cell', { name: '1.00%', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('cell', { name: '0.30%', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: /^分\s*析$/ }).click();
  await expect(
    modal.getByText('Visa VAMP 参考', { exact: true }),
  ).toBeVisible();
  await expect(
    modal.getByRole('img', { name: '每日争议发生率趋势，具体数值见下方表格' }),
  ).toBeVisible();
  await modal.getByRole('button', { name: /关闭/ }).click();
  await expect(modal).toBeHidden();
  await page.screenshot({
    path: '/tmp/payment-monitor-analysis.png',
    fullPage: true,
  });
  await page.goto('/payment-monitor/records');
  await expect(
    page.getByRole('cell', { name: 'du_fixture', exact: true }),
  ).toBeVisible();
  await page.goto('/payment-monitor/alerts');
  await page.getByRole('button', { name: /详\s*情/ }).click();
  await expect(
    modal.getByText('检查履约与退款时效', { exact: true }),
  ).toBeVisible();
  await modal
    .getByPlaceholder('记录调查结论和处置措施；标记已处理时必填')
    .fill('已安排复查');
  await modal.getByRole('button', { name: '保存处理记录' }).click();
  await expect(
    page.getByRole('cell', { name: '已确认', exact: true }),
  ).toBeVisible();
  expect(handled).toBe(true);
});
