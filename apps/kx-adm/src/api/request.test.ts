import { describe, expect, it } from 'vitest';

import { isRequestNotFound, isStepUpGrantRejected } from '#/request-errors';

describe('请求错误识别', () => {
  it('识别 RequestClient 重新抛出的 kx-axum 404 响应体', () => {
    expect(
      isRequestNotFound({ code: 404, msg: '接口不存在', result: null }),
    ).toBe(true);
  });

  it('兼容保留 Axios response 的 404 错误', () => {
    expect(isRequestNotFound({ response: { status: 404 } })).toBe(true);
    expect(isRequestNotFound({ code: 500, msg: '失败' })).toBe(false);
  });
});

describe('二次验证票据错误识别', () => {
  it('只识别需要清除本地票据的后端错误', () => {
    expect(
      isStepUpGrantRejected({
        code: 500,
        msg: 'business_error: auth_step_up_invalid',
      }),
    ).toBe(true);
    expect(
      isStepUpGrantRejected({
        code: 500,
        msg: 'business_error: auth_step_up_required',
      }),
    ).toBe(true);
    expect(isStepUpGrantRejected({ code: 404, msg: '机器人不存在' })).toBe(
      false,
    );
  });
});
