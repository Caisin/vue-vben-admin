import type { NotifyChannelType, NotifyTestTargetKind } from '#/api/notify';
import type { JsonValue } from '#/api/request';

import { editableNotifyPayloadObject } from './editable-payload';

export interface NotifyMessagePayloadFormValues {
  fallback_to_user_ids?: boolean;
  img_url?: string;
  is_at_all?: boolean;
  pic_url?: string;
  single_title?: string;
  target_kind?: NotifyTestTargetKind;
  url?: string;
}

function optionalString(value: JsonValue | undefined) {
  return typeof value === 'string' ? value : undefined;
}

function trimmed(value?: string) {
  const result = value?.trim();
  return result || undefined;
}

export function splitNotifyMessagePayload(
  value: JsonValue,
): NotifyMessagePayloadFormValues {
  const payload = editableNotifyPayloadObject(value);
  return {
    fallback_to_user_ids: payload.fallback_to_user_ids === true,
    img_url: optionalString(payload.img_url),
    pic_url: optionalString(payload.pic_url),
    single_title: optionalString(payload.single_title),
    url: optionalString(payload.url),
  };
}

export function buildNotifyMessagePayload(
  values: NotifyMessagePayloadFormValues,
  channelType: NotifyChannelType | undefined,
  contentType: string,
): Record<string, JsonValue> {
  const payload: Record<string, JsonValue> = {};

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
