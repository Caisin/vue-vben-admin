import type {
  MembershipEntitlementWrite,
  MembershipPlan,
  MembershipPlanEntitlement,
  MembershipPlanWrite,
} from '#/api/asset/membership';
import type {
  PayItemBalanceGrant,
  PayItemBalanceGrantWrite,
  PayItemMembershipGrant,
  PayItemMembershipGrantWrite,
  PayItemType,
  PayItemWrite,
} from '#/api/asset/pay';
import type { JsonValue } from '#/api/request';

import {
  formatJsonEditorValue,
  parseJsonEditorValue,
} from '#/views/_shared/crud-page';

export interface MembershipEntitlementFormValue extends Omit<
  MembershipEntitlementWrite,
  'parameters'
> {
  parameters?: unknown;
}

export interface MembershipPlanFormValues extends Omit<
  MembershipPlanWrite,
  'policy'
> {
  entitlements?: MembershipEntitlementFormValue[];
  policy: MembershipPlanWrite['policy'];
}

type PayDynamicJsonField = 'display_config' | 'lang_info';

export interface PayItemFormValues extends Omit<
  PayItemWrite,
  PayDynamicJsonField
> {
  display_config?: unknown;
  lang_info?: unknown;
}

export function decodeMembershipPlan(
  plan: MembershipPlan,
  entitlements: MembershipPlanEntitlement[],
): MembershipPlanFormValues {
  return {
    ...plan,
    entitlements: entitlements.map(
      ({ entitlement_code, grace_allowed, parameters }) => ({
        entitlement_code,
        grace_allowed,
        parameters: formatJsonEditorValue(parameters ?? {}),
      }),
    ),
  };
}

export function encodeMembershipPlan(values: MembershipPlanFormValues): {
  entitlements: MembershipEntitlementWrite[];
  plan: MembershipPlanWrite;
} {
  const { entitlements = [] } = values;
  return {
    entitlements: entitlements.map(
      ({ entitlement_code, grace_allowed = false, parameters }) => ({
        entitlement_code: entitlement_code.trim(),
        grace_allowed,
        parameters: parseJsonEditorValue(parameters ?? '{}'),
      }),
    ),
    plan: {
      code: values.code.trim(),
      enabled: values.enabled,
      intro: values.intro,
      membership_type_id: values.membership_type_id,
      name: values.name.trim(),
      policy: values.policy,
      tier_rank: values.tier_rank,
    },
  };
}

function parseJsonObject(value: unknown, fallback: JsonValue) {
  const parsed = parseJsonEditorValue(value ?? formatJsonEditorValue(fallback));
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new SyntaxError('JSON 字段必须为对象');
  }
  return parsed as JsonValue;
}

function writeBalanceGrant(
  grant: PayItemBalanceGrant | PayItemBalanceGrantWrite,
): PayItemBalanceGrantWrite {
  return {
    asset_item_id: grant.asset_item_id,
    quantity: grant.quantity,
    valid_seconds: grant.valid_seconds ?? null,
  };
}

function writeMembershipGrant(
  grant: PayItemMembershipGrant | PayItemMembershipGrantWrite,
): PayItemMembershipGrantWrite {
  return {
    duration_seconds: grant.duration_seconds,
    membership_plan_id: grant.membership_plan_id,
  };
}

export function decodePayItem(
  values: Omit<PayItemFormValues, 'balance_grants' | 'membership_grants'> & {
    balance_grants?: (PayItemBalanceGrant | PayItemBalanceGrantWrite)[];
    membership_grants?: (
      | PayItemMembershipGrant
      | PayItemMembershipGrantWrite
    )[];
  },
): PayItemFormValues {
  return {
    ...values,
    back_amount_minor: values.back_amount_minor ?? 0,
    back_percent: values.back_percent ?? 10_000,
    balance_grants: (values.balance_grants ?? []).map((grant) =>
      writeBalanceGrant(grant),
    ),
    cycle_day: values.is_sub ? (values.cycle_day ?? 30) : 0,
    display_config: formatJsonEditorValue(values.display_config ?? {}),
    ext_info: values.ext_info ?? { fb_back: [], is_back: false },
    item_type: values.item_type ?? 'normal',
    lang_info: formatJsonEditorValue(values.lang_info ?? {}),
    membership_grants: (values.membership_grants ?? []).map((grant) =>
      writeMembershipGrant(grant),
    ),
    unlock_episode_count: values.unlock_episode_count ?? 0,
  };
}

export function encodePayItem(values: PayItemFormValues): PayItemWrite {
  const itemType = (values.item_type ?? 'normal') as PayItemType;
  const isSub = Boolean(values.is_sub);
  return {
    amount_minor: values.amount_minor,
    back_amount_minor: values.back_amount_minor ?? 0,
    back_percent: values.back_percent ?? 10_000,
    balance_grants:
      itemType === 'normal'
        ? (values.balance_grants ?? []).map((grant) => writeBalanceGrant(grant))
        : [],
    cycle_day: isSub ? (values.cycle_day ?? 0) : 0,
    code: values.code.trim(),
    currency: values.currency.trim(),
    display_config: parseJsonObject(values.display_config, {}),
    enabled: values.enabled,
    ext_info: {
      fb_back: (values.ext_info?.fb_back ?? []).map(
        ({ back_percent, seq_num }) => ({ back_percent, seq_num }),
      ),
      is_back: Boolean(values.ext_info?.is_back),
    },
    is_sub: isSub,
    item_type: itemType,
    lang_info: parseJsonObject(values.lang_info, {}),
    membership_grants:
      itemType === 'vip'
        ? (values.membership_grants ?? []).map((grant) =>
            writeMembershipGrant(grant),
          )
        : [],
    unlock_episode_count:
      itemType === 'res_item' ? (values.unlock_episode_count ?? 0) : 0,
    intro: values.intro,
    platform: values.platform,
    remark: values.remark,
    sort_no: values.sort_no,
    summary: values.summary,
    template_id: values.template_id,
    title: values.title.trim(),
  };
}
