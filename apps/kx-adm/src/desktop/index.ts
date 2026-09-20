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
  state = await invoke<Bootstrap>('desktop_bootstrap');
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
  if (desktop)
    receive(await invoke<DesktopSession>('desktop_import_session', { token }));
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
