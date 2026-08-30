import { describe, expect, it } from 'vitest';

import {
  buildNotifyMessagePayload,
  contentTypeOptionsForChannel,
  splitNotifyMessagePayload,
} from './message-payload';

describe('notify message payload form helpers', () => {
  it('reads supported fields without exposing raw payload data', () => {
    expect(
      splitNotifyMessagePayload({
        at_mobiles: ['138****0000'],
        custom: { source: 'admin' },
        fallback_to_user_ids: true,
        secret: '[REDACTED]',
        single_title: '查看详情',
        test: true,
        url: 'https://example.test/detail',
      }),
    ).toEqual({
      fallback_to_user_ids: true,
      img_url: undefined,
      pic_url: undefined,
      single_title: '查看详情',
      url: 'https://example.test/detail',
    });
  });

  it('builds link payload from named fields only', () => {
    expect(
      buildNotifyMessagePayload(
        {
          pic_url: ' https://example.test/card.png ',
          url: ' https://example.test/detail ',
        },
        'dingtalk_group_bot',
        'link',
      ),
    ).toEqual({
      pic_url: 'https://example.test/card.png',
      url: 'https://example.test/detail',
    });
  });

  it('builds push payload from the named image field', () => {
    expect(
      buildNotifyMessagePayload(
        {
          img_url: 'https://example.test/push.png',
        },
        'push',
        'text',
      ),
    ).toEqual({
      img_url: 'https://example.test/push.png',
    });
  });

  it('adds at-all fallback only for the matching target', () => {
    expect(
      buildNotifyMessagePayload(
        {
          fallback_to_user_ids: true,
          is_at_all: true,
          target_kind: 'ding_talk_at',
        },
        'dingtalk_custom_robot',
        'text',
      ),
    ).toEqual({ fallback_to_user_ids: true });
  });

  it('uses only supported content types for each channel', () => {
    expect(
      contentTypeOptionsForChannel('dingtalk_custom_robot').map(
        (item) => item.value,
      ),
    ).toEqual(['text', 'markdown', 'link', 'action_card']);
    expect(contentTypeOptionsForChannel('push')).toEqual([
      { label: '文本', value: 'text' },
    ]);
  });
});
