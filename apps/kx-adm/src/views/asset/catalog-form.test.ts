import { describe, expect, it } from 'vitest';

import {
  decodeMembershipPlan,
  decodePayItem,
  encodeMembershipPlan,
  encodePayItem,
} from './catalog-form';

describe('asset catalog form codecs', () => {
  it('maps membership fields without resubmitting entitlement read fields', () => {
    const decoded = decodeMembershipPlan(
      {
        code: 'monthly',
        created_at: 10,
        enabled: true,
        id: 3,
        intro: '',
        membership_type_id: 2,
        name: '月度会员',
        policy: {
          grace_seconds: 3600,
          renewal: 'stack_from_current_end',
          transition: 'replace_at_period_end',
        },
        tier_rank: 1,
        updated_at: 20,
      },
      [
        {
          created_at: 30,
          entitlement_code: ' content.read ',
          grace_allowed: true,
          parameters: { quality: 'hd' },
          plan_id: 3,
        },
      ],
    );

    expect(decoded.entitlements).toEqual([
      {
        entitlement_code: ' content.read ',
        grace_allowed: true,
        parameters: '{\n  "quality": "hd"\n}',
      },
    ]);
    expect(encodeMembershipPlan(decoded)).toEqual({
      entitlements: [
        {
          entitlement_code: 'content.read',
          grace_allowed: true,
          parameters: { quality: 'hd' },
        },
      ],
      plan: {
        code: 'monthly',
        enabled: true,
        intro: '',
        membership_type_id: 2,
        name: '月度会员',
        policy: {
          grace_seconds: 3600,
          renewal: 'stack_from_current_end',
          transition: 'replace_at_period_end',
        },
        tier_rank: 1,
      },
    });
  });

  it('strips pay grant read fields and retains the typed extension fields', () => {
    const decoded = decodePayItem({
      amount_minor: 100,
      balance_grants: [
        {
          asset_item_id: 7,
          pay_item_id: 9,
          quantity: 20,
          valid_seconds: null,
        },
      ],
      code: 'coins',
      currency: 'CNY',
      display_config: { badge: 'hot' },
      ext_info: {
        fb_back: [{ back_percent: 5000, seq_num: 2 }],
        is_back: true,
      },
      item_type: 'normal',
      lang_info: { zh_CN: { title: '金币' } },
      membership_grants: [],
      platform: 'any',
      template_id: 1,
      title: '金币包',
    });

    expect(decoded.balance_grants).toEqual([
      { asset_item_id: 7, quantity: 20, valid_seconds: null },
    ]);
    expect(encodePayItem(decoded)).toEqual(
      expect.objectContaining({
        balance_grants: [
          { asset_item_id: 7, quantity: 20, valid_seconds: null },
        ],
        display_config: { badge: 'hot' },
        ext_info: {
          fb_back: [{ back_percent: 5000, seq_num: 2 }],
          is_back: true,
        },
        lang_info: { zh_CN: { title: '金币' } },
        membership_grants: [],
      }),
    );
  });

  it('clears grants hidden by the selected product type', () => {
    expect(
      encodePayItem({
        amount_minor: 100,
        balance_grants: [{ asset_item_id: 1, quantity: 10 }],
        code: 'book',
        currency: 'CNY',
        display_config: '{}',
        item_type: 'res_total',
        lang_info: '{}',
        membership_grants: [{ duration_seconds: 3600, membership_plan_id: 2 }],
        platform: 'any',
        template_id: 1,
        title: '整本解锁',
      }),
    ).toEqual(
      expect.objectContaining({
        balance_grants: [],
        membership_grants: [],
        unlock_episode_count: 0,
      }),
    );
  });

  it('rejects non-object dynamic pay fields', () => {
    expect(() =>
      encodePayItem({
        amount_minor: 100,
        code: 'coins',
        currency: 'CNY',
        display_config: '[]',
        lang_info: '{}',
        platform: 'any',
        template_id: 1,
        title: '金币包',
      }),
    ).toThrow('JSON 字段必须为对象');
  });
});
