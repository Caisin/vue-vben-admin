import { describe, expect, it } from 'vitest';

import { parseDingtalkWebhookConfig } from './webhook-config';

describe('钉钉机器人 Webhook 配置解析', () => {
  it('从官方 Webhook 提取 access_token 并移除无关参数', () => {
    const result = parseDingtalkWebhookConfig(
      'https://oapi.dingtalk.com/robot/send?x=1&access_token=abc',
    );
    expect(result.accessToken).toBe('abc');
    expect(result.webhookUrl).toBe(
      'https://oapi.dingtalk.com/robot/send?access_token=abc',
    );
  });

  it('丢弃 secret、timestamp 和 sign 等非 token 参数', () => {
    const result = parseDingtalkWebhookConfig(
      'https://oapi.dingtalk.com/robot/send?access_token=token&secret=SECabc&timestamp=1&sign=temporary',
    );
    expect(result.webhookUrl).toBe(
      'https://oapi.dingtalk.com/robot/send?access_token=token',
    );
  });

  it('拒绝非钉钉官方主机', () => {
    expect(() =>
      parseDingtalkWebhookConfig(
        'https://example.com/robot/send?access_token=token',
      ),
    ).toThrow('钉钉官方');
  });
});
