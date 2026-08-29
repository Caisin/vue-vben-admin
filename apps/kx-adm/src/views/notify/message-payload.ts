import type { NotifyChannelType, NotifyTestTargetKind } from '#/api/notify';
import type { JsonValue } from '#/api/request';

import {
  formatJsonEditorValue,
  parseJsonEditorValue,
} from '#/views/_shared/crud-page';

import { editableNotifyPayloadObject } from './editable-payload';

export interface NotifyMessagePayloadFormValues {
  extension_payload?: unknown;
  fallback_to_user_ids?: boolean;
  img_url?: string;
  is_at_all?: boolean;
  pic_url?: string;
  single_title?: string;
  target_kind?: NotifyTestTargetKind;
  url?: string;
}

const structuredKeys = [
  'fallback_to_user_ids',
  'img_url',
  'pic_url',
  'single_title',
  'url',
] as const;

const serverControlledKeys = [
  'at_mobiles',
  'at_user_ids',
  'at_userids',
  'endpoint_id',
  'is_at_all',
  'recipient',
  'test',
] as const;

const reservedKeys = new Set<string>([
  ...structuredKeys,
  ...serverControlledKeys,
]);

function optionalString(value: JsonValue | undefined) {
  return typeof value === 'string' ? value : undefined;
}

function trimmed(value?: string) {
  const result = value?.trim();
  return result || undefined;
}

function withoutReservedKeys(value: Record<string, JsonValue>) {
  return Object.fromEntries(
    Object.entries(value).filter(([key]) => !reservedKeys.has(key)),
  ) as Record<string, JsonValue>;
}

export function splitNotifyMessagePayload(
  value: JsonValue,
): NotifyMessagePayloadFormValues {
  const payload = editableNotifyPayloadObject(value);
  const result: NotifyMessagePayloadFormValues = {
    fallback_to_user_ids: payload.fallback_to_user_ids === true,
    img_url: optionalString(payload.img_url),
    pic_url: optionalString(payload.pic_url),
    single_title: optionalString(payload.single_title),
    url: optionalString(payload.url),
  };
  result.extension_payload = formatJsonEditorValue(
    withoutReservedKeys(payload),
  );
  return result;
}

export function buildNotifyMessagePayload(
  values: NotifyMessagePayloadFormValues,
  channelType: NotifyChannelType | undefined,
  contentType: string,
): Record<string, JsonValue> {
  const parsed = parseJsonEditorValue(values.extension_payload ?? '{}');
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new Error('扩展参数必须是 JSON object');
  }
  const payload = withoutReservedKeys(editableNotifyPayloadObject(parsed));

  if (contentType === 'link' || contentType === 'action_card') {
    const url = trimmed(values.url);
    if (!url) throw new Error('请填写跳转地址');
    payload.url = url;
  }
  if (contentType === 'link') {
    const picUrl = trimmed(values.pic_url);
    if (picUrl) payload.pic_url = picUrl;
  }
  if (contentType === 'action_card') {
    const singleTitle = trimmed(values.single_title);
    if (singleTitle) payload.single_title = singleTitle;
  }
  if (channelType === 'push') {
    const imageUrl = trimmed(values.img_url);
    if (imageUrl) payload.img_url = imageUrl;
  }
  if (
    values.target_kind === 'ding_talk_at' &&
    values.is_at_all &&
    values.fallback_to_user_ids
  ) {
    payload.fallback_to_user_ids = true;
  }
  return payload;
}

export function contentTypeOptionsForChannel(channelType?: NotifyChannelType) {
  if (
    channelType === 'dingtalk_custom_robot' ||
    channelType === 'dingtalk_group_bot'
  ) {
    return [
      { label: '文本', value: 'text' },
      { label: 'Markdown', value: 'markdown' },
      { label: '链接卡片', value: 'link' },
      { label: '按钮卡片', value: 'action_card' },
    ];
  }
  return [{ label: '文本', value: 'text' }];
}
