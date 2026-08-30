import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

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
            label: '钉钉机器人 Access Token',
            profile: 'webhook_access_token',
          },
        ],
        'dingtalk',
        'webhook_access_token',
      ),
    ).toBe('钉钉机器人 Access Token');
  });
});
