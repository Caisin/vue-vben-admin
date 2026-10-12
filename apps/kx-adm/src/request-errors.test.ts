import { describe, expect, it } from 'vitest';

import { requestErrorMessage } from './request-errors';

describe('requestErrorMessage', () => {
  it('保留缺权响应中的权限编码供管理员搜索分配', () => {
    const response = {
      code: 403,
      msg: '无权执行此操作（权限编码：api:auth.user.update）',
    };
    expect(
      requestErrorMessage(
        { response: { status: 403, data: response } },
        'Forbidden',
      ),
    ).toBe(response.msg);
    expect(requestErrorMessage(response, 'Forbidden')).toBe(response.msg);
  });
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
