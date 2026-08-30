import { describe, expect, it } from 'vitest';

import { parseDingtalkBindingRedirect } from './dingtalk-binding-redirect';

describe('钉钉绑定回调参数', () => {
  it('读取冲突 challenge 并保留 hash 路由', () => {
    const result = parseDingtalkBindingRedirect(
      'https://example.test/?bind_result=conflict&bind_challenge_id=challenge-1#/user-overview',
    );

    expect(result.bindResult).toBe('conflict');
    expect(result.challengeId).toBe('challenge-1');
    expect(result.cleanUrl).toBe('https://example.test/#/user-overview');
  });

  it('清理旧版合并参数且不误删其它查询参数', () => {
    const result = parseDingtalkBindingRedirect(
      'https://example.test/?source=menu&merge_challenge_id=old#/user-overview',
    );

    expect(result.cleanUrl).toBe(
      'https://example.test/?source=menu#/user-overview',
    );
  });
});
