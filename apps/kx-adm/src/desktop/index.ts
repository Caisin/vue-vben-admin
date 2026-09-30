import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

import {
  readDesktopSession,
  removeDesktopSession,
  saveDesktopSession,
} from './session-storage';

export const desktop = isTauri();
export interface DesktopSession {
  apiBase: string;
  expiresAt: number;
  generation: number;
  token: string;
  uid: string;
}
interface Bootstrap {
  generation: number;
  apiBase: string;
  session: DesktopSession | null;
}
export interface UploadTiming {
  elapsedMs: number;
  startedAt?: null | number;
  finishedAt?: null | number;
  active: boolean;
}
export interface UploadItem {
  timing?: UploadTiming;
  contentType?: string;
  bytes: number;
  error: string;
  fileId: null | string;
  relative: string;
  seq: number;
  size: number;
  status: string;
  title: string;
}
export interface UploadJob {
  revision?: number;
  collapsed?: boolean;
  importId?: null | string;
  timing?: UploadTiming;
  snapshotAt?: number;
  concurrency?: number;
  versionName?: string;
  targetDirectory?: string;
  error: string;
  id: string;
  items: UploadItem[];
  name: string;
  res: string;
  status: string;
  version: string;
}
export interface DownloadFile {
  bytes: number;
  error: string;
  fileId: number | string;
  fileName: string;
  size: number;
  status: string;
}
export interface DownloadJob {
  targetDirectory: string;
  concurrency: number;
  error: string;
  files: DownloadFile[];
  id: string;
  resId: number | string;
  versionId: number | string;
  taskId: number | string;
  status: string;
}
export interface ImageEnvStatus {
  available: boolean;
  variableName: string;
  baseUrl: string;
  configPath: string;
  message: string;
}
let state: Bootstrap | undefined;
let generation = 0;
let current: DesktopSession | null = null;
let publish: ((token: null | string) => void) | undefined;
function receive(session: DesktopSession) {
  if (session.generation < generation) return;
  generation = session.generation;
  current = session;
  saveDesktopSession(session);
  if (state) state.session = session;
  publish?.(session.token);
}
export function desktopApiBase() {
  return state?.apiBase;
}
export function imageEnvStatus() {
  return invoke<ImageEnvStatus>('desktop_image_env_status');
}
export function setImageEnv(key: string) {
  return invoke<ImageEnvStatus>('desktop_image_set_env', { key });
}
function webApiBase() {
  const configured = import.meta.env.VITE_GLOB_API_URL || '/api';
  try {
    return new URL(configured, window.location.origin)
      .toString()
      .replace(/\/$/, '');
  } catch {
    return configured;
  }
}
export async function initDesktop() {
  if (!desktop) return;
  await listen<DesktopSession>('desktop-session-updated', ({ payload }) =>
    receive(payload),
  );
  await listen<number>('desktop-session-cleared', ({ payload }) => {
    if (payload < generation) return;
    generation = payload;
    removeDesktopSession();
    current = null;
    if (state) state.session = null;
    publish?.(null);
  });
  state = await invoke<Bootstrap>('desktop_bootstrap', {
    apiBase: webApiBase(),
  });
  if (state.session) receive(state.session);
  generation = Math.max(generation, state.generation ?? 0);
  if (!current) {
    const token = readDesktopSession(state.apiBase);
    if (token) {
      try {
        receive(
          await invoke<DesktopSession>('desktop_restore_session', {
            token,
            apiBase: state.apiBase,
            expectedGeneration: generation,
          }),
        );
      } catch (error) {
        // 网络暂不可用时保留缓存，下次启动再验证；明确失效的令牌才清除。
        if (/unauthorized|令牌|身份无效/.test(String(error)))
          removeDesktopSession();
      }
    }
  }
  state.session = current;
}
export async function bindDesktopSession(
  setToken: (token: null | string) => void,
) {
  if (!desktop) return;
  publish = setToken;
  publish(state?.session?.token ?? null);
  if (state?.session && state.session.expiresAt <= Date.now() / 1000 + 60) {
    try {
      await refreshDesktopSession(state.session.token);
    } catch {
      publish(null);
    }
  }
}
export async function importDesktopSession(token: string) {
  if (!desktop) return token;
  const session = await invoke<DesktopSession>('desktop_import_session', {
    token,
  });
  receive(session);
  return session.token;
}
export async function syncDesktopSession(token: string) {
  if (!desktop) return token;
  const session = await invoke<DesktopSession>('desktop_sync_session', {
    token,
  });
  receive(session);
  return session.token;
}
export function desktopDeviceInfo() {
  return invoke<{
    device_id: string;
    name: string;
    os: string;
    app_version: string;
  }>('desktop_device_info');
}
export function desktopDingTalkDevice(exchangeCode: string) {
  return invoke<{
    app_version: string;
    name: string;
    os: string;
    proof: {
      device_id: string;
      public_key: string;
      signature: string;
      timestamp: number;
    };
  }>('desktop_dingtalk_device', { exchangeCode });
}
export function desktopDeviceHeaders(token: string) {
  return invoke<Record<string, string>>('desktop_device_headers', { token });
}
export async function refreshDesktopSession(expected?: string) {
  const session = await invoke<DesktopSession>('desktop_refresh_session', {
    expected,
  });
  receive(session);
  return session.token;
}
export async function clearDesktopSession() {
  if (desktop) {
    removeDesktopSession();
    await invoke('desktop_clear_session');
  }
}
export async function configureDesktop(apiBase: string) {
  await invoke('desktop_configure', { apiBase });
  removeDesktopSession();
  window.location.reload();
}
export const desktopUploads = {
  list: () => invoke<UploadJob[]>('desktop_jobs'),
  scan: (
    res: string,
    version: string,
    storage: string,
    localStorage: boolean,
    versionName: string,
  ) =>
    invoke<null | UploadJob>('desktop_scan', {
      res,
      version,
      storage,
      localStorage,
      versionName,
    }),
  start: (job: UploadJob) =>
    invoke('desktop_start', {
      id: job.id,
      concurrency: job.concurrency ?? 3,
      expectedRevision: job.revision ?? 0,
      edits: job.items.map(({ seq, title }) => ({ seq, title })),
    }),
  update: (job: UploadJob) =>
    invoke<UploadJob>('desktop_update_job', {
      id: job.id,
      update: {
        expectedRevision: job.revision ?? 0,
        name: job.name,
        concurrency: job.concurrency ?? 3,
        items: job.items.map(({ relative, seq, title }) => ({
          relative,
          seq,
          title,
        })),
      },
    }),
  remove: (job: UploadJob) =>
    invoke('desktop_remove_job', {
      id: job.id,
      expectedRevision: job.revision ?? 0,
    }),
  collapse: (job: UploadJob, collapsed: boolean) =>
    invoke<UploadJob>('desktop_collapse_job', { id: job.id, collapsed }),
  rebind: (job: UploadJob) =>
    invoke<UploadJob>('desktop_rebind_job', {
      id: job.id,
      expectedRevision: job.revision ?? 0,
    }),
  pause: (id: string) => invoke('desktop_pause', { id }),
  listen: (onJob: (job: UploadJob) => void) =>
    listen<UploadJob>('desktop-upload-updated', ({ payload }) =>
      onJob(payload),
    ),
};
export const desktopDownloads = {
  list: () => invoke<DownloadJob[]>('desktop_download_jobs'),
  pickDirectory: () => invoke<null | string>('desktop_download_pick_directory'),
  add: (
    resId: number,
    versionId: number,
    fileIds: number[],
    directory: string,
    concurrency = 4,
  ) =>
    invoke<DownloadJob>('desktop_download_add', {
      resId,
      versionId,
      fileIds,
      directory,
      concurrency,
    }),
  pause: (id: string) => invoke('desktop_download_pause', { id }),
  resume: (id: string, overwrite = false) =>
    invoke('desktop_download_resume', { id, overwrite }),
  listen: (onJob: (job: DownloadJob) => void) =>
    listen<DownloadJob>('desktop-download-updated', ({ payload }) =>
      onJob(payload),
    ),
};
