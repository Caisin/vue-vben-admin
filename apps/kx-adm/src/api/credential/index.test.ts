import { describe, expect, it, vi } from 'vitest';

import { buildCredentialPayload } from './index';

vi.mock('#/api/request', () => ({ requestClient: {} }));

describe('buildCredentialPayload', () => {
  it('将微信小程序材料收敛为一份结构化凭证', () => {
    expect(
      buildCredentialPayload(
        'wechat',
        {
          payload_app_id: 'wx-app-id',
          payload_app_secret: 'app-secret',
          payload_callback_token: 'callback-token',
          payload_message_aes_key: 'message-aes-key',
        },
        'app',
      ),
    ).toEqual({
      app_id: 'wx-app-id',
      app_secret: 'app-secret',
      callback_token: 'callback-token',
      kind: 'wechat_app',
      message_aes_key: 'message-aes-key',
    });
  });
});
