import type { TotpDisableRequest } from '#/api';

export function buildTotpDisableRequest(
  passwordRequired: boolean,
  password: string,
  totpCode: string,
): TotpDisableRequest {
  return passwordRequired
    ? { password, totp_code: totpCode }
    : { totp_code: totpCode };
}
