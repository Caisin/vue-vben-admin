import { convertFileSrc, invoke } from '@tauri-apps/api/core';

import { tikTokAccounts } from './tiktok-accounts';

export interface TikTokAccount {
  uid: string;
  nickname: string;
  timezone: string;
  minDelaySeconds: number;
  maxDelaySeconds: number;
  privateAccount: boolean;
}
export interface TikTokLogin {
  account: TikTokAccount;
  cookie: string;
  userAgent: string;
}
export const tiktokLoginKey = 'kx-adm.tiktok-cookie.v1';
// 旧缓存仅供用户显式迁移；新账号凭据只保存在KX数据库和当前进程内存。
export function legacyTikTokLogin(): null | TikTokLogin {
  try {
    const value = JSON.parse(localStorage.getItem(tiktokLoginKey) || 'null');
    return value && typeof value.cookie === 'string' && value.account?.uid
      ? value
      : null;
  } catch {
    return null;
  }
}
export async function verifyTikTokCookie(
  cookie: string,
  userAgent?: string,
  expectedAccountId?: string,
  activate = true,
) {
  return invoke<TikTokLogin>('tiktok_import_cookie', {
    input: {
      activate,
      cookie,
      userAgent: userAgent || null,
      expectedAccountId: expectedAccountId || null,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
  });
}
export async function importTikTokCookie(
  cookie: string,
  userAgent?: string,
  label?: string,
  expectedAccountId?: string,
  expectedVersion?: number,
) {
  const login = await verifyTikTokCookie(
    cookie,
    userAgent,
    expectedAccountId,
    false,
  );
  const accounts = await tikTokAccounts.list();
  const existing = accounts.find(
    (item) => item.account.uid === login.account.uid,
  );
  await tikTokAccounts.save(
    login,
    label?.trim() || existing?.label || login.account.nickname,
    expectedVersion ?? existing?.version ?? 0,
  );
  if (legacyTikTokLogin()?.account.uid === login.account.uid)
    localStorage.removeItem(tiktokLoginKey);
  return verifyTikTokCookie(login.cookie, login.userAgent, login.account.uid);
}
export async function switchTikTokAccount(uid: string) {
  const session = await tikTokAccounts.session(uid);
  return verifyTikTokCookie(session.cookie, session.userAgent, uid);
}
export async function restoreTikTokLogin() {
  const current = await invoke<null | TikTokLogin>('tiktok_session');
  // 重新确认当前KX用户仍拥有此账号；没有账号时由用户从列表选择。
  if (!current) return null;
  const accounts = await tikTokAccounts.list();
  if (
    accounts.some(
      (item) => item.enabled && item.account.uid === current.account.uid,
    )
  )
    return current;
  await invoke('tiktok_logout');
  return null;
}
export async function logoutTikTok() {
  await invoke('tiktok_logout');
}
export interface TikTokSchedule {
  caption: string;
  scheduledAt: number;
  visibility: number;
  allowComment: boolean;
  copyrightCheck?: boolean;
  contentCheck?: boolean;
}
export interface TikTokVideoFile {
  id: string;
  name: string;
  relative: string;
  size: number;
  status: string;
  message: string;
  bytes: number;
  uploadPercent: number;
  schedule: null | TikTokSchedule;
  media: null | { vid: string; duration: number };
  itemId: null | string;
}
export interface TikTokDirectory {
  revision: number;
  name: string;
  files: TikTokVideoFile[];
  account: null | TikTokAccount;
}
export const tiktok = {
  account: () => invoke<TikTokAccount>('tiktok_account'),
  list: () => invoke<null | TikTokDirectory>('tiktok_list'),
  pickDirectory: () => invoke<null | TikTokDirectory>('tiktok_pick_directory'),
  plan: (
    directory: TikTokDirectory,
    account: TikTokAccount,
    items: { id: string; schedule: TikTokSchedule }[],
  ) =>
    invoke<TikTokDirectory>('tiktok_plan', {
      edit: {
        expectedRevision: directory.revision,
        accountId: account.uid,
        items,
      },
    }),
  upload: async (
    fileIds: string[],
    revision: number,
    accountId: string,
    concurrency = 3,
  ) => {
    // 每次批次开始重新获取授权会话，停用或更新Cookie在下一次提交生效。
    await switchTikTokAccount(accountId);
    return invoke<null>('tiktok_upload', {
      fileIds,
      revision,
      accountId,
      concurrency,
    });
  },
  preview: async (id: string, revision: number) =>
    convertFileSrc(await invoke<string>('tiktok_preview', { id, revision })),
  pause: () => invoke<null>('tiktok_pause'),
  remove: (revision: number) => invoke<null>('tiktok_remove', { revision }),
  resetMedia: (id: string, revision: number) =>
    invoke<null>('tiktok_reset_media', { id, revision }),
  reconcile: (id: string, revision: number, itemId: null | string) =>
    invoke<null>('tiktok_reconcile', { id, revision, itemId }),
};
export function isTikTokRunning(file: TikTokVideoFile) {
  return ['checking', 'scheduling', 'transferring', 'uploading'].includes(
    file.status,
  );
}
export function canUploadTikTok(file: TikTokVideoFile) {
  return ['failed', 'pending', 'ready'].includes(file.status);
}
export function localDateTime(seconds: number) {
  const date = new Date(seconds * 1000);
  const part = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${part(date.getMonth() + 1)}-${part(date.getDate())}T${part(date.getHours())}:${part(date.getMinutes())}`;
}
export function scheduleTimestamp(value: string) {
  const timestamp = new Date(value).getTime() / 1000;
  if (!Number.isSafeInteger(timestamp) || localDateTime(timestamp) !== value)
    throw new Error('预约日期或本地时间无效，请重新选择');
  if (timestamp % 300 !== 0) throw new Error('预约时间须按 5 分钟对齐');
  return timestamp;
}
