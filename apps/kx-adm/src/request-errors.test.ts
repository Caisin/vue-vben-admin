import { describe, expect, it } from 'vitest';

import { requestErrorMessage } from './request-errors';

describe('requestErrorMessage', () => {
  it('reads msg from an Axios error response', () => {
    expect(
      requestErrorMessage(
        { response: { data: { code: 500, msg: '保存失败' } } },
        '系统错误',
      ),
    ).toBe('保存失败');
  });

  it('reads msg from a response body rethrown by RequestClient', () => {
    expect(
      requestErrorMessage({ code: 500, msg: '参数无效' }, '系统错误'),
    ).toBe('参数无效');
  });

  it('uses the fallback when msg is absent or empty', () => {
    expect(requestErrorMessage({ response: { data: {} } }, '系统错误')).toBe(
      '系统错误',
    );
    expect(requestErrorMessage({ msg: '  ' }, '系统错误')).toBe('系统错误');
  });
});
