import type { TikTokAccount, TikTokLogin } from './tiktok';

import { requestClient } from '#/api/request';

export interface TikTokStoredAccount {
  account: TikTokAccount;
  label: string;
  enabled: boolean;
  version: number;
  updated_at: number;
}
const base = '/cookie-manager/tiktok/accounts';
export const tikTokAccounts = {
  rename: (uid: string, name: string, version: number) =>
    requestClient.put<TikTokStoredAccount>(
      `${base}/${encodeURIComponent(uid)}/name`,
      { name, expected_version: version },
    ),
  list: () => requestClient.get<TikTokStoredAccount[]>(base),
  save: (session: TikTokLogin, label: string, version: number) =>
    requestClient.post<TikTokStoredAccount>(base, {
      session,
      label,
      expected_version: version,
    }),
  session: (uid: string) =>
    requestClient.post<TikTokLogin>(
      `${base}/${encodeURIComponent(uid)}/session`,
    ),
  disable: (uid: string, version: number) =>
    requestClient.delete(`${base}/${encodeURIComponent(uid)}`, {
      data: { expected_version: version },
    }),
};
