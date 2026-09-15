import { describe, expect, it } from 'vitest';

import {
  getDingTalkExchangeCode,
  stripDingTalkExchangeCode,
} from './dingtalk-exchange-code';

describe('钉钉交换码', () => {
  it('读取 hash 路由前面的普通 query', () => {
    expect(
      getDingTalkExchangeCode(
        {},
        'http://localhost:8881/?exchange_code=abc#/auth/login',
      ),
    ).toBe('abc');
  });

  it('优先读取 vue-router query', () => {
    expect(
      getDingTalkExchangeCode(
        { exchange_code: 'route-code' },
        'http://localhost:8881/?exchange_code=url-code#/auth/login',
      ),
    ).toBe('route-code');
  });

  it('清理 hash 路由前面的一次性交换码', () => {
    expect(
      stripDingTalkExchangeCode(
        'http://localhost:8881/?exchange_code=abc#/auth/login',
      ),
    ).toBe('http://localhost:8881/#/auth/login');
  });
});

it('读取 hash 路由内部的交换码', () => {
  expect(
    getDingTalkExchangeCode(
      {},
      'https://example.test/#/auth/login?exchange_code=hash-code',
    ),
  ).toBe('hash-code');
});

it('清理 hash 路由内部的一次性交换码', () => {
  expect(
    stripDingTalkExchangeCode(
      'https://example.test/#/auth/login?exchange_code=hash-code&redirect=%2Fdata-sync',
    ),
  ).toBe('https://example.test/#/auth/login?redirect=%2Fdata-sync');
});
