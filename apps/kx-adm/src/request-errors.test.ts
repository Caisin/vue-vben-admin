import { describe, expect, it } from 'vitest';

import { requestErrorMessage } from './request-errors';

describe('requestErrorMessage', () => {
  it('解析 ArrayBuffer JSON 错误响应', () => {
    const data = new TextEncoder().encode(
      JSON.stringify({ code: 422, msg: 'file_id 必须是整数' }),
    ).buffer;
    expect(requestErrorMessage({ response: { data } }, 'fallback')).toBe(
      'file_id 必须是整数',
    );
  });

  it('二进制乱码回退到业务提示', () => {
    expect(
      requestErrorMessage(
        { response: { data: new Uint8Array([0, 255, 1]).buffer } },
        'fallback',
      ),
    ).toBe('fallback');
  });
});
