import { describe, expect, it } from 'vitest';

import { buildTotpDisableRequest } from './totp-security';

describe('tOTP disable request', () => {
  it('keeps the password for accounts with local password credentials', () => {
    expect(buildTotpDisableRequest(true, 'password', '123456')).toEqual({
      password: 'password',
      totp_code: '123456',
    });
  });

  it('omits the password for passwordless third-party accounts', () => {
    expect(buildTotpDisableRequest(false, '', '123456')).toEqual({
      totp_code: '123456',
    });
  });
});
