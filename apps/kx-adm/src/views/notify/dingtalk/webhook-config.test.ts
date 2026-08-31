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

  it('保留可选关键字参数并丢弃 secret、timestamp 和 sign', () => {
    const result = parseDingtalkWebhookConfig(
      'https://oapi.dingtalk.com/robot/send?access_token=token&keyword=%E5%91%A8%E6%8A%A5&secret=SECabc&timestamp=1&sign=temporary',
    );
    expect(result.keyword).toBe('周报');
    expect(result.webhookUrl).toBe(
      'https://oapi.dingtalk.com/robot/send?access_token=token&keyword=%E5%91%A8%E6%8A%A5',
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
