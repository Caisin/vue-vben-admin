import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { normalizeDingtalkRobotCredentialInput } from '#/api/credential/dingtalk-robot';

import { credentialKindTabs } from './credential-kind-options';
import { profileLabel } from './data';

describe('凭证中心类型分类', () => {
  it('提供所有和平台专属类型 Tab', () => {
    expect(credentialKindTabs.slice(0, 7)).toEqual([
      { label: '所有', value: 'all' },
      { label: '微信', value: 'wechat' },
      { label: '钉钉', value: 'dingtalk' },
      { label: '抖音', value: 'douyin' },
      { label: '快手', value: 'kuaishou' },
      { label: '微信商户', value: 'wechat_merchant' },
      { label: 'TikTok', value: 'tiktok' },
    ]);
  });

  it('查询表单不再重复提供类型和 Profile', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/views/credential/items/data.ts'),
      'utf8',
    );
    const querySchema = source.slice(source.indexOf('function useFormSchema'));
    expect(querySchema).not.toContain("fieldName: 'kind'");
    expect(querySchema).not.toContain("fieldName: 'profile_pair'");
  });

  it('列表使用 registry 标签展示平台内部用途', () => {
    expect(
      profileLabel(
        [
          {
            allowed_headers: [],
            fields: [],
            kind: 'dingtalk',
            label: '钉钉自定义机器人',
            profile: 'custom_robot',
          },
        ],
        'dingtalk',
        'custom_robot',
      ),
    ).toBe('钉钉自定义机器人');
  });
});

describe('钉钉自定义机器人凭证输入', () => {
  it('从 Webhook 地址提取 access_token 和可选关键字', () => {
    const result = normalizeDingtalkRobotCredentialInput(
      'https://oapi.dingtalk.com/robot/send?access_token=abc123&keyword=%E5%91%A8%E6%8A%A5',
    );
    expect(result).toEqual({ accessToken: 'abc123', keyword: '周报' });
  });

  it('单独填写关键字时优先使用显式字段', () => {
    const result = normalizeDingtalkRobotCredentialInput(
      'https://oapi.dingtalk.com/robot/send?access_token=abc123&keyword=url',
      ' 表单关键字 ',
    );
    expect(result).toEqual({
      accessToken: 'abc123',
      keyword: '表单关键字',
    });
  });
});
